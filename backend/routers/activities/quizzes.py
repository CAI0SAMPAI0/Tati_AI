"""
routers/activities/quizzes.py
Aluno: responde quiz, vê resultado.
Admin: cria questões manualmente ou dispara geração por IA.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from routers.deps import get_current_user, require_staff
from services.database import get_client
from services.llm import groq_chat, GroqKeyError

router = APIRouter()


# ── Models ────────────────────────────────────────────────────


class QuizCreate(BaseModel):
    module_id: str
    title: str
    description: str | None = None


class QuestionCreate(BaseModel):
    question: str
    options: list[str]       # exatamente 4 itens
    correct_index: int       # 0-3
    explanation: str | None = None
    order: int = 0


class QuizSubmit(BaseModel):
    answers: list[int]       # índice escolhido para cada questão, na ordem


class AIGenerateBody(BaseModel):
    context: str             # texto/transcrição do vídeo ou slide
    num_questions: int = 5


# ── Aluno: leitura e submissão ────────────────────────────────


@router.get("/{quiz_id}")
async def get_quiz(quiz_id: str, current_user: dict = Depends(get_current_user)):
    """Retorna quiz com questões (sem revelar a resposta certa)."""
    db = get_client()
    quiz = db.table("quizzes").select("*").eq("id", quiz_id).limit(1).execute().data
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz não encontrado")

    questions = (
        db.table("quiz_questions")
        .select("id, question, options, order, explanation, correct_index")
        .eq("quiz_id", quiz_id)
        .order("order")
        .execute()
        .data
    )

    # Não envia correct_index para o aluno
    return {**quiz[0], "questions": questions}


@router.post("/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: str, body: QuizSubmit, current_user: dict = Depends(get_current_user)
):
    """Aluno submete respostas — calcula score e distribui troféus."""
    db = get_client()
    username = current_user["username"]

    questions = (
        db.table("quiz_questions")
        .select("id, correct_index, explanation, options, question")
        .eq("quiz_id", quiz_id)
        .order("order")
        .execute()
        .data
    )
    if not questions:
        raise HTTPException(status_code=404, detail="Quiz sem questões")
    if len(body.answers) != len(questions):
        raise HTTPException(
            status_code=400,
            detail=f"Esperado {len(questions)} respostas, recebido {len(body.answers)}",
        )

    # Calcula acertos
    results = []
    correct_q = 0
    for q, chosen in zip(questions, body.answers):
        is_correct = chosen == q["correct_index"]
        if is_correct:
            correct_q += 1
        results.append(
            {
                "question": q["question"],
                "chosen_index": chosen,
                "correct_index": q["correct_index"],
                "is_correct": is_correct,
                "explanation": q.get("explanation"),
                "options": q["options"],
            }
        )

    total_q = len(questions)
    score = round((correct_q / total_q) * 100)

    # Pega module_id pelo quiz
    quiz_row = db.table("quizzes").select("module_id").eq("id", quiz_id).limit(1).execute().data
    module_id = quiz_row[0]["module_id"] if quiz_row else None

    # Salva/atualiza progresso (upsert)
    try:
        db.table("user_progress").insert(
            {
                "username": username,
                "quiz_id": quiz_id,
                "module_id": module_id,
                "score": score,
                "total_q": total_q,
                "correct_q": correct_q,
            }
        ).execute()
    except Exception as e:
        print(f"[Progress] Erro ao salvar: {e}")

    # Registra ação para Ranking e contagem de tentativas
    try:
        db.table("study_sessions").insert({
            "username": username,
            "activity_type": "quiz",
            "duration_minutes": 1.25, # Tempo estimado por quiz
            "quiz_id": quiz_id
        }).execute()
    except Exception as e:
        print(f"[Quiz Action] Erro: {e}")

    # Distribui troféus
    trophies_earned = await _check_trophies(username, score, db)
    
    # Atualiza ofensiva (streak)
    from services.streaks import record_study_day
    record_study_day(username)

    return {
        "score": score,
        "correct": correct_q,
        "total": total_q,
        "results": results,
        "trophies_earned": trophies_earned,
    }


@router.get("/my/progress")
async def my_progress(current_user: dict = Depends(get_current_user)):
    """Progresso do aluno em todos os quizzes."""
    return (
        get_client()
        .table("user_progress")
        .select("quiz_id, module_id, score, correct_q, total_q, completed_at")
        .eq("username", current_user["username"])
        .order("completed_at", desc=True)
        .execute()
        .data
    )


# ── Admin: criação manual ─────────────────────────────────────


@router.post("/admin", status_code=status.HTTP_201_CREATED)
async def create_quiz(body: QuizCreate, current_user: dict = Depends(require_staff)):
    result = get_client().table("quizzes").insert(body.model_dump()).execute()
    return result.data[0]


@router.post("/admin/{quiz_id}/questions", status_code=status.HTTP_201_CREATED)
async def add_question(
    quiz_id: str, body: QuestionCreate, current_user: dict = Depends(require_staff)
):
    if len(body.options) != 4:
        raise HTTPException(status_code=400, detail="Cada questão deve ter exatamente 4 opções")
    result = (
        get_client()
        .table("quiz_questions")
        .insert({**body.model_dump(), "quiz_id": quiz_id})
        .execute()
    )
    return result.data[0]


@router.delete("/admin/{quiz_id}", status_code=204)
async def delete_quiz(quiz_id: str, current_user: dict = Depends(require_staff)):
    get_client().table("quizzes").delete().eq("id", quiz_id).execute()


@router.delete("/admin/questions/{question_id}", status_code=204)
async def delete_question(question_id: str, current_user: dict = Depends(require_staff)):
    get_client().table("quiz_questions").delete().eq("id", question_id).execute()


# ── Admin: geração por IA ─────────────────────────────────────


@router.post("/admin/{quiz_id}/generate")
async def generate_questions(
    quiz_id: str, body: AIGenerateBody, current_user: dict = Depends(require_staff)
):
    """
    Gera questões para o quiz usando IA a partir de um contexto
    (transcrição de vídeo, texto do slide, etc).
    A professora pode editar antes de publicar.
    """
    import json

    # Se não houver contexto manual, busca no RAG baseado no quiz_id (título do quiz)
    context = body.context
    if not context or len(context.strip()) < 10:
        db = get_client()
        quiz = db.table("quizzes").select("title").eq("id", quiz_id).single().execute().data
        if quiz:
            from services.rag_search import obter_contexto_rag
            context = obter_contexto_rag(quiz["title"]).contexto

    prompt = f"""You are an English teacher creating a multiple-choice quiz.

