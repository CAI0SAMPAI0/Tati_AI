"""
routers/activities/quizzes.py
Aluno: responde quiz, vê resultado.
Admin: cria questões manualmente ou dispara geração por IA.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from routers.deps import get_current_user, require_staff
from services.database import get_client
from services.llm import groq_chat, GroqKeyError


PERSONALIZED_MODULE_ID = "00000000-0000-0000-0000-000000000001"


def _normalize_lang(lang: str | None) -> str:
    """Normaliza idioma para os códigos aceitos pelo app."""
    raw = (lang or "").split(",")[0].strip().lower()
    if raw in ("en", "en-us"):
        return "en-US"
    if raw in ("en-uk", "en-gb"):
        return "en-UK"
    if raw in ("pt", "pt-br"):
        return "pt-BR"
    return "pt-BR"


def _get_lang(request: Request) -> str:
    """Detecta idioma do header Accept-Language enviado pelo frontend."""
    return _normalize_lang(request.headers.get("Accept-Language"))


def _looks_portuguese(text: str) -> bool:
    sample = (text or "").lower()
    markers = (
        "alternativa correta",
        "as outras opções",
        "estão incorretas",
        "porque é",
        "responde à pergunta",
        "gramática",
        "vocabulário",
        "usamos",
    )
    return any(marker in sample for marker in markers)


def _looks_english(text: str) -> bool:
    sample = (text or "").lower()
    markers = (
        "correct answer",
        "other options",
        "incorrect in this context",
        "because it",
        "answers the question",
        "grammar",
        "vocabulary",
        "is used with",
    )
    return any(marker in sample for marker in markers)


def gerar_explicacao_detalhada(pergunta_lower: str, alternativa_correta: str, opcoes: list[str], lang: str = "pt-BR") -> str:
    """
    Gera explicação para a alternativa correta no idioma do usuário.
    lang: 'pt-BR' | 'en-US' | 'en-UK'
    """
    is_en = lang.startswith("en")

    if not alternativa_correta:
        return "This is the correct answer." if is_en else "Esta é a alternativa correta."

    if "am" in pergunta_lower or "is" in pergunta_lower or "are" in pergunta_lower:
        if alternativa_correta.strip() == "am":
            return ("'Am' is used with the personal pronoun 'I'. The correct form is: I am."
                    if is_en else
                    "Usamos 'am' com o pronome pessoal 'I' (eu). A forma correta é: I am.")
        elif alternativa_correta.strip() == "is":
            return ("'Is' is used with third-person singular pronouns (he, she, it) or singular nouns."
                    if is_en else
                    "Usamos 'is' com pronomes pessoais da terceira pessoa do singular (he, she, it) ou com nomes singulares.")
        elif alternativa_correta.strip() == "are":
            return ("'Are' is used with second-person pronouns (you), first-person plural (we), and third-person plural (they)."
                    if is_en else
                    "Usamos 'are' com pronomes pessoais da segunda pessoa (you), primeira pessoa do plural (we) e terceira pessoa do plural (they).")

    elif "happy" in pergunta_lower or "sad" in pergunta_lower or "tired" in pergunta_lower:
        return (f"'{alternativa_correta}' is correct because it accurately describes the emotional state or condition mentioned in the question."
                if is_en else
                f"A alternativa correta é '{alternativa_correta}' porque descreve adequadamente o estado emocional ou condição mencionada na pergunta.")

    elif any(w in pergunta_lower for w in ["what", "where", "when", "who", "why", "how"]):
        return (f"'{alternativa_correta}' is correct because it directly answers the question using appropriate vocabulary and grammar."
                if is_en else
                f"A alternativa correta é '{alternativa_correta}' porque responde diretamente à pergunta feita, usando o vocabulário e a estrutura gramatical apropriados.")

    elif alternativa_correta.endswith('s') and len(alternativa_correta) > 3:
        return (f"'{alternativa_correta}' is correct because it is in the plural form, as indicated by the context or sentence structure."
                if is_en else
                f"A alternativa correta é '{alternativa_correta}' porque está no plural, conforme indicado pelo contexto da pergunta ou pela estrutura da frase.")

    elif alternativa_correta in ['a', 'an', 'the']:
        articles_en = {
            'a':   "We use 'a' before words that begin with a consonant sound.",
            'an':  "We use 'an' before words that begin with a vowel sound.",
            'the': "We use 'the' to refer to something specific that has already been mentioned or is known to both speakers.",
        }
        articles_pt = {
            'a':   "Usamos 'a' antes de palavras que começam com som de consoante.",
            'an':  "Usamos 'an' antes de palavras que começam com som de vogal.",
            'the': "Usamos 'the' para nos referir a algo específico que já foi mencionado ou é conhecido por ambos.",
        }
        return (articles_en.get(alternativa_correta, f"The article '{alternativa_correta}' is correct in this context.")
                if is_en else
                articles_pt.get(alternativa_correta, f"O artigo '{alternativa_correta}' está correto neste contexto."))

    # Genérica
    other_opts = ", ".join(f"'{o}'" for o in opcoes if o != alternativa_correta)
    if is_en:
        return (f"'{alternativa_correta}' is the correct answer because it best completes the sentence "
                f"or answers the question according to English grammar and vocabulary rules. "
                f"The other options ({other_opts}) are incorrect in this context.")
    return (f"A alternativa correta é '{alternativa_correta}' porque é a que melhor completa a frase "
            f"ou responde à pergunta conforme as regras de gramática e vocabulário em inglês. "
            f"As outras opções ({other_opts}) estão incorretas neste contexto.")


def ensure_explanation_language(
    current_explanation: str | None,
    question_text: str,
    options: list[str],
    correct_index: int,
    lang: str,
) -> str:
    """
    Garante que a explicação fique no idioma do app.
    Se estiver ausente ou em idioma diferente, regenera explicação padrão no idioma correto.
    """
    explanation = (current_explanation or "").strip()
    safe_options = options or []
    safe_idx = correct_index if isinstance(correct_index, int) else 0
    if safe_idx < 0 or safe_idx >= len(safe_options):
        safe_idx = 0
    correct_option = safe_options[safe_idx] if safe_options else ""
    q_lower = (question_text or "").lower()
    normalized_lang = _normalize_lang(lang)
    wants_en = normalized_lang.startswith("en")

    if not explanation:
        return gerar_explicacao_detalhada(q_lower, correct_option, safe_options, normalized_lang)

    if wants_en and _looks_portuguese(explanation):
        return gerar_explicacao_detalhada(q_lower, correct_option, safe_options, normalized_lang)

    if (not wants_en) and _looks_english(explanation):
        return gerar_explicacao_detalhada(q_lower, correct_option, safe_options, normalized_lang)

    return explanation
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
async def get_quiz(quiz_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Retorna quiz com questões. Explicações no idioma do usuário via Accept-Language."""
    db = get_client()
    quiz = db.table("quizzes").select("*").eq("id", quiz_id).limit(1).execute().data
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz não encontrado")
    quiz_row = quiz[0]
    username = current_user["username"]
    lang = _get_lang(request)

    questions_raw = (
        db.table("quiz_questions")
        .select("id, question, options, order, explanation, correct_index")
        .eq("quiz_id", quiz_id)
        .order("order")
        .execute()
        .data
    )

    questions = []
    for q in questions_raw:
        q["explanation"] = ensure_explanation_language(
            q.get("explanation"),
            q.get("question", ""),
            q.get("options") or [],
            q.get("correct_index", 0),
            lang,
        )
        questions.append(q)

    # Atualiza status da prática personalizada ao abrir o quiz: pending -> done
    if quiz_row.get("module_id") == PERSONALIZED_MODULE_ID:
        try:
            new_status = "done"
            attempt = (
                db.table("user_exercise_attempts")
                .select("id, status")
                .eq("username", username)
                .eq("exercise_id", quiz_id)
                .eq("activity_type", "quiz")
                .limit(1)
                .execute()
                .data
            )
            if attempt:
                current_status = (attempt[0].get("status") or "").lower()
                if current_status == "corrected":
                    new_status = "corrected"
                else:
                    db.table("user_exercise_attempts").update(
                        {"status": "done"}
                    ).eq("id", attempt[0]["id"]).execute()
            else:
                db.table("user_exercise_attempts").insert(
                    {
                        "username": username,
                        "exercise_id": quiz_id,
                        "module_id": PERSONALIZED_MODULE_ID,
                        "activity_type": "quiz",
                        "status": "done",
                    }
                ).execute()
            quiz_row["status"] = new_status
        except Exception:
            # Mantém fluxo do quiz mesmo se tabela auxiliar não existir.
            quiz_row["status"] = quiz_row.get("status") or "done"

    return {**quiz_row, "questions": questions}


