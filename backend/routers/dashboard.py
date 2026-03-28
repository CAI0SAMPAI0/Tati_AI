from fastapi import APIRouter, Depends, HTTPException, Query
from routers.deps import get_current_user
from services.database import get_client
from services.llm import groq_chat, GroqKeyError, GROQ_KEYS
from pydantic import BaseModel
from dotenv import load_dotenv
#import os
import json
import re


load_dotenv()
router = APIRouter()

ALLOWED_ROLES = ("professor", "professora", "programador", "Tatiana", "Tati")

# Mapeamento lang → instrução de idioma para o modelo
LANG_INSTRUCTION = {
    "pt-BR": "Respond entirely in Brazilian Portuguese (pt-BR).",
    "en-US": "Respond entirely in English (US).",
    "en-UK": "Respond entirely in English (UK).",
}
DEFAULT_LANG = "pt-BR"


class StudentUpdate(BaseModel):
    level: str | None = None
    custom_prompt: str | None = None

# class para erros gramaticais
class GrammarError(BaseModel):
    category: str
    count: int
    example: str | None = None

class GrammarErrorsResponse(BaseModel):
    errors: list[GrammarError]


def _require_staff(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return current_user


def _sanitize_json_block(text: str) -> str:
    return text.replace("```json", "").replace("```", "").strip()


def _extract_grammar_errors(payload: dict) -> list[dict]:
    errors = payload.get("errors")
    if not isinstance(errors, list):
        return []

    normalized: list[dict] = []
    for item in errors:
        if not isinstance(item, dict):
            continue

        category = str(item.get("category", "Unknown")).strip() or "Unknown"
        count_value = item.get("count", 0)
        try:
            count = int(count_value)
        except (TypeError, ValueError):
            count = 0
        if count < 0:
            count = 0

        example = item.get("example")
        example_text = str(example).strip() if isinstance(example, str) else None

        normalized.append(
            GrammarError(
                category=category,
                count=count,
                example=example_text or None,
            ).model_dump()
        )

    return normalized


def _heuristic_grammar_errors(messages: list[dict]) -> list[dict]:
    """
    Fallback local para detectar erros comuns quando a IA retornar vazio.
    Ajuda especialmente em casos simples (ex.: "I are", "beatiful").
    """
    pattern_catalog = [
        (
            re.compile(r"\bi are\b", flags=re.IGNORECASE),
            "Subject-verb agreement (I am, not I are)",
            "I are beautiful",
        ),
        (
            re.compile(r"\b(he|she|it)\s+(go|work|study|like|want)\b", flags=re.IGNORECASE),
            "Third person singular (missing -s)",
            "She work every day",
        ),
        (
            re.compile(r"\bin monday\b|\bin night\b|\bat morning\b", flags=re.IGNORECASE),
            "Prepositions of time (in/on/at)",
            "In Monday I study",
        ),
        (
            re.compile(r"\bbeatiful\b", flags=re.IGNORECASE),
            "Spelling mistake",
            "beatiful → beautiful",
        ),
        (
            re.compile(r"\bi have went\b", flags=re.IGNORECASE),
            "Past participle misuse",
            "I have went there",
        ),
    ]

    counts: dict[str, dict] = {}
    for msg in messages:
        text = (msg.get("content") or "").strip()
        if not text:
            continue

        for regex, category, example in pattern_catalog:
            if regex.search(text):
                if category not in counts:
                    counts[category] = {"category": category, "count": 0, "example": example}
                counts[category]["count"] += 1

    return [GrammarError(**item).model_dump() for item in counts.values()]


def _feedback_based_errors(messages: list[dict]) -> list[dict]:
    """
    Extrai erros a partir da seção de feedback da própria Tati.
    Exemplo esperado:
    - 'I are' → should be 'I am' (subject-verb agreement ...)
    """
    feedback_line = re.compile(
        r"^\s*-\s*['\"]?(?P<wrong>[^'\"]+?)['\"]?\s*[→>-]+\s*should be\s*['\"]?(?P<right>[^'\"]+?)['\"]?(?:\s*\((?P<reason>.+)\))?\s*$",
        flags=re.IGNORECASE,
    )

    counts: dict[str, dict] = {}
    for msg in messages:
        if msg.get("role") != "assistant":
            continue

        content = msg.get("content") or ""
        if "feedback" not in content.lower():
            continue

        for raw_line in content.splitlines():
            line = raw_line.strip()
            match = feedback_line.match(line)
            if not match:
                continue

            wrong = (match.group("wrong") or "").strip()
            right = (match.group("right") or "").strip()
            reason = (match.group("reason") or "").strip()

            category = reason.split(":")[0].strip() if reason else "Corrected by teacher feedback"
            example = f"{wrong} → {right}" if wrong and right else None

            if category not in counts:
                counts[category] = {"category": category, "count": 0, "example": example}
            counts[category]["count"] += 1
            if not counts[category].get("example") and example:
                counts[category]["example"] = example

    return [GrammarError(**item).model_dump() for item in counts.values()]



@router.get("/stats")
async def get_stats(current_user: dict = Depends(_require_staff)):
    db = get_client()

    students = (
        db.table("users")
        .select("username")
        .eq("role", "student")
        .execute()
    )
    messages = (
        db.table("messages")
        .select("id")
        .eq("role", "user")
        .execute()
    )

    from datetime import date
    today = date.today().isoformat()
    active_today = (
        db.table("messages")
        .select("username")
        .eq("role", "user")
        .eq("date", today)
        .execute()
    )
    return {
        "total_students": len(students.data),
        "total_messages": len(messages.data),
        "active_today":   len(set(m["username"] for m in active_today.data)),
    }


@router.get("/students")
async def get_students(current_user: dict = Depends(_require_staff)):
    db = get_client()
    students = (
        db.table("users")
        .select("username, name, level, focus, created_at, custom_prompt")
        .eq("role", "student")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    result = []
    for u in students:
        msgs = (
            db.table("messages")
            .select("id")
            .eq("username", u["username"])
            .eq("role", "user")
            .execute()
        )
        last = (
            db.table("messages")
            .select("date")
            .eq("username", u["username"])
            .order("id", desc=True)
            .limit(1)
            .execute()
            .data
        )
        result.append({
            **u,
            "total_messages": len(msgs.data),
            "last_active":    last[0]["date"] if last else "---",
        })

    return result


@router.get("/students/{username}/insight")
async def get_student_insight(
    username: str,
    lang: str = Query(default=DEFAULT_LANG),
    current_user: dict = Depends(_require_staff),
):
    if not GROQ_KEYS:
        raise HTTPException(
            status_code=503,
            detail="Nenhuma GROQ_API_KEY configurada. Adicione ao .env e reinicie o servidor."
        )

    # Instrução de idioma — fallback para pt-BR se lang desconhecida
    lang_instruction = LANG_INSTRUCTION.get(lang, LANG_INSTRUCTION[DEFAULT_LANG])

    db = get_client()

    user_rows = (
        db.table("users")
        .select("name, level, focus, created_at")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    if not user_rows:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    student = user_rows[0]

    messages = (
        db.table("messages")
        .select("role, content, date")
        .eq("username", username)
        .order("id", desc=False)
        .limit(40)
        .execute()
        .data
    )

    if not messages:
        return {
            "insight": "Este aluno ainda não enviou nenhuma mensagem. Não há dados suficientes para gerar um insight."
        }

    history_text = ""
    for m in messages:
        role_label = "Student" if m["role"] == "user" else "Teacher Tati"
        history_text += f"{role_label}: {m['content']}\n\n"

    prompt = f"""You are an expert English language pedagogy assistant helping a teacher understand a student's progress.

LANGUAGE RULE: {lang_instruction}

Student profile:
- Name: {student.get('name', username)}
- Current level: {student.get('level', 'Unknown')}
- Learning focus: {student.get('focus', 'General')}
- Member since: {student.get('created_at', 'Unknown')}

Recent conversation history ({len(messages)} messages):
---
{history_text}
---

Please provide a concise pedagogical report for the teacher, covering:

1. **Pontos Fortes / Strong Points** — What the student does well
2. **Principais Dificuldades / Main Difficulties** — Recurring grammar or vocabulary mistakes
3. **Nível Real Estimado / Estimated Real Level** — What level does the student actually seem to be?
4. **Recomendações / Recommendations** — 3 to 5 specific, actionable suggestions
5. **Motivação e Engajamento / Motivation & Engagement** — How engaged does the student seem?

Be specific and cite examples from the conversation. Keep the tone professional but warm.
Remember: {lang_instruction}"""

    try:
        result = await groq_chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.4,
        )
        return {"insight": result}

    except GroqKeyError as e:
        err = str(e).lower()
        if "invalid_api_key" in err or "401" in err:
            raise HTTPException(
                status_code=401,
                detail="Chave(s) GROQ inválida(s). Verifique o .env e gere novas chaves em console.groq.com"
            )
        if "rate" in err or "429" in err:
            raise HTTPException(
                status_code=429,
                detail=f"Todas as {len(GROQ_KEYS)} chave(s) atingiram o limite. Aguarde e tente novamente."
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/students/{username}", status_code=204)
async def delete_student(username: str, current_user: dict = Depends(_require_staff)):
    db = get_client()
    user = db.table("users").select("username").eq("username", username).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.table("messages").delete().eq("username", username).execute()
    db.table("conversations").delete().eq("username", username).execute()
    db.table("users").delete().eq("username", username).execute()


@router.put("/students/{username}")
async def update_student(
    username: str,
    body: StudentUpdate,
    current_user: dict = Depends(_require_staff)
):
    db = get_client()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    db.table("users").update(update_data).eq("username", username).execute()
    return {"ok": True}



# mapa de frequencia de erros comuns (ex: "confundindo past simple e present perfect") —> contagem de mensagens que apresentam esse erro
@router.get("/students/{username}/grammar-errors", response_model=GrammarErrorsResponse)
async def get_grammar_errors(
    username: str,
    current_user: dict = Depends(_require_staff),
    lang: str = Query(default=DEFAULT_LANG),
):
    if not GROQ_KEYS:
        raise HTTPException(
            status_code=503,
            detail="Nenhuma GROQ_API_KEY configurada. Adicione ao .env e reinicie o servidor."
        )
        
    db = get_client()
    messages = (
        db.table("messages")
        .select("content")
        .eq("username", username)
        .eq("role", "user")
        .limit(40)
        .execute()
        .data
    )

    user_rows = (
        db.table("users")
        .select("name, level, focus, created_at")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    if not user_rows:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    student = user_rows[0]
            
    history_text = ""
    for m in messages:
        history_text += f"{m['content']}\n\n"
        
    # Instrução de idioma — fallback para pt-BR se lang desconhecida
    lang_instruction = LANG_INSTRUCTION.get(lang, LANG_INSTRUCTION[DEFAULT_LANG])
        
    prompt = f"""You are an expert English language pedagogy assistant helping a teacher understand a student's progress.

LANGUAGE RULE: {lang_instruction}

Student profile:
- Name: {student.get('name', username)}
- Current level: {student.get('level', 'Unknown')}
- Learning focus: {student.get('focus', 'General')}
- Member since: {student.get('created_at', 'Unknown')}

Recent conversation history ({len(messages)} messages):
---
{history_text}
---

Please analyze the student's messages and identify grammar/spelling mistakes or confusion patterns (e.g., mixing past simple and present perfect).
Important: include mistakes even when they appear only once (count = 1). Then provide a frequency map indicating how many messages contain each type of mistake.

Be specific and cite examples from the conversation. Keep the tone professional but warm.
Remember: {lang_instruction}

Return the result as a JSON object where keys are error descriptions and values are counts, like this:
{{
  "errors": [
    {{
      "category": "Past Simple vs Present Perfect",
      "count": 5,
      "example": "I have went there yesterday"
    }}
  ]
}}
Return valid JSON only. No markdown fences, comments or extra text."""

    try:
        result = await groq_chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.2,
        )
    except GroqKeyError as e:
        err = str(e).lower()
        if "invalid_api_key" in err or "401" in err:
            raise HTTPException(
                status_code=401,
                detail="Chave(s) GROQ inválida(s). Verifique o .env e gere novas chaves"
            )
        if "rate" in err or "429" in err:
            raise HTTPException(
                status_code=429,
                detail=f"Todas as {len(GROQ_KEYS)} chave(s) atingiram o limite. Aguarde e tente novamente."
            )
        raise HTTPException(status_code=500, detail=str(e))
    
    try:
        data = json.loads(_sanitize_json_block(result))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="A IA retornou um formato inválido para os erros gramaticais."
        )

    extracted = _extract_grammar_errors(data)
    if extracted:
        return {"errors": extracted}

    # fallback 1: usa feedback explícito da professora nas mensagens do assistant
    from_feedback = _feedback_based_errors(messages)
    if from_feedback:
        return {"errors": from_feedback}

    # fallback 2: heurísticas locais para casos básicos
    return {"errors": _heuristic_grammar_errors(messages)}


@router.get("/students/{username}/recommendations")
async def get_recommendations(username: str, current_user: dict = Depends(_require_staff), lang: str = Query(default=DEFAULT_LANG)):
    """
    criando objetivos dos alunos (ex: "focar em verbos irregulares", "melhorar escrita formal") e mapeando para recomendações específicas (ex: "praticar com exercícios de verbos irregulares", "escrever um email formal para a professora")
     
    js vai receber o JSON com os objetivos do aluno e as recomendações específicas para cada objetivo como um array de strings, e exibir na interface
    
    primeiro pegamos o usuário no banco de dados, depois analisamos as mensagens recentes para identificar os objetivos de aprendizado do aluno, e então retornamos as recomendações específicas para cada objetivo"""
    
    db = get_client()
    user_rows = (
        db.table("users")
        .select("name, level, focus, created_at")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    
    messages = (
        db.table("messages")
        .select("content")
        .eq("username", username)
        .eq("role", "user")
        .limit(40)
        .execute()
        .data
    )
    
    if not user_rows:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    student = user_rows[0]
    
    history_text = ""
    for m in messages:
        history_text += f"{m['content']}\n\n"
        
    # Instrução de idioma — fallback para pt-BR se lang desconhecida
    lang_instruction = LANG_INSTRUCTION.get(lang, LANG_INSTRUCTION[DEFAULT_LANG])
        
    prompt = f"""You are an expert English language pedagogy assistant helping a teacher understand a student's progress and provide personalized recommendations.

LANGUAGE RULE: {lang_instruction}

Student profile:
- Name: {student.get('name', username)}
- Level: {student.get('level', 'Nível não especificado')}
- Focus: {student.get('focus', 'Foco não especificado')}
- Created at: {student.get('created_at', 'Data de criação não especificada')}

Recent conversation history ({len(messages)} messages):
---
{history_text}
---

"Please analyze the student's messages to understand their current struggles, goals, and personal interests/hobbies."

Be specific and cite examples from the conversation. Keep the tone professional but warm.
Remember: {lang_instruction}

Based on the identified mistakes and confusion patterns, provide 3 to 5 specific, actionable recommendations for the teacher to help the student improve. For each recommendation, include a brief explanation and, if possible, an example of an exercise or activity that the teacher can assign to the student.
{{
    "recommendations": [
        "Focar em verbos irregulares → praticar com exercícios de verbos irregulares",
        "Melhorar escrita formal → escrever um email formal para a professora",
        "Aprimorar compreensão auditiva → ouvir podcasts em inglês e resumir os principais pontos",
        "Expandir vocabulário → aprender 5 palavras novas por semana e usá-las em frases"
    ],
    "interests": [
        "Viagens",
        "Música",
        "Tecnologia"
    ]
}}

Return valid JSON only. No markdown fences, comments or extra text."""

    try:
        result = await groq_chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.2,
        )
    except GroqKeyError as e:
        err = str(e).lower()
        if "invalid_api_key" in err or "401" in err:
            raise HTTPException(
                status_code=401,
                detail="Chave(s) GROQ inválida(s). Verifique o .env e gere novas chaves"
            )
        if "rate" in err or "429" in err:
            raise HTTPException(
                status_code=429,
                detail=f"Todas as {len(GROQ_KEYS)} chave(s) atingiram o limite. Aguarde e tente novamente."
            )
        raise HTTPException(status_code=500, detail=str(e))
    
    try:
        data = json.loads(_sanitize_json_block(result))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="A IA retornou um formato inválido para as recomendações e interesses dos alunos."
        )
        
    try:
        recommendations = data.get("recommendations", [])
        interests = data.get("interests", [])
        if not isinstance(recommendations, list) or not isinstance(interests, list):
            raise ValueError("Campos 'recommendations' e 'interests' devem ser listas.")
    except (ValueError, KeyError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"O formato do JSON retornado pela IA é inválido: {str(e)}"
        )
        
    return {
        "recommendations": recommendations,
        "interests": interests
    }
    
# Reports 
from collections import Counter
@router.get("/reports/overview")
async def get_overview_report(current_user: dict = Depends(_require_staff)):
    db = get_client()

    students = (
        db.table("users")
        .select("username")
        .eq("role", "student")
        .execute()
    )
    messages = (
        db.table("messages")
        .select("id")
        .eq("role", "user")
        .execute()
    )

    from datetime import date
    today = date.today().isoformat()
    active_today = (
        db.table("messages")
        .select("username")
        .eq("role", "user")
        .eq("date", today)
        .execute()
    )
    
    # contagem de níveis dos alunos para o gráfico de distribuição
    levels_list = [student.get("level", "unknown").lower() for student in students.data if student.get("level")]
    level_counts = dict(Counter(levels_list))
    
    final_levels = {
        "beginner": level_counts.get("beginner", 0),
        "pre-intermediate": level_counts.get("pre-intermediate", 0),
        "intermediate": level_counts.get("intermediate", 0),
        "business_english": level_counts.get("business_english", 0),
        "advanced": level_counts.get("advanced", 0),
        # nivel não mapeado:
        "outros": level_counts.get("unknown", 0)
    }

    return {
        "total_students": len(students.data),
        "total_messages": len(messages.data),
        "active_today":   len(set(m["username"] for m in active_today.data)),
        "level_distribution": final_levels
    }

@router.get("/difficulties")
async def get_overview_difficulties(current_user: dict = Depends(_require_staff)):
    try:
        print("A rota foi acessada!")
        db = get_client()
        students_with_difficulties = (
            db.table("users")
            .select("username, current_difficulty")
            .eq("role", "student")
            #.limit(10) # -> para evitar sobrecarga
            .execute()
        )
        alerts = []
        for student in students_with_difficulties.data:
            diff = student.get("current_difficulty")
            if diff and str(diff).lower() != "null" and str(diff).strip() != "":
                alerts.append(student)
        print(f"Alunos com dificuldades identificadas: {len(alerts)}")
        return {"alerts": alerts[:10]}  # limitando a 10 para evitar sobrecarga
    except Exception as e:
        print(f"Erro ao buscar dificuldades: {e}")
        return {"alerts": []}