Context (lesson content):
---
{context}
---

Create exactly {body.num_questions} multiple-choice questions based on this content.
Each question must have exactly 4 options (A, B, C, D).
Return ONLY valid JSON, no markdown, no extra text:

{{
  "questions": [
    {{
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "explanation": "Brief explanation of why this answer is correct."
    }}
  ]
}}

Rules:
- correct_index is 0-based (0=A, 1=B, 2=C, 3=D)
- Questions must be directly related to the content
- Mix comprehension, vocabulary and grammar questions
- Keep questions clear and at appropriate English learning level
"""

    try:
        raw = await groq_chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.3,
        )
    except GroqKeyError as exc:
        raise HTTPException(status_code=503, detail=f"Erro na IA: {exc}")

    # Limpa possível markdown
    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(clean)
        questions = data.get("questions", [])
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="IA retornou formato inválido. Tente novamente.")

    if not questions:
        raise HTTPException(status_code=502, detail="IA não gerou questões. Tente com um contexto maior.")

    # Salva as questões geradas no banco
    db = get_client()
    inserted = []
    for i, q in enumerate(questions):
        if len(q.get("options", [])) != 4:
            continue
        result = db.table("quiz_questions").insert(
            {
                "quiz_id": quiz_id,
                "question": q["question"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "explanation": q.get("explanation"),
                "order": i,
            }
        ).execute()
        inserted.append(result.data[0])

    return {"generated": len(inserted), "questions": inserted}


# ── Troféus ───────────────────────────────────────────────────


TROPHY_DEFINITIONS = [
    {
        "name": "Primeiro Quiz",
        "condition": lambda score, total_done: total_done >= 1,
    },
    {
        "name": "Quizzer Iniciante",
        "condition": lambda score, total_done: total_done >= 5,
    },
    {
        "name": "Quizzer",
        "condition": lambda score, total_done: total_done >= 10,
    },
    {
        "name": "Mestre dos Quizzes",
        "condition": lambda score, total_done: total_done >= 50,
    },
]


async def _check_trophies(username: str, score: int, db) -> list[dict]:
    """Verifica e distribui troféus que o aluno ainda não tem."""
    try:
        # Total de atividades concluídas
        progress = (
            db.table("user_progress")
            .select("id")
            .eq("username", username)
            .execute()
            .data
        )
        total_done = len(progress)

        # Troféus já conquistados pelo usuário
        existing = (
            db.table("user_trophies")
            .select("trophy_id")
            .eq("username", username)
            .execute()
            .data
        )
        existing_trophy_ids = {t["trophy_id"] for t in existing}

        # Busca definições de troféus do banco para pegar os UUIDs
        all_trophies = db.table("trophies").select("id, name, icon").execute().data or []
        trophy_map = {t["name"]: t for t in all_trophies}

        earned = []
        for defn in TROPHY_DEFINITIONS:
            t_info = trophy_map.get(defn["name"])
            if not t_info:
                continue

            t_id = t_info["id"]
            if t_id in existing_trophy_ids:
                continue

            if defn["condition"](score, total_done):
                db.table("user_trophies").insert(
                    {
                        "username": username,
                        "trophy_id": t_id,
                    }
                ).execute()
                earned.append({"title": t_info["name"], "icon": t_info["icon"]})

        return earned
    except Exception as e:
        print(f"[Trophies] Erro ao verificar: {e}")
        return []