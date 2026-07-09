from __future__ import annotations
import asyncio
import logging
from dataclasses import dataclass
from app.core.config import settings
from app.core.enums import normalize_level


"""
Constrói o prompt (system prompt) para a LLM, combinando instruções base, perfil do aluno, contexto RAG e custom prompt.
"""


@dataclass
class UserProfile:
    username: str
    name: str
    level: str
    focus: str
    custom_prompt: str = ''


_LEVEL_RULES = {
    'A1': (
        'ADAPTATION RULES for A1 (Beginner):\n'
        '- Use EXTREMELY simple words and VERY short sentences.\n'
        '- General response length: 15-20 words.\n'
        '- If the student asks for a story or history, you can expand up to 40 words using very simple language.\n'
        '- Be VERY direct. Respond ONLY to what the student said.\n'
        '- NO complex explanations and NO grammar lessons.\n'
        '- NEVER provide inline feedback markers. Just keep the conversation going.\n'
        "- If you don't understand, ask a very simple follow-up question."),
    'A2': (
        'ADAPTATION RULES for A2 (Pre-Intermediate):\n'
        '- Use simple language but slightly more elaborated than beginner.\n'
        '- General response length: 30-40 words.\n'
        '- If the student asks for detailed information or history, expand up to 80 words.\n'
        '- Keep answers concise and clear.\n'
        '- No detailed feedback during chat.\n'
        '- Introduce basic phrasal verbs.'),
    'B1': (
        'ADAPTATION RULES for B1 (Intermediate):\n'
        '- Speak naturally, use standard vocabulary.\n'
        '- General response length: 60-80 words.\n'
        '- If the student asks for history, stories, or detailed explanations, expand up to 150 words.\n'
        '- Balanced responses, natural conversation flow.\n'
        '- Keep conversational replies clean.\n'
        '- Introduce useful phrasal verbs and common idioms.'),
    'B2': (
        'ADAPTATION RULES for B2 (Upper-Intermediate):\n'
        '- Speak naturally and fluently.\n'
        '- General response length: 80-100 words.\n'
        '- Encourage student to use more complex sentence structures.\n'
        '- Introduce advanced idioms and phrasal verbs.'),
    'C1': (
        'ADAPTATION RULES for C1 (Advanced):\n'
        '- Talk like a native speaker.\n'
        '- Use sophisticated idioms and complex vocabulary.\n'
        '- Full native-level responses with nuance and detail.\n'
        '- No specific word limit; provide complete and rich information as requested.'),
    'C2': (
        'ADAPTATION RULES for C2 (Mastery / Proficiency):\n'
        '- Talk like a highly articulate native speaker.\n'
        '- Use sophisticated grammar, advanced vocabulary, and precise nuances.\n'
        '- Engage in complex, high-level abstract discussions.'),
}

_RAG_RULES = (
    'STRICT BEHAVIOR RULES:\n'
    '1. NEVER mention you have access to books or documents.\n'
    '2. NEVER copy source text word for word.\n'
    '3. Use library context only as silent inspiration.\n'
    '4. Keep responses natural and conversational.\n'
    "5. NEVER say 'Based on the text' or 'I removed references'.\n"
    '6. Just deliver the response and feedback naturally.'
)

_PODCAST_LOGIC_TEMPLATE = (
    '\n\n--- PODCAST & LISTENING LOGIC ---\n'
    "1. Regularly suggest English podcasts based on the student's level and interests.\n"
    '   - Real recommendations available for this student: {podcasts_list}\n'
    '2. Ask the student about their favorite topics and suggest specific podcast episodes from the list above.\n'
    "3. MANDATORY: Frequently propose listening and pronunciation exercises. Example: 'Listen to the first 2 minutes of [Podcast Name] and tell me what you understood'.\n"
    '4. When the student sends audio messages, provide feedback on their pronunciation, flow, and listening skills.\n'
    '   - CRITICAL: When a pronunciation mistake is detected, identify the word/phrase, state that the pronunciation needs improvement, provide ONLY the correctly spelled word or phrase, and ask the student to repeat it. (e.g., "You need to improve the pronunciation of \'architect\'. Listen and repeat: architect." or "Good try. Let\'s practice this word again: architect.").\n'
    '   - DO NOT provide IPA symbols, phonetic transcriptions, sound decomposition, syllable spelling, pronunciation approximations, or written sound representations (no "Ah-kee-tekt", no "Sh-she", no "/ʃiː/").\n'
    '   - DO NOT transform pronunciation corrections into a phonetics lesson or explanation.'
)


def build_profile_instruction(profile: UserProfile) -> str:
    lvl = normalize_level(profile.level)
    level_rule = _LEVEL_RULES.get(lvl, _LEVEL_RULES['B1'])
    return (
        f'\n\n--- STUDENT PROFILE ---\n'
        f'Student Real Name: {profile.name}\n'
        f'English Level: {lvl}\n'
        f'Main Focus: {profile.focus}\n\n'
        f'{level_rule}\n'
        f'- Do NOT mention the student\'s name ({profile.name}) after the initial greeting/first message of the conversation. Never repeat their name in subsequent messages.\n'
        f"- Always align examples with the student's Main Focus."
    )


