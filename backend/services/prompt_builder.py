from __future__ import annotations
from dataclasses import dataclass
from core.config import settings

"""
Constrói o prompt (system prompt) para a LLM, combinando instruções base, perfil do aluno, contexto RAG e custom prompt.
"""
@dataclass
class UserProfile:
    username: str
    name: str
    level: str
    focus: str
    custom_prompt: str = ""


_LEVEL_RULES = {
    "Beginner": (
        "ADAPTATION RULES for BEGINNER:\n"
        "- Use EXTREMELY simple words and VERY short sentences.\n"
        "- General response length: 15-20 words.\n"
        "- If the student asks for a story or history, you can expand up to 40 words using very simple language.\n"
        "- Be VERY direct. Respond ONLY to what the student said.\n"
        "- NO complex explanations and NO grammar lessons.\n"
        "- NEVER provide inline feedback markers. Just keep the conversation going.\n"
        "- If you don't understand, ask a very simple follow-up question."
    ),
    "Pre-Intermediate": (
        "ADAPTATION RULES for PRE-INTERMEDIATE:\n"
        "- Use simple language but slightly more elaborated than beginner.\n"
        "- General response length: 30-40 words.\n"
        "- If the student asks for detailed information or history, expand up to 80 words.\n"
        "- Keep answers concise and clear.\n"
        "- No detailed feedback during chat.\n"
        "- Introduce basic phrasal verbs."
    ),
    "Intermediate": (
        "ADAPTATION RULES for INTERMEDIATE:\n"
        "- Speak naturally, use standard vocabulary.\n"
        "- General response length: 60-80 words.\n"
        "- If the student asks for history, stories, or detailed explanations, expand up to 150 words.\n"
        "- Balanced responses, natural conversation flow.\n"
        "- Keep conversational replies clean.\n"
        "- Introduce useful phrasal verbs and common idioms."
    ),
    "Advanced": (
        "ADAPTATION RULES for ADVANCED / BUSINESS:\n"
        "- Talk like a native speaker.\n"
        "- Use sophisticated idioms and complex vocabulary.\n"
        "- Full native-level responses with nuance and detail.\n"
        "- No specific word limit; provide complete and rich information as requested."
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

_PODCAST_LOGIC = (
    "\n\n--- PODCAST & LISTENING LOGIC ---\n"
    "1. Regularly suggest English podcasts based on the student's level and interests.\n"
    "   - Beginner: '6 Minute English' (BBC), 'English Class 101'.\n"
    "   - Pre-Intermediate: 'English Learning for Curious Minds', 'Voice of America: Learning English'.\n"
    "   - Intermediate: 'The English We Speak', 'Ted Talks Daily', 'Better @ English'.\n"
    "   - Advanced: 'The Daily' (NYT), 'Joe Rogan Experience' (for culture), 'Philosophize This!', 'HBR IdeaCast'.\n"
    "2. Ask the student about their favorite topics and suggest specific podcast episodes.\n"
    "3. MANDATORY: Frequently propose listening and pronunciation exercises. Example: 'Listen to the first 2 minutes of [Podcast] and tell me what you understood' or 'Repeat this phrase from the episode to practice your intonation'.\n"
    "4. When the student sends audio messages, provide detailed feedback on their pronunciation, flow, and listening skills."
)


def build_profile_instruction(profile: UserProfile) -> str:
    level_rule = _LEVEL_RULES.get(profile.level, _LEVEL_RULES["Intermediate"])
    return (
        f"\n\n--- STUDENT PROFILE ---\n"
        f"Student Real Name: {profile.name}\n"
        f"English Level: {profile.level}\n"
        f"Main Focus: {profile.focus}\n\n"
        f"{level_rule}\n"
        f"- Always address the student by their Real Name ({profile.name}) occasionally to make it personal.\n"
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
        _PODCAST_LOGIC,
    ]
    if profile.custom_prompt:
        parts.append(f"\n\nExtra instructions from teacher:\n{profile.custom_prompt}")
    return "".join(parts)
