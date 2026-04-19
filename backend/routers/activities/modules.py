"""
routers/activities/modules.py
Gerenciamento de módulos, conteúdos e quizzes (admin) + listagem (aluno).
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
import json, os, uuid

from routers.deps import get_current_user
from services.database import get_client
from services.llm import groq_chat

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class ContentIn(BaseModel):
    type: str          # video | slide | text | pdf
    title: str
    url: Optional[str] = None
    body: Optional[str] = None
    order: int = 0

class QuestionIn(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    explanation: Optional[str] = None
    order: int = 0

class QuizIn(BaseModel):
    title: str
    questions: List[QuestionIn] = []

class FlashcardIn(BaseModel):
    word: str
    translation: str
    example: Optional[str] = None
    order: int = 0

class ModuleIn(BaseModel):
    title: str
    description: Optional[str] = None
    levels: List[str] = ["Beginner"]
    order: int = 0
    is_published: Optional[bool] = None
    contents: Optional[List[ContentIn]] = []
    quiz: Optional[QuizIn] = None
    flashcards: Optional[List[FlashcardIn]] = []

class GenerateQuizIn(BaseModel):
    title: str
    description: Optional[str] = None
    level: str = "Beginner"
    content_titles: Optional[str] = None

class GenerateFlashcardsIn(BaseModel):
    theme: str
    instructions: Optional[str] = ""
    level: str = "Beginner"

class FlashcardAnalyzeIn(BaseModel):
    word: str
    translation: str
    user_answer: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_staff(user):
    role = str(user.get("role", "")).lower()
    return role in ("admin", "professor", "professora", "programador", "staff")

def _require_admin(user):
    if not _is_staff(user):
        raise HTTPException(403, "Acesso restrito a professores")


# ── Rotas ADMIN (Devem vir ANTES das rotas com ID dinâmico) ─────────────────────

@router.get("/admin/all")
async def admin_list_all(user=Depends(get_current_user)):
    """Admin: lista todos os módulos independente de nível/publicação."""
    _require_admin(user)
    db = get_client()
    res = db.table("modules").select("*").order("created_at", desc=True).execute()
    return res.data or []

@router.post("/admin")
async def admin_create_module(payload: ModuleIn, user=Depends(get_current_user)):
    """Admin: cria módulo completo."""
    _require_admin(user)
    db = get_client()
    try:
        mod_res = db.table("modules").insert({
            "title":        payload.title,
            "description":  payload.description,
            "level":        payload.levels[0] if payload.levels else "Beginner",
            "levels":       payload.levels,
            "order":        payload.order,
            "is_published": False,
            "flashcards":   [f.model_dump() for f in payload.flashcards] if payload.flashcards else []
        }).execute()
        
        mod_id = mod_res.data[0]["id"]
        if payload.contents:
            db.table("module_contents").insert([{"module_id": mod_id, **c.model_dump()} for c in payload.contents]).execute()
        if payload.quiz and payload.quiz.questions:
            q_res = db.table("quizzes").insert({"module_id": mod_id, "title": payload.quiz.title}).execute()
            quiz_id = q_res.data[0]["id"]
            db.table("quiz_questions").insert([{"quiz_id": quiz_id, **q.model_dump()} for q in payload.quiz.questions]).execute()
        return {"ok": True, "module_id": mod_id}
    except Exception as e:
        raise HTTPException(500, f"Erro ao criar: {str(e)}")

@router.put("/admin/{module_id}")
async def admin_update_module(module_id: str, payload: ModuleIn, user=Depends(get_current_user)):
    """Admin: atualiza módulo completo."""
    _require_admin(user)
    db = get_client()
    try:
        update_data = {
            "title": payload.title, "description": payload.description,
            "levels": payload.levels, "level": payload.levels[0] if payload.levels else "Beginner",
            "order": payload.order, "flashcards": [f.model_dump() for f in payload.flashcards]
        }
        if payload.is_published is not None: update_data["is_published"] = payload.is_published
        db.table("modules").update(update_data).eq("id", module_id).execute()

        if payload.contents is not None:
            db.table("module_contents").delete().eq("module_id", module_id).execute()
            if payload.contents:
                db.table("module_contents").insert([{"module_id": module_id, **c.model_dump()} for c in payload.contents]).execute()

        if payload.quiz is not None:
            db.table("quizzes").delete().eq("module_id", module_id).execute()
            if payload.quiz.questions:
                q_res = db.table("quizzes").insert({"module_id": module_id, "title": payload.quiz.title}).execute()
                quiz_id = q_res.data[0]["id"]
                db.table("quiz_questions").insert([{"quiz_id": quiz_id, **q.model_dump()} for q in payload.quiz.questions]).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, f"Erro ao atualizar: {str(e)}")

@router.post("/admin/generate-flashcards")
async def admin_generate_flashcards(payload: GenerateFlashcardsIn, user=Depends(get_current_user)):
    """Admin: gera flashcards via IA usando material do RAG."""
    _require_admin(user)
    db = get_client()
    
    # Busca contexto no RAG baseado no tema
    from services.rag_search import obter_contexto_rag
    rag_context = obter_contexto_rag(payload.theme).contexto
    
    context_str = f"\nUse este material de apoio como base:\n---\n{rag_context}\n---\n" if rag_context else ""

    prompt = (
        f"Teacher Tati: Crie 10 flashcards de inglês sobre o tema '{payload.theme}'.\n"
        f"Nível: {payload.level}.\n"
        f"{context_str}"
        "Retorne APENAS um objeto JSON no formato:\n"
        '{"title": "Nome do Módulo", "description": "Descrição", "flashcards": [{"word": "Inglês", "translation": "Português", "example": "Exemplo em inglês"}]}'
    )
    try:
        content = await groq_chat([{"role": "user", "content": prompt}])
        # Extrair JSON de forma robusta
        try:
            start = content.find('{')
            end = content.rfind('}') + 1
            if start == -1 or end == 0:
                raise ValueError("JSON não encontrado na resposta da IA")
            data = json.loads(content[start:end])
        except Exception as e:
            print(f"[IA Error] Falha ao parsear JSON: {e}\nContent: {content}")
            raise HTTPException(500, "IA retornou formato inválido. Tente novamente.")

        res = db.table("modules").insert({
            "title": data.get("title") or f"Flashcards: {payload.theme}",
            "description": data.get("description", ""),
            "level": payload.level, 
            "levels": [payload.level],
            "flashcards": data.get("flashcards", []), 
            "is_published": True
        }).execute()
        
        if not res.data:
            raise HTTPException(500, "Erro ao salvar flashcards no banco.")
            
        return {"ok": True, "module": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Flashcard Gen] Erro: {e}")
        raise HTTPException(500, f"Erro ao gerar flashcards: {str(e)}")

@router.post("/admin/generate-quiz")
async def admin_generate_quiz(payload: GenerateQuizIn, user=Depends(get_current_user)):
    """Admin: gera quiz via IA usando material do RAG."""
    _require_admin(user)
    
    # Busca contexto no RAG baseado no título/descrição
    from services.rag_search import obter_contexto_rag
    rag_context = obter_contexto_rag(f"{payload.title} {payload.description or ''}").contexto
    
    context_str = f"\nMaterial de apoio:\n{rag_context}\n" if rag_context else ""

    prompt = (
        f"Teacher Tati: Crie quiz de 5 questões (JSON: quiz_title, questions[question, options, correct_index, explanation]). "
        f"Módulo: {payload.title}. Nível: {payload.level}.\n"
        f"{context_str}"
    )
    try:
        text = await groq_chat([{"role": "user", "content": prompt}])
        start, end = text.find('{'), text.rfind('}') + 1
        return json.loads(text[start:end])
    except Exception as e:
        raise HTTPException(500, f"Erro IA: {str(e)}")

@router.post("/admin/upload-content")
async def admin_upload_content(file: UploadFile = File(...), user=Depends(get_current_user)):
    _require_admin(user)
    db = get_client()
    BUCKET = "module-contents"
    filename = f"{uuid.uuid4()}{os.path.splitext(file.filename)[1].lower()}"
    try:
        db.storage.from_(BUCKET).upload(path=filename, file=await file.read(), file_options={"content-type": file.content_type})
        return {"url": db.storage.from_(BUCKET).get_public_url(filename)}
    except Exception as e:
        raise HTTPException(500, f"Erro upload: {str(e)}")

@router.delete("/admin/{module_id}")
async def admin_delete_module(module_id: str, user=Depends(get_current_user)):
    _require_admin(user)
    get_client().table("modules").delete().eq("id", module_id).execute()
    return {"ok": True}


# ── Rotas ALUNO (Devem vir DEPOIS) ─────────────────────────────────────────────

@router.get("/")
async def list_modules(user=Depends(get_current_user)):
    """Lista módulos publicados para o aluno com progresso (tentativas)."""
    db = get_client()
    username = user["username"]
    user_level = user.get("level") or "Beginner"
    
    # Busca módulos
    res = db.table("modules").select("*, quizzes(id, title, description)").eq("is_published", True).order("order").execute()
    modules_data = res.data or []
    
    # Busca progresso do usuário (tentativas de quiz)
    progress_res = db.table("user_progress").select("quiz_id, score").eq("username", username).execute()
    progress_data = progress_res.data or []
    best_score_map = {p["quiz_id"]: p["score"] for p in progress_data}

    # Conta tentativas reais pelo study_sessions
    sessions_res = db.table("study_sessions").select("quiz_id").eq("username", username).eq("activity_type", "quiz").execute()
    attempts_map = {}
    for p in progress_data:
        qid = p["quiz_id"]
        attempts_map[qid] = attempts_map.get(qid, 0) + 1
    
    filtered = []
    for m in modules_data:
        lvls = m.get("levels") or []
        sing = m.get("level")
        
        # Filtro de nível
        show = False
        if not lvls and not sing: show = True
        elif "all" in lvls or "todos" in lvls or sing in ["all", "todos"]: show = True
        elif user_level in lvls or user_level == sing: show = True
        
        if show:
            quizzes = m.get("quizzes", [])
            for q in quizzes:
                q["attempts"] = attempts_map.get(q["id"], 0)
            
            m["has_quiz"] = len(quizzes) > 0
            m["has_flashcards"] = isinstance(m.get("flashcards"), list) and len(m.get("flashcards", [])) > 0
            filtered.append(m)
            
    return filtered

@router.get("/{module_id}")
async def get_module(module_id: str, user=Depends(get_current_user)):
    """Detalhe do módulo."""
    db = get_client()
    mod = db.table("modules").select("*").eq("id", module_id).single().execute()
    if not mod.data: raise HTTPException(404, "Não encontrado")
    contents = db.table("module_contents").select("*").eq("module_id", module_id).order("order").execute()
    quizzes_raw = db.table("quizzes").select("id, title, description").eq("module_id", module_id).execute()
    quizzes = []
    for q in (quizzes_raw.data or []):
        questions = db.table("quiz_questions").select("*").eq("quiz_id", q["id"]).order("order").execute()
        quizzes.append({**q, "questions": questions.data or []})
    return {**mod.data, "contents": contents.data or [], "quizzes": quizzes}

@router.post("/flashcards/analyze")
async def analyze_flashcard_answer(payload: FlashcardAnalyzeIn, user=Depends(get_current_user)):
    prompt = f"Teacher Tati: Feedback curto (Português) para flashcard. Palavra: {payload.word}. Resposta: {payload.user_answer}."

    try:
        get_client().table("study_sessions").insert({
            "username": user["username"],
            "activity_type": "flashcard",
            "duration_minutes": 1  # ~1 min por flashcard revisado
        }).execute()
    except:
        pass

    try:
        feedback = await groq_chat([{"role": "user", "content": prompt}])
        return {"feedback": feedback.strip()}
    except:
        return {"feedback": "Good try!"}