def build_rag_instruction(contexto: str) -> str:
    if not contexto:
        return ''
    return (
        f'\n\n--- LIBRARY CONTEXT (RAG) ---\n'
        f'Use the context below to inform your response:\n'
        f'{contexto}\n\n'
        f'{_RAG_RULES}'
    )


def build_effective_prompt(
        profile: UserProfile,
        rag_context: str = '',
        real_podcasts: list[dict] = None) -> str:
    """Monta o prompt final para a LLM."""

    if real_podcasts:
        pod_strings = [
            f"'{p['title']}' ({p['category']})" for p in real_podcasts[:5]]
        podcasts_list = ', '.join(pod_strings)
    else:
        # Fallback para exemplos genéricos se não houver nada no banco
        podcasts_list = 'BBC 6 Minute English, Ted Talks Daily, Voice of America'

    podcast_instruction = _PODCAST_LOGIC_TEMPLATE.format(
        podcasts_list=podcasts_list)

    parts = [
        settings.system_prompt,
        build_profile_instruction(profile),
        build_rag_instruction(rag_context),
        podcast_instruction,
    ]
    if profile.custom_prompt:
        # Validate the custom prompt for jailbreak attempts
        try:
            from app.modules.chat.services.prompt_validator import validate_prompt
            # Run async validator — if already in async context this is safe
            try:
                loop = asyncio.get_running_loop()
                import concurrent.futures
                # Can't await inside a sync function; use thread-safe check
                validation = loop.run_until_complete(validate_prompt(profile.custom_prompt)) if not loop.is_running() else None
            except RuntimeError:
                validation = None

            if validation is None:
                # Async context: skip blocking check, trust regex was run at save-time
                validation = {"is_safe": True}

            if not validation.get("is_safe", True):
                logging.warning(
                    f"[PromptValidator] Unsafe prompt detected for {profile.username}: "
                    f"{validation.get('reason', 'unknown reason')}"
                )
            else:
                parts.append(
                    f'\n\nExtra instructions from teacher:\n{profile.custom_prompt}')
        except Exception as e:
            logging.warning(f"[PromptValidator] Validation error for {profile.username}: {e}")
            parts.append(
                f'\n\nExtra instructions from teacher:\n{profile.custom_prompt}')
    return ''.join(parts)


def build_exercise_prompt(
        error_context: str,
        exercise_type: str = 'quiz',
        targets: list[dict] | None = None,
        user_level: str = 'B1') -> str:
    """
    Constrói um prompt focado para geração de exercícios a partir de um contexto de erros.
    Garante instruções estritas: usar somente os padrões fornecidos, não usar rótulos A/B/C/D
    e retornar apenas JSON válido.
    """
    user_level = normalize_level(user_level)
    if not targets:
        targets = []

    type_map = {
        'quiz': 'Create 5 multiple-choice questions targeting EXACTLY these specific error patterns.',
        'story': 'Write a SHORT story (5-8 sentences) that incorporates the grammar structures and create 3 comprehension questions.',
        'fill_in': 'Create 5 fill-in-the-blank sentences targeting these specific mistakes.',
        'dialogue': 'Write a short dialogue (6-8 lines) demonstrating correct usage and create 3 questions.',
    }

    instr = type_map.get(exercise_type, type_map['quiz'])

    prompt = f"""You are an expert English teacher for a student at the {user_level} level.
Your goal is to generate exercises that EXCLUSIVELY target the student's specific English mistakes provided below.

ERROR PATTERNS TO TARGET:
{error_context}

INSTRUCTION:
{instr}

STRICT CONSTRAINTS:
1. THE EXERCISE CONTENT (QUESTIONS AND OPTIONS) MUST BE ENTIRELY IN ENGLISH.
2. DO NOT generate general English questions (like "How are you?", "What is your name?").
3. DO NOT use examples from your internal knowledge unless they directly relate to the patterns above.
4. EVERY question must specifically test the student's ability to distinguish between the "Incorrect" and "Correct" forms provided in the patterns.
5. FOR GRAMMAR ERRORS (like Subject-Verb Agreement, Verb Tenses): Use "fill-in-the-blank" format. Example: "I ____ (am/are/is) a student."
6. THE INCORRECT FORMS must be present as distractors.
7. DO NOT use labels like 'A)', 'B)', 'C)', 'D)' in the options. Return ONLY the plain text of the options.
8. Return ONLY valid JSON.
9. If the student made a mistake like "I are", the question MUST be about that specific subject-verb agreement.
10. THE EXPLANATION MUST BE IN ENGLISH and explain WHY the incorrect form was wrong based on the specific pattern.
11. DO NOT include the correct answer in the question text.
12. ADJUST THE DIFFICULTY to match a {user_level} student. Use appropriate vocabulary and sentence complexity.
13. If the student is at A1/A2, keep sentences very short. If at C1/C2, use more natural and complex contexts.
14. ALL FIELDS (title, description, questions, options AND explanations) MUST BE ENTIRELY IN ENGLISH. Never use Portuguese.

Return example shape:
{
        "title": "...", "description": "...", "exercises": [{
            "question": "...", "options": ["...","..."], "correct_index": 0, "explanation": "...", "target_pattern": "pattern_key"} ]} """

    return prompt
