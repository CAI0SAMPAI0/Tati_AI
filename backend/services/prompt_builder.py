from __future__ import annotations
from dataclasses import dataclass
from core.config import settings

"""
Constrói o prompt (system prompt) para a LLM, combinando instruções base, perfil do aluno, contexto RAG e custom prompt.
"""
@dataclass
class UserProfile:
    username: str
    level: str
    focus: str
    custom_prompt: str = ""


_LEVEL_RULES = {
    "Beginner": (
        "ADAPTATION RULES for BEGINNER:\n"
        "- Use EXTREMELY simple words and VERY short sentences.\n"
        "- Be VERY direct. Respond ONLY to what the student said.\n"
        "- NO details, NO complex explanations, and NO grammar lessons.\n"
        "- NEVER provide inline feedback (📝 Feedback). Just keep the conversation going.\n"
        "- If you don't understand, ask a very simple follow-up question."
    ),
    "Pre-Intermediate": (
        "ADAPTATION RULES for PRE-INTERMEDIATE:\n"
        "- Use simple language but slightly more elaborated than beginner.\n"
        "- Keep answers concise and clear (max 3 sentences).\n"
        "- No detailed feedback during chat.\n"
        "- Introduce basic phrasal verbs."
    ),
    "Intermediate": (
        "ADAPTATION RULES for INTERMEDIATE:\n"
        "- Speak naturally, use standard vocabulary.\n"
        "- Balanced responses, natural conversation flow.\n"
        "- Keep conversational replies clean (feedback goes to summary).\n"
        "- Introduce useful phrasal verbs and common idioms."
    ),
    "Advanced": (
        "ADAPTATION RULES for ADVANCED / BUSINESS:\n"
        "- Talk like a native speaker.\n"
        "- Use sophisticated idioms and complex vocabulary.\n"
        "- Full native-level responses with nuance and detail."
    )
}

_RAG_RULES = (
    "STRICT BEHAVIOR RULES:\n"
    "1. NEVER mention you have access to books or documents.\n"
    "2. NEVER copy source text word for word.\n"
    "3. Use library context only as silent inspiration.\n"
    "4. Keep responses natural and conversational.\n"
    "5. NEVER say 'Based on the text' or 'I removed references'.\n"
    "6. Just deliver the response and feedback naturally."
)


def build_profile_instruction(profile: UserProfile) -> str:
    level_rule = _LEVEL_RULES.get(profile.level, _LEVEL_RULES["Intermediate"])
    return (
        f"\n\n--- STUDENT PROFILE ---\n"
        f"English Level: {profile.level}\n"
        f"Main Focus: {profile.focus}\n\n"
        f"{level_rule}\n"
        f"- Always align examples with the student's Main Focus."
    )


def build_rag_instruction(contexto: str) -> str:
    if not contexto:
        return ""
    return (
        f"\n\n--- LIBRARY CONTEXT (RAG) ---\n"
        f"Use the context below to inform your response:\n"
        f"{contexto}\n\n"
        f"{_RAG_RULES}"
    )


def build_effective_prompt(profile: UserProfile, rag_context: str = "") -> str:
    """Monta o prompt final para a LLM."""
    parts = [
        settings.system_prompt,
        build_profile_instruction(profile),
        build_rag_instruction(rag_context),
    ]
    if profile.custom_prompt:
        parts.append(f"\n\nExtra instructions from teacher:\n{profile.custom_prompt}")
    return "".join(parts)