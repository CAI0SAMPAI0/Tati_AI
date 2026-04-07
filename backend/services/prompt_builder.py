from __future__ import annotations
from dataclasses import dataclass
from core.config import settings

"""
Constrói o prompt efetivo (system prompt) para a LLM, combinando instruções base, perfil do aluno, contexto RAG e custom prompt.
"""
@dataclass
class UserProfile:
    username: str
    level: str
    focus: str
    custom_prompt: str = ""


_LEVEL_RULES = (
    "ADAPTATION RULES:\n"
    "- Beginner: use extremely simple words, short sentences, explain slowly.\n"
    "- Intermediate: speak naturally, introduce useful phrasal verbs.\n"
    "- Advanced: talk like a native speaker, use idioms and complex vocabulary.\n"
    "- Always align examples with the student's Main Focus."
)

_RAG_RULES = (
    "STRICT BEHAVIOR RULES:\n"
    "1. NEVER mention you have access to books or documents.\n"
    "2. NEVER copy source text word for word.\n"
    "3. Use library context only as silent inspiration.\n"
    "4. Keep responses short, natural, conversational.\n"
    "5. NEVER say 'Based on the text' or 'I removed references'.\n"
    "6. Just deliver the response and feedback naturally."
)


def build_profile_instruction(profile: UserProfile) -> str:
    return (
        f"\n\n--- STUDENT PROFILE ---\n"
        f"English Level: {profile.level}\n"
        f"Main Focus: {profile.focus}\n\n"
        f"{_LEVEL_RULES}"
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