@router.post("/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: str,
    body: QuizSubmit,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Aluno submete respostas — calcula score e distribui troféus."""
    db = get_client()
    username = current_user["username"]
    lang = _get_lang(request)

    questions_raw = (
        db.table("quiz_questions")
        .select("id, correct_index, explanation, options, question")
        .eq("quiz_id", quiz_id)
        .order("order")
        .execute()
        .data
    )
    
    # Garante explicações no idioma do app para retorno consistente.
    questions = []
    for q in questions_raw:
        q["explanation"] = ensure_explanation_language(
            q.get("explanation"),
            q.get("question", ""),
            q.get("options") or [],
            q.get("correct_index", 0),
            lang,
        )
        questions.append(q)
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

    # Atualiza status da prática personalizada para "corrected".
    if module_id == PERSONALIZED_MODULE_ID:
        try:
            attempt = (
                db.table("user_exercise_attempts")
                .select("id")
                .eq("username", username)
                .eq("exercise_id", quiz_id)
                .eq("activity_type", "quiz")
                .limit(1)
                .execute()
                .data
            )
            payload = {
                "module_id": module_id,
                "activity_type": "quiz",
                "status": "corrected",
                "score": score,
            }
            if attempt:
                db.table("user_exercise_attempts").update(payload).eq(
                    "id", attempt[0]["id"]
                ).execute()
            else:
                db.table("user_exercise_attempts").insert(
                    {
                        **payload,
                        "username": username,
                        "exercise_id": quiz_id,
                    }
                ).execute()
        except Exception:
            pass
    
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


@router.get("/admin/list")
async def list_quizzes(username: str | None = None, current_user: dict = Depends(require_staff)):
    """Lista quizzes (opcionalmente filtrado por aluno)."""
    db = get_client()
    query = db.table("quizzes").select("*")
    if username:
        query = query.eq("username", username)
    res = query.order("created_at", desc=True).execute()
    return res.data or []


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
    db = get_client()
    # Primeiro deleta as perguntas vinculadas
    db.table("quiz_questions").delete().eq("quiz_id", quiz_id).execute()
    # Depois o quiz
    db.table("quizzes").delete().eq("id", quiz_id).execute()
    return {"ok": True}


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

    # Valida e garante que cada questão tenha explicação
    for q in questions:
        if not q.get("explanation") or not q["explanation"].strip():
            # Gera explicação básica se faltante
            correct_option = q["options"][q["correct_index"]] if q.get("options") and len(q["options"]) > q["correct_index"] else "alternativa correta"
            q["explanation"] = f"A alternativa correta é: {correct_option}"

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
