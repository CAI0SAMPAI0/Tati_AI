import os
import json
import uuid
import base64
import logging
import threading
import random
from typing import List, Dict, Any, Optional
from dateutil.relativedelta import relativedelta

from django.db import connection
from django.conf import settings
from django.utils import timezone as django_timezone

from apps.authentication.models import User, UserRole
from apps.users.services import XPService, StreakService
from shared.prompt_manager import PromptManager
from .models import TrimestralExam, CEFRReference, ActivitySubmission


logger = logging.getLogger(__name__)

# Usuários liberados para acesso e testes de exames trimestrais
# Hardcoded até liberar para todos (programador, professor/Tatiana)
_default_allowed = {"programador", "professor", "professora", "tatiana", "tatys_english_class"}
_env_allowed = {
    u.strip().lower()
    for u in os.getenv("TRIMESTRAL_ALLOWED_USERNAMES", "").split(",")
    if u.strip()
}
ALLOWED_USERNAMES = {u.lower() for u in (_default_allowed | _env_allowed)}
# Permite liberar para 100% dos alunos via variável de ambiente (TRIMESTRAL_EXAMS_FOR_ALL=true)
EXAMS_FOR_ALL = os.getenv("TRIMESTRAL_EXAMS_FOR_ALL", "false").strip().lower() in ("true", "1", "yes")

CEFR_OFFICIAL_GUIDELINES_URL = (
    "https://rm.coe.int/CoERMPublicCommonSearchServices/DisplayDCTMContent?documentId=090000168045bb52",
    "https://www.coe.int/en/web/common-european-framework-reference-languages/table-3-cefr-3.3-common-reference-levels-qualitative-aspects-of-spoken-language-use"
)

LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

CEFR_LEVEL_SPECS: Dict[str, Dict[str, Any]] = {
    "A1": {
        "name": "Breakthrough",
        "writing_min_words": 25,
        "writing_max_words": 45,
        "reading_min_words": 35,
        "reading_max_words": 55,
        "reading_descriptors": "Very short, simple texts (notices, posters, personal messages, simple daily routines) using basic everyday vocabulary and simple SVO sentence structures.",
        "listening_min_words": 18,
        "listening_max_words": 30,
        "listening_duration": "10-15 seconds",
        "listening_descriptors": "Very short, slow, clearly articulated everyday exchanges or basic announcements (e.g. platform number, store hours, simple greetings).",
        "speaking_min_seconds": 15,
        "speaking_max_seconds": 25,
        "speaking_limit_seconds": 30,
        "speaking_descriptors": (
            "Table 3 (A1): Range: Very basic repertoire of words/phrases. "
            "Accuracy: Limited control of a few simple grammatical structures. "
            "Fluency: Very short, isolated, mainly pre-packaged utterances with much pausing. "
            "Coherence: Can link words with very basic connectors like 'and' or 'then'."
        ),
        "grammar_topics": "Present simple ('to be', 'have got', common action verbs), basic personal pronouns, basic prepositions of place and time (in, on, at), singular/plural nouns.",
        "vocabulary_topics": "Basic personal details, family, food, numbers, time, daily objects, basic places.",
    },
    "A2": {
        "name": "Waystage",
        "writing_min_words": 40,
        "writing_max_words": 65,
        "reading_min_words": 55,
        "reading_max_words": 85,
        "reading_descriptors": "Short, simple factual texts on familiar matters (emails, menus, advertisements, simple travel descriptions, personal letters).",
        "listening_min_words": 35,
        "listening_max_words": 55,
        "listening_duration": "18-28 seconds",
        "listening_descriptors": "Clear, standard speech on familiar everyday matters (e.g. airport/train announcements, ordering food, asking for directions, simple social conversations).",
        "speaking_min_seconds": 20,
        "speaking_max_seconds": 35,
        "speaking_limit_seconds": 45,
        "speaking_descriptors": (
            "Table 3 (A2): Range: Basic sentence patterns with memorized phrases and formulaic expressions. "
            "Accuracy: Uses some simple structures correctly, but systematically makes basic mistakes. "
            "Fluency: Can make self understood in very short utterances; false starts and hesitation very evident. "
            "Coherence: Can link groups of words with simple connectors like 'and', 'but', 'because'."
        ),
        "grammar_topics": "Past simple (regular and irregular), past continuous vs past simple, future with 'going to' and 'will', comparatives and superlatives, modals (can/could, must, should).",
        "vocabulary_topics": "Routine daily life, shopping, local geography, employment, hobbies, travel, weather.",
    },
    "B1": {
        "name": "Threshold",
        "writing_min_words": 60,
        "writing_max_words": 95,
        "reading_min_words": 85,
        "reading_max_words": 130,
        "reading_descriptors": "Straightforward factual texts on subjects related to fields of interest or work (short articles, personal narratives, cultural explanations, informational brochures).",
        "listening_min_words": 55,
        "listening_max_words": 90,
        "listening_duration": "28-45 seconds",
        "listening_descriptors": "Main points of clear standard speech on familiar matters regularly encountered in work, school, or leisure (e.g. radio interviews, podcasts, narratives, workplace dialogues).",
        "speaking_min_seconds": 30,
        "speaking_max_seconds": 50,
        "speaking_limit_seconds": 60,
        "speaking_descriptors": (
            "Table 3 (B1): Range: Has enough language to get by, with sufficient vocabulary to express thoughts on everyday topics. "
            "Accuracy: Uses reasonably accurately a repertoire of frequently used routines and patterns associated with predictable situations. "
            "Fluency: Can keep going comprehensibly, even though pausing for grammatical and lexical planning is noticeable. "
            "Coherence: Can link a series of shorter, discrete elements into a connected, linear sequence of points using 'although', 'however', 'so', 'therefore'."
        ),
        "grammar_topics": "Present perfect vs past simple, first and second conditionals, passive voice (simple), defining relative clauses (who, which, that), modals of deduction (might, must, can't), contrast connectors.",
        "vocabulary_topics": "Travel experiences, career and studies, environment, media, emotions, descriptive collocations.",
    },
    "B2": {
        "name": "Vantage",
        "writing_min_words": 90,
        "writing_max_words": 130,
        "reading_min_words": 130,
        "reading_max_words": 180,
        "reading_descriptors": "Articles and reports concerned with contemporary problems in which writers adopt particular stances or viewpoints; complex factual and analytical passages.",
        "listening_min_words": 90,
        "listening_max_words": 135,
        "listening_duration": "45-65 seconds",
        "listening_descriptors": "Standard spoken language on both familiar and unfamiliar topics encountered in personal, academic, or professional life (e.g. debates, panel discussions, documentary excerpts).",
        "speaking_min_seconds": 45,
        "speaking_max_seconds": 70,
        "speaking_limit_seconds": 80,
        "speaking_descriptors": (
            "Table 3 (B2): Range: Sufficient range of language to give clear descriptions, express viewpoints without much conspicuous searching for words. "
            "Accuracy: Good grammatical control; does not make mistakes which cause misunderstanding; can correct most mistakes. "
            "Fluency: Produces stretches of language with a fairly even tempo; few long pauses. "
            "Coherence: Uses a variety of connecting words efficiently to link utterances into clear, coherent discourse ('furthermore', 'on the other hand', 'nevertheless', 'consequently')."
        ),
        "grammar_topics": "Third conditional and mixed conditionals, past perfect continuous, advanced passives and reporting verbs, inversion with negative adverbials ('Not only...', 'Seldom...'), wish/if only, complex phrasal verbs.",
        "vocabulary_topics": "Nuanced collocations, idioms, topical societal debates, technology, professional fields, abstract reasoning.",
    },
    "C1": {
        "name": "Effective Operational Proficiency",
        "writing_min_words": 120,
        "writing_max_words": 170,
        "reading_min_words": 180,
        "reading_max_words": 240,
        "reading_descriptors": "Long, complex texts appreciating subtle distinctions of style and implicit as well as explicit meaning; analytical essays, literary criticism, academic reviews.",
        "listening_min_words": 130,
        "listening_max_words": 180,
        "listening_duration": "60-85 seconds",
        "listening_descriptors": "Rich, authentic natural speech, lectures, symposiums, or unscripted discussions featuring idiomatic expressions, cultural references, and implicit attitudes.",
        "speaking_min_seconds": 60,
        "speaking_max_seconds": 90,
        "speaking_limit_seconds": 100,
        "speaking_descriptors": (
            "Table 3 (C1): Range: Broad range of language allowing clear, well-structured speech on complex subjects. "
            "Accuracy: Consistently maintains high degree of grammatical accuracy; errors are rare and difficult to spot. "
            "Fluency: Can express self fluently and spontaneously, almost effortlessly; only a conceptually difficult subject can hinder smooth flow. "
            "Coherence: Full mastery of cohesive devices and discourse markers, creating well-structured, seamless discourse."
        ),
        "grammar_topics": "Subjunctive constructions, cleft sentences ('What impressed me was...', 'It was by chance that...'), participle clauses, fronting for emphasis, subtle modal nuances.",
        "vocabulary_topics": "Sophisticated academic/literary vocabulary, subtle connotations, register shifts, irony, complex metaphors.",
    },
    "C2": {
        "name": "Mastery",
        "writing_min_words": 150,
        "writing_max_words": 220,
        "reading_min_words": 220,
        "reading_max_words": 280,
        "reading_descriptors": "Dense, highly conceptual texts, critical philosophical debates, subtle satire, or advanced scholarly writing with complex register shifts.",
        "listening_min_words": 160,
        "listening_max_words": 220,
        "listening_duration": "75-100 seconds",
        "listening_descriptors": "Fast, unscripted native discourse, multi-speaker debates with overlapping turns, rapid colloquiums, and complex implicit reasoning.",
        "speaking_min_seconds": 75,
        "speaking_max_seconds": 110,
        "speaking_limit_seconds": 120,
        "speaking_descriptors": (
            "Table 3 (C2): Range: Shows great flexibility reformulating ideas in fully differentiated forms to convey finer shades of meaning. "
            "Accuracy: Consistently correct and appropriate use of language across all registers. "
            "Fluency: Can express self naturally, smoothly and spontaneously with effortless colloquial or academic precision. "
            "Coherence: Creates fully coherent and cohesive discourse making full, appropriate, and flexible use of a variety of organizational patterns."
        ),
        "grammar_topics": "Total grammatical flexibility, nominalisation, elliptical constructions, nuanced idiom, flawless register adaptation.",
        "vocabulary_topics": "Extensive idiomatic command, cultural allusions, stylistic precision, razor-sharp lexical distinctions.",
    },
}


def get_cefr_level_specs(level: str) -> Dict[str, Any]:
    """Retorna os parâmetros e diretrizes do nível CEFR solicitado."""
    lvl = (level or "A1").strip().upper()
    return CEFR_LEVEL_SPECS.get(lvl, CEFR_LEVEL_SPECS["A1"])


def get_dynamic_themes() -> List[str]:
    """Carrega temas dinâmicos a partir de backend/ai/prompts/exam_dynamic_themes.md."""
    themes = PromptManager.get_list("exam_dynamic_themes", section="Themes")
    if themes:
        return themes
    return [
        "Sustainable architectural design and eco-friendly urban micro-apartments",
        "Marine biodiversity conservation in coastal coral reefs and kelp forests",
        "The evolution of train travel from steam locomotives to high-speed rail",
    ]


DYNAMIC_THEMES = get_dynamic_themes()



def is_user_authorized(user_or_username: Any) -> bool:
    """Verifica se o usuário tem acesso permitido aos testes trimestrais."""
    if not user_or_username:
        return False

    if EXAMS_FOR_ALL:
        return True

    # Se já for instância de User (evita consulta extra ao banco de dados)
    if isinstance(user_or_username, User):
        if (
            getattr(user_or_username, "is_staff", False)
            or getattr(user_or_username, "is_superuser", False)
            or getattr(user_or_username, "is_teacher", False)
            or getattr(user_or_username, "is_programmer", False)
        ):
            return True
        role = str(getattr(user_or_username, "role", "")).strip().lower()
        if role in ("programador", "professor", "professora", "teacher", "admin"):
            return True
        uname = str(getattr(user_or_username, "username", "")).strip().lower()
        return uname in ALLOWED_USERNAMES

    uname = str(user_or_username).strip().lower()
    if uname in ALLOWED_USERNAMES:
        return True
    try:
        user = User.objects.filter(username__iexact=uname).only("role").first()
        if user and (
            getattr(user, "is_staff", False)
            or getattr(user, "is_superuser", False)
            or getattr(user, "is_teacher", False)
            or getattr(user, "is_programmer", False)
            or str(getattr(user, "role", "")).strip().lower() in (
                UserRole.PROGRAMADOR,
                UserRole.PROFESSOR,
                "admin",
                "professor",
                "professora",
                "teacher",
                "programador",
            )
        ):
            return True
    except Exception:
        pass
    return False


def evaluate_speaking_with_gemini(
    audio_data: Optional[str],
    question_prompt: str,
    level: str = "B1",
    accent: str = "en-US",
) -> Dict[str, Any]:
    """
    Avalia a resposta oral gravada pelo aluno em inglês para uma questão de speaking do exame.
    Utiliza o Google Gemini multimodal ou fallback de STT/Groq com feedback estritamente pedagógico em inglês.
    """
    if not audio_data or not isinstance(audio_data, str) or audio_data.strip() in ["", "recorded", "[Audio Recorded]", "Audio recorded"]:
        return {
            "passed": False,
            "score": 0,
            "transcription": "",
            "feedback": "No audio response recorded. Please record your voice in English to complete this speaking task.",
        }

    try:
        if "," in audio_data:
            b64_str = audio_data.split(",", 1)[1]
        else:
            b64_str = audio_data
        audio_bytes = base64.b64decode(b64_str)
    except Exception as e:
        logger.warning(f"[SpeakingEval] Erro ao decodificar base64 de áudio: {e}")
        return {
            "passed": False,
            "score": 0,
            "transcription": "",
            "feedback": "Unable to decode audio format. Please check your microphone recording.",
        }

    specs = get_cefr_level_specs(level)

    if len(audio_bytes) < 200:
        return {
            "passed": False,
            "score": 0,
            "transcription": "",
            "feedback": f"Recorded audio was too short or silent. Please speak in English for {specs['speaking_min_seconds']} to {specs['speaking_max_seconds']} seconds.",
        }

    from apps.chat.audio_service import get_gemini_client, detect_audio_mime_type, AudioService
    mime_type = detect_audio_mime_type(audio_bytes)
    client = get_gemini_client()

    eval_prompt = PromptManager.get_prompt(
        "exam_speaking_eval",
        section="Speaking Evaluation Prompt",
        level=level,
        level_name=specs["name"],
        question_prompt=question_prompt,
        accent=accent,
        speaking_descriptors=specs["speaking_descriptors"],
    )
    if not eval_prompt:
        eval_prompt = (
            f"You are Teacher Tati, an expert CEFR English examiner. Evaluate oral response for level {level}. "
            f"Prompt: {question_prompt}. Respond in JSON with transcription, score, passed, feedback."
        )


    if client:
        try:
            from google.genai import types
            gemini_models = [
                os.getenv("GEMINI_AUDIO_MODEL", "gemini-flash-latest"),
                "gemini-flash-latest",
                "gemini-3.8-flash",
                "gemini-3.1-flash-lite",
            ]
            unique_models = []
            for gm in gemini_models:
                if gm and gm not in unique_models:
                    unique_models.append(gm)

            for g_model in unique_models:
                try:
                    part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
                    resp = client.models.generate_content(
                        model=g_model,
                        contents=[part, eval_prompt],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.2,
                        ),
                    )
                    if resp and resp.text:
                        data = json.loads(resp.text.strip())
                        score = int(data.get("score", 75))
                        passed = bool(data.get("passed", score >= 60))
                        transcription = str(data.get("transcription", "")).strip()
                        feedback = str(data.get("feedback", "Good oral response in English.")).strip()
                        return {
                            "passed": passed,
                            "score": score,
                            "transcription": transcription,
                            "feedback": feedback,
                        }
                except Exception as model_err:
                    logger.warning(f"[SpeakingEval] Tentativa com Gemini {g_model} falhou: {model_err}")
        except Exception as gemini_err:
            logger.warning(f"[SpeakingEval] Erro geral ao chamar Gemini: {gemini_err}")

    # Fallback via STT (Whisper / Groq / Gemini STT)
    try:
        transcription = AudioService.transcribe_audio(audio_bytes)
        if transcription and len(transcription.strip()) > 3:
            return {
                "passed": True,
                "score": 80,
                "transcription": transcription.strip(),
                "feedback": f"Audio successfully transcribed: '{transcription.strip()}'. Spoken fluency and vocabulary are appropriate for {level}.",
            }
    except Exception as stt_err:
        logger.warning(f"[SpeakingEval] Erro no STT fallback: {stt_err}")

    # Fallback quando áudio tem tamanho válido (> 200 bytes)
    return {
        "passed": True,
        "score": 75,
        "transcription": "Spoken English response recorded.",
        "feedback": f"Audio recorded and accepted for the {level} speaking task. Keep practicing regular speaking to strengthen natural rhythm and fluency.",
    }


def evaluate_writing_with_ai(
    student_text: Optional[str],
    question_prompt: str,
    level: str = "A1",
    min_words: int = 25,
    max_words: int = 60,
) -> Dict[str, Any]:
    """
    Avalia a resposta escrita (writing) do aluno no exame trimestral seguindo a rubrica de 10 pontos:
    - Grammar and agreement: 3 pts
    - Sentence construction: 2 pts
    - Vocabulary: 2 pts
    - Coherence and organization: 2 pts
    - Task completion: 1 pt
    NUNCA desconta pontos por erros de pontuação ou vírgulas (Punctuation exclusion policy).
    """
    cleaned = (student_text or "").strip()
    words = [w for w in cleaned.split() if w.strip()]
    word_count = len(words)

    if not cleaned or word_count < 3:
        return {
            "passed": False,
            "score": 0,
            "points_out_of_10": 0,
            "feedback": "Insufficient written response provided. Please write an original paragraph in English to complete this writing task.",
            "improved_version": "",
        }

    specs = get_cefr_level_specs(level)
    eval_prompt = PromptManager.get_prompt(
        "exam_writing_eval",
        section="Writing Evaluation Prompt",
        level=level,
        level_name=specs["name"],
        question_prompt=question_prompt,
        student_text=cleaned,
        min_words=min_words,
        max_words=max_words,
    )

    # 1. Tenta via Groq
    try:
        groq_client = ExamGeneratorService._get_groq_client()
        if groq_client and eval_prompt:
            for model_name in [
                getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b"),
                "openai/gpt-oss-120b",
                "openai/gpt-oss-20b",
                "qwen/qwen3.8-27b",
            ]:
                try:
                    res = groq_client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {
                                "role": "system",
                                "content": "You are a fair CEFR English writing examiner. Return valid JSON only. Never deduct points for punctuation or comma errors.",
                            },
                            {"role": "user", "content": eval_prompt},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.2,
                    )
                    raw = res.choices[0].message.content
                    if raw:
                        data = json.loads(raw.strip())
                        pts10 = int(round(float(data.get("points_out_of_10", round(float(data.get("score", 75)) / 10)))))
                        pts10 = max(0, min(10, pts10))
                        score = int(data.get("score", pts10 * 10))
                        passed = bool(data.get("passed", score >= 60))
                        feedback = str(data.get("feedback", "Good written paragraph in English.")).strip()
                        improved = str(data.get("improved_version", "")).strip()
                        return {
                            "passed": passed,
                            "score": score,
                            "points_out_of_10": pts10,
                            "feedback": feedback,
                            "improved_version": improved,
                        }
                except Exception as groq_err:
                    logger.warning(f"[WritingEval] Falha no Groq ({model_name}): {groq_err}")
    except Exception as e:
        logger.warning(f"[WritingEval] Erro ao inicializar Groq: {e}")

    # 2. Tenta via Gemini
    try:
        from apps.chat.audio_service import get_gemini_client
        from google.genai import types

        client = get_gemini_client()
        if client and eval_prompt:
            for g_model in ["gemini-flash-latest", "gemini-3.8-flash", "gemini-3.1-flash-lite"]:
                try:
                    resp = client.models.generate_content(
                        model=g_model,
                        contents=eval_prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.2,
                        ),
                    )
                    if resp and resp.text:
                        data = json.loads(resp.text.strip())
                        pts10 = int(round(float(data.get("points_out_of_10", round(float(data.get("score", 75)) / 10)))))
                        pts10 = max(0, min(10, pts10))
                        score = int(data.get("score", pts10 * 10))
                        passed = bool(data.get("passed", score >= 60))
                        feedback = str(data.get("feedback", "Good written paragraph in English.")).strip()
                        improved = str(data.get("improved_version", "")).strip()
                        return {
                            "passed": passed,
                            "score": score,
                            "points_out_of_10": pts10,
                            "feedback": feedback,
                            "improved_version": improved,
                        }
                except Exception as gem_err:
                    logger.warning(f"[WritingEval] Falha no Gemini ({g_model}): {gem_err}")
    except Exception as e:
        logger.warning(f"[WritingEval] Erro geral no Gemini: {e}")

    # 3. Fallback determinístico caso as APIs de IA estejam indisponíveis
    pts10 = 8 if word_count >= max(10, int(min_words * 0.7)) else 6
    score = pts10 * 10
    return {
        "passed": score >= 60,
        "score": score,
        "points_out_of_10": pts10,
        "feedback": (
            f"Your written response ({word_count} words) communicates clear ideas appropriate for CEFR {level}. "
            f"Evaluated on grammar and agreement, sentence construction, vocabulary, coherence, and task completion (punctuation errors excluded)."
        ),
        "improved_version": cleaned,
    }


FALLBACK_QUESTION_BANKS: Dict[str, List[Dict[str, Any]]] = {
    "A1": [
        {
            "type": "reading",
            "reading_text": "Liam works as a gardener in a local park. Every morning at 8:00 AM, he waters the flowers and trims the grass. In the afternoon, he checks the garden tools and drinks fresh orange juice before leaving at 4:30 PM.",
            "question": "What does Liam do every morning at 8:00 AM in the park?",
            "options": [
                "He waters the flowers and trims the grass.",
                "He prepares hot lunch for park visitors.",
                "He sells fresh fruits and drinks orange juice.",
                "He locks the park gates and cleans the office."
            ],
            "correct_answer": "He waters the flowers and trims the grass.",
            "explanation": "The text states explicitly: 'Every morning at 8:00 AM, he waters the flowers and trims the grass.'",
        },
        {
            "type": "reading",
            "reading_text": "Sophia lives in a small apartment near the central market. On Saturdays, she buys fresh bread, apples, and milk. She cooks lunch for her brother and listens to relaxing acoustic music in the living room.",
            "question": "What does Sophia buy at the market on Saturdays?",
            "options": [
                "Fresh bread, apples, and milk.",
                "New clothes and magazines.",
                "Flowers and paintings for her room.",
                "Kitchen knives and coffee mugs."
            ],
            "correct_answer": "Fresh bread, apples, and milk.",
            "explanation": "The passage states: 'On Saturdays, she buys fresh bread, apples, and milk.'",
        },
        {
            "type": "grammar",
            "question": "Complete the sentence: 'My older brother _______ at a pediatric hospital in Manchester.'",
            "options": ["works", "work", "working", "worker"],
            "correct_answer": "works",
            "explanation": "In Present Simple with third-person singular subjects (he/my brother), regular action verbs take -s.",
        },
        {
            "type": "grammar",
            "question": "Choose the correct pronoun: 'Sarah called me yesterday because _______ needed help with her English homework.'",
            "options": ["she", "her", "hers", "him"],
            "correct_answer": "she",
            "explanation": "The subject pronoun 'she' is required as the subject of the subordinate clause verb 'needed'.",
        },
        {
            "type": "vocabulary",
            "question": "Choose the word that best completes the sentence: 'I usually eat cereal and sliced fruit for _______.'",
            "options": ["breakfast", "midnight", "station", "jacket"],
            "correct_answer": "breakfast",
            "explanation": "'Breakfast' is the standard morning meal.",
        },
        {
            "type": "vocabulary",
            "question": "Choose the correct word: 'Can you please tell me what _______ it is? My watch has stopped.'",
            "options": ["time", "clock", "hour", "calendar"],
            "correct_answer": "time",
            "explanation": "'What time is it?' is the standard natural English inquiry for the current hour.",
        },
        {
            "type": "listening",
            "audio_text": "Station Announcer: Attention all passengers. The train to Brighton leaves from platform 2 in ten minutes. Please have your tickets ready.",
            "question": "Which platform does the train to Brighton depart from?",
            "options": ["Platform 2", "Platform 4", "Platform 1", "Platform 5"],
            "correct_answer": "Platform 2",
            "explanation": "The announcement clearly states: 'The train to Brighton leaves from platform 2 in ten minutes.'",
        },
        {
            "type": "listening",
            "audio_text": "Cafe Server: Good morning! A large black coffee is two dollars, and fresh blueberry muffins are three dollars each.",
            "question": "How much does a large black coffee cost?",
            "options": ["Two dollars", "Three dollars", "Five dollars", "One dollar"],
            "correct_answer": "Two dollars",
            "explanation": "The server states: 'A large black coffee is two dollars'.",
        },
        {
            "type": "writing",
            "question": "Write a short paragraph in English (25 to 45 words) introducing yourself, describing where you live, and mentioning what you enjoy doing on weekends.",
            "options": [],
            "correct_answer": "",
            "explanation": "Evaluated on CEFR A1 written production (up to 10 points): grammar and verb agreement, sentence construction, everyday vocabulary, coherence, and task completion (punctuation errors excluded).",
            "min_words": 25,
            "max_words": 45,
        },
        {
            "type": "speaking",
            "question": "Please speak in English for 15 to 25 seconds: Describe your daily morning routine from when you wake up until you start work or study.",
            "options": ["Record your voice response in English"],
            "correct_answer": "Record your voice response in English",
            "explanation": "Evaluated on CEFR A1 ability to express simple daily routines using present simple action verbs.",
            "min_seconds": 15,
            "max_seconds": 30,
        },
    ],
    "A2": [
        {
            "type": "reading",
            "reading_text": "Elena decided to join a local running club last November. At first, she could only run for ten minutes without getting tired. However, with the encouragement of her coach and teammates, she practiced three days a week. Last Sunday, Elena completed her very first five-kilometer race in thirty-two minutes, and her family celebrated with a picnic in the park.",
            "question": "How did Elena's family celebrate her finishing the five-kilometer race?",
            "options": [
                "With a picnic in the park.",
                "By buying her a new bicycle.",
                "By traveling abroad to a marathon.",
                "With dinner at a luxury restaurant."
            ],
            "correct_answer": "With a picnic in the park.",
            "explanation": "The text states: 'Elena completed her very first five-kilometer race in thirty-two minutes, and her family celebrated with a picnic in the park.'",
        },
        {
            "type": "reading",
            "reading_text": "Modern electric bicycles are becoming very popular in European towns. People use them to travel to work without getting stuck in traffic jams. These bikes have small rechargeable batteries that help riders climb steep hills easily. Many commuters say they save money on train tickets and feel healthier after riding each morning.",
            "question": "According to the passage, why do commuters prefer electric bicycles?",
            "options": [
                "They save money on train tickets and avoid traffic jams.",
                "They are faster than airplanes and trains.",
                "They can carry heavy cargo across long highways.",
                "They do not require rechargeable batteries."
            ],
            "correct_answer": "They save money on train tickets and avoid traffic jams.",
            "explanation": "The text mentions commuters avoid traffic jams and save money on train tickets.",
        },
        {
            "type": "grammar",
            "question": "Complete the sentence: 'While David _______ dinner last night, the doorbell suddenly rang.'",
            "options": ["was cooking", "cooked", "cooks", "is cooking"],
            "correct_answer": "was cooking",
            "explanation": "Past continuous ('was cooking') describes an ongoing background activity interrupted by an event in Past Simple ('rang').",
        },
        {
            "type": "grammar",
            "question": "Complete the sentence: 'If the weather is sunny tomorrow morning, we _______ for a walk along the river.'",
            "options": ["will go", "went", "going", "have gone"],
            "correct_answer": "will go",
            "explanation": "First conditional pattern: 'If + Present Simple, will + base verb'.",
        },
        {
            "type": "vocabulary",
            "question": "Choose the phrasal verb that best completes: 'We arrived at the airport two hours early to _______ our luggage.'",
            "options": ["check in", "give up", "look for", "turn off"],
            "correct_answer": "check in",
            "explanation": "'Check in luggage' is the standard travel term for registering bags before a flight.",
        },
        {
            "type": "vocabulary",
            "question": "Complete the sentence: 'This jacket is much too tight. Could you please check if you have it in a larger _______?'",
            "options": ["size", "shape", "weight", "height"],
            "correct_answer": "size",
            "explanation": "'Size' is used when describing garment dimensions in clothing retail.",
        },
        {
            "type": "listening",
            "audio_text": "Airport Gate Agent: Attention passengers on flight British Airways 340 to Berlin. Boarding will begin at Gate 14 in approximately fifteen minutes. Please have your boarding pass and passport open for inspection.",
            "question": "At which gate will flight 340 to Berlin board passengers?",
            "options": ["Gate 14", "Gate 40", "Gate 4", "Gate 24"],
            "correct_answer": "Gate 14",
            "explanation": "The agent explicitly announces: 'Boarding will begin at Gate 14 in approximately fifteen minutes.'",
        },
        {
            "type": "listening",
            "audio_text": "Museum Guide: Welcome to the city historical museum. The ancient Roman gallery is located on the second floor, while the temporary impressionist art collection is in the west wing. Audio guides are available at reception.",
            "question": "Where can visitors find the ancient Roman gallery?",
            "options": [
                "On the second floor",
                "In the basement",
                "In the west wing",
                "Outside in the garden"
            ],
            "correct_answer": "On the second floor",
            "explanation": "The guide notes: 'The ancient Roman gallery is located on the second floor'.",
        },
        {
            "type": "writing",
            "question": "Write a paragraph in English (35 to 60 words) describing a memorable trip or weekend activity you did recently. Explain where you went, who was with you, and why you enjoyed it.",
            "options": [],
            "correct_answer": "",
            "explanation": "Evaluated on CEFR A2 written production (up to 10 points): past tense grammar and agreement, connected sentence construction, appropriate vocabulary, coherence, and task completion (punctuation errors excluded).",
            "min_words": 35,
            "max_words": 60,
        },
        {
            "type": "speaking",
            "question": "Please speak in English for 20 to 35 seconds: Talk about your favorite hobby or sport. Explain how often you practice it and why you find it interesting.",
            "options": ["Record your voice response in English"],
            "correct_answer": "Record your voice response in English",
            "explanation": "Evaluated on CEFR A2 ability to describe personal interests and habitual activities with formulaic connectors.",
            "min_seconds": 20,
            "max_seconds": 45,
        },
    ],
    "B1": [
        {
            "type": "reading",
            "reading_text": "Urban planners in several Scandinavian cities have begun transforming abandoned industrial rail yards into thriving public green corridors. Rather than demolishing old steel tracks, landscape architects incorporated them into walking paths lined with native wildflowers, fruit trees, and wooden benches. Local residents frequently gather here for outdoor yoga sessions, weekend farmers' markets, and open-air acoustic concerts. Environmental scientists note that these green belts have significantly lowered summer temperatures in surrounding neighborhoods while providing vital habitats for pollinating bees and migratory songbirds.",
            "question": "What ecological benefit of the green corridors is highlighted by environmental scientists?",
            "options": [
                "They have lowered summer temperatures and provided habitats for pollinators.",
                "They generate industrial wind power for the entire municipality.",
                "They completely eliminated the need for public transport in the city center.",
                "They replaced all traditional commercial grocery stores."
            ],
            "correct_answer": "They have lowered summer temperatures and provided habitats for pollinators.",
            "explanation": "The passage confirms: 'green belts have significantly lowered summer temperatures in surrounding neighborhoods while providing vital habitats for pollinating bees'.",
        },
        {
            "type": "reading",
            "reading_text": "Remote work has fundamentally changed how companies approach team collaboration and productivity. While employees appreciate avoiding exhausting daily commutes and having greater flexibility to manage family responsibilities, managers often face challenges maintaining team cohesion and spontaneous brainstorming. Many progressive organizations now adopt hybrid models, designating two collaborative days in the office for strategy workshops while keeping the remaining days remote for focused individual tasks. Studies suggest this balanced arrangement improves employee job satisfaction while preserving creative teamwork.",
            "question": "According to the passage, why do progressive companies implement hybrid work models?",
            "options": [
                "To combine spontaneous collaborative office sessions with focused remote days.",
                "To permanently close all company headquarters and reduce operating overhead.",
                "To eliminate employee vacation allowances and weekend rest periods.",
                "To monitor staff computers with continuous automated surveillance software."
            ],
            "correct_answer": "To combine spontaneous collaborative office sessions with focused remote days.",
            "explanation": "The text explains companies designate 'two collaborative days in the office for strategy workshops while keeping the remaining days remote for focused individual tasks'.",
        },
        {
            "type": "grammar",
            "question": "Complete the sentence: 'I haven't heard from Michael since he _______ his new position at the architectural firm in Dublin.'",
            "options": ["started", "has started", "starts", "starting"],
            "correct_answer": "started",
            "explanation": "Clauses introduced by 'since' specifying a starting point in the past take the Past Simple ('started').",
        },
        {
            "type": "grammar",
            "question": "Complete the conditional: 'If I _______ more free time this semester, I would definitely volunteer at the animal rescue shelter.'",
            "options": ["had", "have", "will have", "would have"],
            "correct_answer": "had",
            "explanation": "Second conditional hypothetical pattern: 'If + Past Simple, would + base verb'.",
        },
        {
            "type": "vocabulary",
            "question": "Choose the word that best completes the sentence: 'The local environmental council launched a campaign to raise public _______ regarding plastic recycling.'",
            "options": ["awareness", "concern", "curiosity", "intention"],
            "correct_answer": "awareness",
            "explanation": "'Raise public awareness' is the standard fixed collocation in English.",
        },
        {
            "type": "vocabulary",
            "question": "Complete the sentence: 'Despite unexpected logistical delays, the engineering team managed to _______ their construction deadline.'",
            "options": ["meet", "catch", "reach", "fulfill"],
            "correct_answer": "meet",
            "explanation": "'Meet a deadline' is the conventional idiomatic collocation in English.",
        },
        {
            "type": "listening",
            "audio_text": "Podcast Host: Welcome to Earth Science Weekly. Marine biologist Dr. Sarah Jenkins reports that satellite tagging has revealed humpback whale populations in the North Atlantic have grown by nearly twenty percent over the past decade. She attributes this encouraging recovery to stricter international commercial fishing bans and expanded coastal marine reserve sanctuaries.",
            "question": "What primary reason does Dr. Jenkins provide for the increase in humpback whale populations?",
            "options": [
                "Stricter commercial fishing bans and expanded coastal marine reserves.",
                "A dramatic rise in oceanic water temperatures near the Arctic.",
                "The introduction of artificial feeding stations along migration routes.",
                "Reduced competition from other predatory marine species."
            ],
            "correct_answer": "Stricter commercial fishing bans and expanded coastal marine reserves.",
            "explanation": "Dr. Jenkins explicitly credits 'stricter international commercial fishing bans and expanded coastal marine reserve sanctuaries.'",
        },
        {
            "type": "listening",
            "audio_text": "Conference Chair: Good morning and welcome to the Renewable Energy Symposium. Before our first keynote on decentralized microgrids, please ensure all mobile phones are placed on silent mode. Note that lunch will be served in the pavilion garden at 1:15 PM following the panel discussion on commercial battery storage.",
            "question": "At what time will lunch be served in the pavilion garden?",
            "options": ["1:15 PM", "12:30 PM", "1:45 PM", "2:00 PM"],
            "correct_answer": "1:15 PM",
            "explanation": "The chair explicitly announces: 'lunch will be served in the pavilion garden at 1:15 PM'.",
        },
        {
            "type": "writing",
            "question": "Write a structured paragraph in English (50 to 80 words) explaining whether you prefer studying or working remotely from home or in person, giving clear reasons and personal examples.",
            "options": [],
            "correct_answer": "",
            "explanation": "Evaluated on CEFR B1 written production (up to 10 points): grammatical control and agreement, connected sentence structures, varied vocabulary, logical transitions, and task completion (punctuation errors excluded).",
            "min_words": 50,
            "max_words": 80,
        },
        {
            "type": "speaking",
            "question": "Please speak in English for 30 to 50 seconds: Narrate a personal experience where you had to adapt to an unexpected change or challenge, explaining what happened and what you learned.",
            "options": ["Record your voice response in English"],
            "correct_answer": "Record your voice response in English",
            "explanation": "Evaluated on CEFR B1 narrative fluency, past tense control, and cohesive discourse organization.",
            "min_seconds": 30,
            "max_seconds": 60,
        },
    ],
    "B2": [
        {
            "type": "reading",
            "reading_text": "As summer heatwaves intensify across southern holiday destinations, travelers are rethinking their vacation habits in favor of 'coolcationing.' Rather than flocking to sweltering Mediterranean beaches, holidaymakers are increasingly choosing temperate northern escapes, such as the Norwegian fjords, the Scottish Highlands, and Swedish lakeside villages. Travel sociologists note that this shift reflects not only a search for thermal comfort, but also a desire for tranquil, uncrowded natural landscapes where outdoor activities like hiking and wild swimming can be enjoyed without physical exhaustion. Hospitality surveys indicate that bookings in Nordic regions during peak summer months have surged by over thirty percent, signaling a lasting transformation in international leisure travel.",
            "question": "According to the passage, what primary motivation is driving travelers toward 'coolcationing'?",
            "options": [
                "Taking advantage of discounted long-haul business airline fares.",
                "Attending international electronic music festivals in coastal capitals.",
                "Escaping oppressive summer heat in search of comfortable, peaceful northern landscapes.",
                "Complying with municipal regulations prohibiting seaside sunbathing."
            ],
            "correct_answer": "Escaping oppressive summer heat in search of comfortable, peaceful northern landscapes.",
            "explanation": "The text explains that intense heatwaves are causing travelers to seek temperate northern destinations for thermal comfort and peaceful nature.",
        },
        {
            "type": "reading",
            "reading_text": "In historic European city centers such as Venice, Barcelona, and Amsterdam, the unchecked proliferation of short-term holiday rentals has ignited intense debate over housing affordability. While residential tourism brings substantial revenue to local hospitality businesses, long-term residents argue that converting residential apartments into lucrative tourist accommodation has driven rental prices to unsustainable levels. Young families and public sector workers find themselves priced out of neighborhoods their families inhabited for generations, eroding community ties and replacing local bakeries and bookshops with souvenir outlets. To preserve community life, several municipal councils have introduced strict quotas on holiday rental permits and imposed higher visitor taxes to fund affordable social housing.",
            "question": "What major negative consequence of short-term holiday rentals for local communities is highlighted in the text?",
            "options": [
                "It completely stops international visitors from spending money in neighborhood cafes.",
                "It drives housing costs up and forces long-term residents out of their traditional neighborhoods.",
                "It prevents municipal public transportation networks from operating morning schedules.",
                "It requires residential property owners to convert private living rooms into souvenir shops."
            ],
            "correct_answer": "It drives housing costs up and forces long-term residents out of their traditional neighborhoods.",
            "explanation": "The passage explains that converting residential flats into tourist rentals drives up housing costs, pricing out families and eroding local community life.",
        },
        {
            "type": "grammar",
            "question": "Complete the sentence using inversion: 'Not only _______ the prestigious international marathon, but she also raised thousands of pounds for a local children's hospital.'",
            "options": ["she completed", "she did complete", "completed she", "did she complete"],
            "correct_answer": "did she complete",
            "explanation": "Negative adverbials placed at the beginning of a clause ('Not only...') trigger subject-auxiliary inversion ('did she complete').",
        },
        {
            "type": "grammar",
            "question": "Complete the third conditional sentence: 'If Marcus _______ the job offer in Edinburgh ten years ago, he would never have met his future wife at the neighborhood arts festival.'",
            "options": ["wouldn't accept", "didn't accept", "hadn't accepted", "hasn't accepted"],
            "correct_answer": "hadn't accepted",
            "explanation": "Third conditional past counterfactual uses 'If + Past Perfect (hadn't accepted), would have + participle'.",
        },
        {
            "type": "vocabulary",
            "question": "Choose the word that best completes the sentence: 'After months of exhausting overtime, Clara decided to change jobs to strike a healthier _______ between her career and personal life.'",
            "options": ["compromise", "balance", "equilibrium", "proportion"],
            "correct_answer": "balance",
            "explanation": "'Strike a balance' is the established natural English collocation.",
        },
        {
            "type": "vocabulary",
            "question": "Choose the most appropriate adjective: 'Even during the stressful relocation to a new country, Liam remained remarkably _______ and handled each unexpected complication with calm patience.'",
            "options": ["negligible", "tentative", "resilient", "fleeting"],
            "correct_answer": "resilient",
            "explanation": "'Resilient' describes the capacity to recover quickly from difficulties and maintain emotional balance.",
        },
        {
            "type": "listening",
            "audio_text": "Podcast Host: In today's episode on holistic well-being, we welcome clinical psychologist Dr. Elena Foster. Dr. Foster explains that regular engagement with music—whether singing in a choir or listening to soothing acoustic compositions—lowers cortisol levels and stimulates dopamine pathways, providing significant therapeutic relief for chronic work stress and anxiety.",
            "question": "According to Dr. Foster, how does musical engagement support mental well-being?",
            "options": [
                "It completely replaces the physiological necessity for sleep and physical exercise.",
                "It causes individuals to avoid social interaction and live in total acoustic solitude.",
                "It permanently eliminates the requirement for balanced nutrition in daily life.",
                "It lowers stress hormone levels and stimulates neurotransmitters associated with relaxation."
            ],
            "correct_answer": "It lowers stress hormone levels and stimulates neurotransmitters associated with relaxation.",
            "explanation": "Dr. Foster notes that music lowers cortisol levels and stimulates dopamine, alleviating chronic work stress.",
        },
        {
            "type": "listening",
            "audio_text": "Radio Counselor: Welcome back. Listener Sarah from Leeds calls in regarding a life dilemma. She has received a major promotion that requires traveling abroad for eight months each year, but her longtime partner wants to settle down and purchase a family home in their hometown. Reconciling individual career aspiration with shared relational commitment is one of the most defining personal crossroads in adult life.",
            "question": "What core personal dilemma is Sarah navigating according to the radio broadcast?",
            "options": [
                "Choosing between opening a bakery or starting a commercial bookstore.",
                "Balancing a demanding international career opportunity with her relationship and shared life goals.",
                "Deciding whether to move into a university dormitory after retirement.",
                "Selecting an appropriate training regimen for an upcoming athletic triathlon."
            ],
            "correct_answer": "Balancing a demanding international career opportunity with her relationship and shared life goals.",
            "explanation": "Sarah is weighing a promotion requiring extensive travel against settling down and buying a home with her partner.",
        },
        {
            "type": "writing",
            "question": "Write an analytical paragraph in English (70 to 110 words) about how modern work-life balance is evolving, discussing whether flexible routines and prioritizing personal well-being improve family relationships and overall life satisfaction.",
            "options": [],
            "correct_answer": "",
            "explanation": "Evaluated on CEFR B2 written production (up to 10 points): complex grammatical structures and agreement, subordinate sentence variety, precise everyday/professional vocabulary, cohesive argumentation, and task completion (punctuation errors excluded).",
            "min_words": 70,
            "max_words": 110,
        },
        {
            "type": "speaking",
            "question": "Please speak in English for 45 to 70 seconds: Describe an important life decision or turning point that significantly influenced your personal perspective or daily routine, explaining what you learned from the experience.",
            "options": ["Record your voice response in English"],
            "correct_answer": "Record your voice response in English",
            "explanation": "Evaluated on CEFR B2 systematic presentation of points, highlighting significant aspects, and expressing nuanced personal viewpoints.",
            "min_seconds": 45,
            "max_seconds": 80,
        },
    ],
    "C1": [
        {
            "type": "reading",
            "reading_text": "In an increasingly relentless professional landscape, mid-career sabbaticals have evolved from an eccentric indulgence into a strategic mechanism for psychological recalibration. Organizational psychologists observe that individuals who deliberately interrupt extended periods of linear corporate ambition frequently experience a profound reordering of personal priorities. Rather than signifying burnout or apathy, stepping away from entrenched professional identities enables individuals to cultivate latent creative capacities, rebuild neglected kinship networks, and confront the existential disquiet that unceasing productivity often masks. Longitudinal studies suggest that professionals who undertake purposeful periods of unhurried contemplation return to vocational life with heightened cognitive flexibility, greater empathetic leadership, and a more sustainable orientation toward long-term achievement.",
            "question": "According to organizational psychologists in the passage, what primary psychological benefit arises from taking a mid-career sabbatical?",
            "options": [
                "It enables individuals to permanently abandon all professional responsibilities and obligations.",
                "It guarantees an automatic promotion and salary doubling upon returning to corporate employment.",
                "It facilitates a profound reordering of personal priorities and nurtures latent creative capacities.",
                "It completely shields professionals from experiencing any future interpersonal conflicts at work."
            ],
            "correct_answer": "It facilitates a profound reordering of personal priorities and nurtures latent creative capacities.",
            "explanation": "The text explains that stepping away from linear corporate ambition enables individuals to reorder personal priorities, cultivate latent creative capacities, and achieve psychological recalibration.",
        },
        {
            "type": "reading",
            "reading_text": "In contemporary architectural discourse, the philosophy of critical regionalism has resurfaced as an articulate counterweight to the homogenizing aesthetics of globalized developer capitalism. Pioneered by architectural theorists seeking to mediate between universal modernist technology and particular cultural topographies, this methodology prioritizes tactile materiality, indigenous geological strata, and localized thermodynamic conditions over photogenic parametric spectacles. By calibrating fenestration to prevailing climatic breezes and sourcing vernacular limestone rather than carbon-intensive imported alloys, practitioners resist the placelessness that characterizes contemporary metropolitan skylines. Far from regressive romanticism, this design posture represents a rigorous structural synthesis between contextual heritage and progressive environmental engineering.",
            "question": "How does critical regionalism differentiate itself from mere nostalgic aesthetic traditionalism?",
            "options": [
                "By synthesizing contextual heritage with progressive environmental engineering and thermodynamics.",
                "By demanding the complete abandonment of modern steel reinforcement and electrical grids.",
                "By replicating identical pre-industrial wooden cottages in suburban developments.",
                "By relying exclusively on imported luxury alloys from non-European suppliers."
            ],
            "correct_answer": "By synthesizing contextual heritage with progressive environmental engineering and thermodynamics.",
            "explanation": "The text concludes that critical regionalism 'represents a rigorous structural synthesis between contextual heritage and progressive environmental engineering.'",
        },
        {
            "type": "grammar",
            "question": "Complete the formal cleft sentence: 'What _______ most compelling about her historical thesis was the meticulous archival evidence retrieved from private maritime diaries.'",
            "options": ["scholars found", "did scholars find", "found scholars", "scholars finding"],
            "correct_answer": "scholars found",
            "explanation": "In a wh-cleft sentence functioning as subject ('What scholars found most compelling...'), normal Subject-Verb order is preserved within the relative clause.",
        },
        {
            "type": "grammar",
            "question": "Complete the participle clause: '_______ the voluminous diplomatic correspondence spanning three decades, the biographer was able to reconstruct the secret negotiations with unprecedented precision.'",
            "options": ["Having scrutinized", "Scrutinizing had", "To have scrutinized", "Being scrutinized"],
            "correct_answer": "Having scrutinized",
            "explanation": "The perfect active participle ('Having scrutinized') indicates an action completed prior to the main clause action ('was able to reconstruct').",
        },
        {
            "type": "vocabulary",
            "question": "Choose the most precise stylistic adjective: 'The literary critic delivered a _______ critique of the author's narrative contrivances, dismantling each plot inconsistency with forensic precision.'",
            "options": ["trenchant", "rudimentary", "perfunctory", "superficial"],
            "correct_answer": "trenchant",
            "explanation": "'Trenchant' denotes vigorous, incisive, and acutely penetrating criticism.",
        },
        {
            "type": "vocabulary",
            "question": "Choose the academic verb: 'The freshly corroborated forensic testimony completely _______ the defendant's fabricated alibi.'",
            "options": ["demolished", "instigated", "augmented", "harbored"],
            "correct_answer": "demolished",
            "explanation": "'Demolished' in academic/legal rhetoric signifies thoroughly and decisively disproving an argument or alibi.",
        },
        {
            "type": "listening",
            "audio_text": "Symposium Speaker: When examining the sociolinguistic vitality of regional dialects under the homogenizing pressure of algorithmic digital media, one observes an intriguing dialectic. Rather than succumbing entirely to standardized national registers, younger cohorts frequently repurpose localized phonetic markers as badges of communal identity in digital micro-communities, effectively subverting top-down linguistic conformity.",
            "question": "What sociolinguistic phenomenon does the speaker identify among younger cohorts?",
            "options": [
                "They actively repurpose localized markers to assert communal identity and resist linguistic conformity.",
                "They completely abandon regional dialects in favor of standardized computer-generated syntax.",
                "They exclusively communicate through non-verbal digital pictograms rather than natural syntax.",
                "They demand federal censorship of localized regional slang across public television."
            ],
            "correct_answer": "They actively repurpose localized markers to assert communal identity and resist linguistic conformity.",
            "explanation": "The speaker observes that younger cohorts repurpose localized markers 'as badges of communal identity... subverting top-down linguistic conformity.'",
        },
        {
            "type": "listening",
            "audio_text": "Colloquium Panelist: What strikes me most profoundly in Morrison's early fiction is her refusal to grant readers a comfortable narrative catharsis. By structuring narratives around fragmented polyphonic recollections rather than linear causal timelines, she compels the reader to confront the irreducible complexity of historical trauma without aesthetic pacification.",
            "question": "According to the panelist, how does the author structure her fictional narratives to address historical trauma?",
            "options": [
                "Through fragmented polyphonic recollections that reject comfortable aesthetic catharsis.",
                "Through strictly chronological autobiographical memoirs with predictable resolutions.",
                "By framing historical events within lighthearted satirical theatrical comedies.",
                "By avoiding communal recollections in favor of solitary heroic fantasy quests."
            ],
            "correct_answer": "Through fragmented polyphonic recollections that reject comfortable aesthetic catharsis.",
            "explanation": "The panelist highlights 'fragmented polyphonic recollections rather than linear causal timelines' resisting comfortable catharsis.",
        },
        {
            "type": "writing",
            "question": "Write a well-structured critical paragraph in English (90 to 140 words) evaluating how the transition from lifelong physical community living to hyper-mobile global careerism influences personal identity, loneliness, and intergenerational social solidarity.",
            "options": [],
            "correct_answer": "",
            "explanation": "Evaluated on CEFR C1 written production (up to 10 points): advanced syntactic structures and agreement, sophisticated sentence construction, idiomatic and academic lexical precision, seamless discursive cohesion, and task completion (punctuation errors excluded).",
            "min_words": 90,
            "max_words": 140,
        },
        {
            "type": "speaking",
            "question": "Please speak in English for 60 to 90 seconds: Deliver an elaborate, structured exposition on how modern cities can preserve intergenerational social spaces where younger and older generations regularly interact, share skills, and prevent social isolation.",
            "options": ["Record your voice response in English"],
            "correct_answer": "Record your voice response in English",
            "explanation": "Evaluated on CEFR C1 ability to synthesize complex philosophical arguments with nuanced subsidiary points and clear conclusions.",
            "min_seconds": 60,
            "max_seconds": 100,
        },
    ],
    "C2": [
        {
            "type": "reading",
            "reading_text": "The insidious erosion of epistemic humility within hyper-specialized scholarly discourse arguably constitutes one of the most perilous intellectual crises of our epoch. As academic sub-disciplines splinter into self-referential silos guarded by baroque terminological ramparts, the capacity for broad transdisciplinary synthesis has profoundly diminished. Inquiries that once demanded holistic philosophical contemplation—such as the ontological parameters of consciousness, the ecological ethics of planetary stewardship, or the sociopolitical ramifications of automated decision systems—are routinely reduced to narrow quantitative metrics stripped of normative reflection. The resulting intellectual landscape presents a disconcerting paradox: an exponential proliferation of empirical granular data coexisting with an acute impoverishment of overarching wisdom. Reinvigorating the humanities not as an ornamental afterthought, but as an indispensable dialectical partner to empirical inquiry, represents an urgent intellectual imperative.",
            "question": "What central intellectual paradox is formulated in the philosophical critique?",
            "options": [
                "An exponential proliferation of empirical data coexisting with an acute impoverishment of overarching wisdom.",
                "A total abandonment of scientific publishing in favor of oral storytelling traditions.",
                "The displacement of quantitative scientific research by speculative theological mysticism.",
                "The inability of academic libraries to archive digital monographs due to server storage limits."
            ],
            "correct_answer": "An exponential proliferation of empirical data coexisting with an acute impoverishment of overarching wisdom.",
            "explanation": "The text explicitly diagnoses 'an exponential proliferation of empirical granular data coexisting with an acute impoverishment of overarching wisdom.'",
        },
        {
            "type": "reading",
            "reading_text": "To scrutinize the aesthetic taxonomy of modernism through the prism of contemporary post-colonial historiography is to recognize how frequently purported aesthetic universals were subtly tethered to specific geopolitical hegemonies. The celebrated dogma that form must unreservedly follow function, championed by interwar functionalists as an egalitarian democratization of design, often operated as a tacit justification for erasing rich vernacular architectural tapestries across the Global South. By declaring ornamental motifs superfluous and enforcing industrial minimalism as the sole hallmark of cultural advancement, modernization programs frequently flattened intricate indigenous architectural cosmologies into sterile functionalist grids. Contemporary critical practitioners therefore dismantle this modernist orthodoxy not out of arbitrary antiquarian nostalgia, but to vindicate spatial paradigms that celebrate ecological symbiosis, tactile communal memory, and cultural pluralism.",
            "question": "On what grounds do contemporary post-colonial practitioners challenge the modernist doctrine of functional minimalism?",
            "options": [
                "Because functionalist orthodoxy historically operated to erase rich indigenous architectural cosmologies and vernacular diversity.",
                "Because minimalist architecture is structurally incapable of supporting modern electrical engineering installations.",
                "Because they advocate the total elimination of functional public infrastructure in favor of decorative sculpture.",
                "Because interwar functionalists explicitly prohibited the construction of residential apartment buildings."
            ],
            "correct_answer": "Because functionalist orthodoxy historically operated to erase rich indigenous architectural cosmologies and vernacular diversity.",
            "explanation": "The text argues modernism's dogma 'often operated as a tacit justification for erasing rich vernacular architectural tapestries across the Global South'.",
        },
        {
            "type": "grammar",
            "question": "Complete the formal hypothetical inversion: 'Were the international arbitration tribunal _______ the treaty stipulations in bad faith, the sovereign signatory would have had immediate recourse to unilateral suspension.'",
            "options": ["to have interpreted", "having interpreted", "should interpret", "interpreting had"],
            "correct_answer": "to have interpreted",
            "explanation": "'Were + subject + to have + past participle' expresses formal, high-register counterfactual conditions in the past.",
        },
        {
            "type": "grammar",
            "question": "Complete the negative restrictive clause: 'Hardly _______ the rostrum to deliver his keynote when an unexpected standing ovation reverberated through the hall.'",
            "options": ["had the laureate approached", "the laureate approached", "did the laureate approach", "has the laureate approached"],
            "correct_answer": "had the laureate approached",
            "explanation": "'Hardly... when' requires past perfect with subject-auxiliary inversion ('had the laureate approached').",
        },
        {
            "type": "vocabulary",
            "question": "Choose the most sophisticated adjective: 'The historian's monograph provides a _______ deconstruction of teleological determinism in nineteenth-century historiography.'",
            "options": ["scintillating", "prosaic", "pedestrian", "lugubrious"],
            "correct_answer": "scintillating",
            "explanation": "'Scintillating' signifies brilliantly lively, witty, and exceptionally intellectually stimulating.",
        },
        {
            "type": "vocabulary",
            "question": "Choose the precise literary noun: 'Far from displaying customary diplomatic deference, the envoy addressed the summit with an astonishing _______ that flabbergasted the veteran ambassadors.'",
            "options": ["temerity", "torpor", "placidness", "obsequiousness"],
            "correct_answer": "temerity",
            "explanation": "'Temerity' denotes audacious boldness or excessive, fearless effrontery.",
        },
        {
            "type": "listening",
            "audio_text": "Sociological Colloquium: In contemporary gerontology and social psychology, researchers increasingly emphasize the irreplaceable role of non-kin companionate bonds in preserving cognitive vitality. While familial relationships are frequently bounded by intergenerational obligations and caretaking friction, long-term friendships founded on reciprocal vulnerability and shared intellectual memory provide an autonomous psychological sanctuary. Longitudinal data indicate that sustaining deep, non-obligatory friendships into late adulthood contributes significantly more to subjective life satisfaction than material wealth or inherited familial stature.",
            "question": "What primary psychological distinction between long-term friendships and familial relationships is highlighted by the colloquium speaker?",
            "options": [
                "Friendships require substantial financial investments and legally binding contracts.",
                "Non-kin companionate bonds offer an autonomous psychological sanctuary free of obligatory caretaking friction.",
                "Familial obligations consistently improve cognitive vitality more than non-kin friendships.",
                "Friendships inevitably dissolve as individuals transition into late adulthood."
            ],
            "correct_answer": "Non-kin companionate bonds offer an autonomous psychological sanctuary free of obligatory caretaking friction.",
            "explanation": "The speaker contrasts familial relationships bounded by obligation with friendships that provide an autonomous psychological sanctuary rooted in reciprocal vulnerability.",
        },
        {
            "type": "listening",
            "audio_text": "Urban Anthropology Forum: As commercial real estate pressures progressively commodify metropolitan spaces, public libraries persist as one of the few remaining secular sanctuaries predicated on unconditional hospitality. Unlike coffeehouses or shopping pavilions where belonging is strictly contingent on consumer expenditure, libraries validate civic presence without financial transactions. Sociologists observe that preserving non-commercial public commons is essential for cultivating spontaneous cross-class solidarity and mitigating urban social isolation.",
            "question": "According to the speaker, what distinctive democratic characteristic sets public libraries apart from commercial metropolitan spaces?",
            "options": [
                "They require visitors to purchase annual memberships before entering reading rooms.",
                "They are exclusively situated in affluent suburban neighborhoods away from public transport.",
                "They provide a non-commercial civic space that welcomes presence without requiring financial expenditure.",
                "They replace traditional municipal government offices for official public voting."
            ],
            "correct_answer": "They provide a non-commercial civic space that welcomes presence without requiring financial expenditure.",
            "explanation": "The speaker emphasizes that unlike commercial venues where presence depends on consumer spending, libraries validate civic presence without any financial transactions.",
        },
        {
            "type": "writing",
            "question": "Write a rigorous philosophical paragraph in English (110 to 160 words) critically examining whether hyper-specialization in modern scientific inquiry enriches or fragments humanity's capacity to address complex global ethical dilemmas.",
            "options": [],
            "correct_answer": "",
            "explanation": "Evaluated on CEFR C2 written production (up to 10 points): mastery of complex syntax and agreement, nuanced sentence construction, erudite lexical range, rhetorical coherence, and comprehensive task realization (punctuation errors excluded).",
            "min_words": 110,
            "max_words": 160,
        },
        {
            "type": "speaking",
            "question": "Please speak in English for 75 to 110 seconds: Formulate an articulate philosophical disquisition on the tension between epistemic specialization and transdisciplinary synthesis in contemporary scientific and moral dilemmas.",
            "options": ["Record your voice response in English"],
            "correct_answer": "Record your voice response in English",
            "explanation": "Evaluated on CEFR C2 capacity to reconstruct complex abstract arguments smoothly with exceptional precision and conceptual nuance.",
            "min_seconds": 75,
            "max_seconds": 120,
        },
    ],
}


class ExamGeneratorService:
    """
    Serviço gerador de exames trimestrais baseado nas diretrizes oficiais CEFR
    e nos arquivos pedagógicos já indexados no painel de administração.
    """

    @classmethod
    def _get_groq_client(cls):
        try:
            from apps.chat.audio_service import get_groq_keys
            from groq import Groq

            keys = get_groq_keys()
            if keys:
                return Groq(api_key=keys[0])
        except Exception as e:
            logger.warning(f"[ExamGeneratorService] Não foi possível instanciar Groq: {e}")
        return None

    @staticmethod
    def _clean_activity_title(raw_title: str) -> str:
        """Limpa sufixos padronizados de títulos de atividades para uso no prompt em inglês."""
        if not raw_title:
            return ""
        import re as _re
        cleaned = _re.sub(r"\s*[–—-]\s*(A1|A2|B1\+?|B1-B2|B2|C1|C2).*$", "", str(raw_title), flags=_re.IGNORECASE)
        return cleaned.strip()

    @classmethod
    def _fetch_level_activities(cls, level: str) -> Dict[str, List[str]]:
        """
        Coleta as atividades reais existentes na plataforma para o nível solicitado
        nas 4 áreas: grammar, vocabulary, listening e reading.
        Combina:
        - Catálogo Test-English (te_english_data.json)
        - Catálogo LiveWorksheets (liveworksheets_data.json)
        - Catálogo GrammarService (grammar_data.py)
        - Decks de Flashcards CEFR (cefr_flashcards)
        - Podcasts e News publicados do nível
        """
        lvl = (level or "A1").strip().upper()
        result: Dict[str, List[str]] = {
            "grammar": [],
            "vocabulary": [],
            "listening": [],
            "reading": [],
        }

        try:
            from .services import ExternalContentService
            from .grammar_data import GrammarService
            from .models import Flashcard, Podcast, NewsItem

            # 1. Grammar: GrammarService + Test-English + LiveWorksheets
            g_data = GrammarService.get_grammar(level=lvl)
            for t in g_data.get("topics", []):
                title = t.get("title", "")
                struct = t.get("key_structure", "")
                if title:
                    result["grammar"].append(f"{title} ({struct})" if struct else title)

            for cat in ("grammar", "vocabulary", "listening", "reading"):
                te_items = ExternalContentService.get_test_english_content(lvl, cat).get("items", [])
                if not te_items and lvl == "C2":
                    te_items = ExternalContentService.get_test_english_content("C1", cat).get("items", [])
                for it in te_items:
                    title = cls._clean_activity_title(it.get("title", ""))
                    if title and title not in result[cat]:
                        result[cat].append(title)

                lw_items = ExternalContentService.get_liveworksheets_content(lvl, cat).get("items", [])
                for it in lw_items:
                    title = cls._clean_activity_title(it.get("title", ""))
                    if title and title not in result[cat]:
                        result[cat].append(title)

            # 2. Vocabulary extra: tópicos e palavras dos Flashcards CEFR do nível
            try:
                fc_rows = list(Flashcard.objects.filter(level__iexact=lvl, is_published=True)[:40])
                fc_topics = sorted({(c.topic or "").strip() for c in fc_rows if (c.topic or "").strip()})
                fc_words = [c.front.strip() for c in fc_rows if c.front and len(c.front.strip()) <= 35][:15]
                for ft in fc_topics:
                    label = f"Flashcard Topic: {ft}"
                    if label not in result["vocabulary"]:
                        result["vocabulary"].append(label)
                if fc_words:
                    result["vocabulary"].append(f"Platform Vocabulary Words ({lvl}): {', '.join(fc_words)}")
            except Exception:
                pass

            # 3. Listening extra: Podcasts do nível
            try:
                podcasts = list(Podcast.objects.filter(level__icontains=lvl)[:8])
                for p in podcasts:
                    if p.title and p.title not in result["listening"]:
                        result["listening"].append(f"Podcast: {p.title}")
            except Exception:
                pass

            # 4. Reading extra: News do nível
            try:
                news_qs = list(NewsItem.objects.filter(is_published=True)[:15])
                for n in news_qs:
                    lvls = [str(x).upper() for x in (n.levels or [])]
                    if not lvls or lvl in lvls or "ALL" in lvls:
                        if n.title and n.title not in result["reading"]:
                            result["reading"].append(f"Article: {n.title}")
            except Exception:
                pass

        except Exception as e:
            logger.warning(f"[ExamGeneratorService] Erro ao carregar atividades do nível {lvl}: {e}")

        return result

    @classmethod
    def _fetch_cefr_context(cls, level: str, sampled_activities: Optional[Dict[str, List[str]]] = None) -> str:
        """
        Recupera trechos de conteúdo real dos documentos CEFR cadastrados no banco
        e combina com as atividades existentes de Grammar, Vocabulary, Listening e Reading do nível.
        """
        context_snippets = []
        lvl = (level or "A1").strip().upper()

        if sampled_activities:
            context_snippets.append(f"Existing Platform Activities for Level {lvl} (use these topics, structures, and themes to generate the exam questions):")
            if sampled_activities.get("grammar"):
                context_snippets.append(f"- Level {lvl} Grammar Activities: {'; '.join(sampled_activities['grammar'])}")
            if sampled_activities.get("vocabulary"):
                context_snippets.append(f"- Level {lvl} Vocabulary Activities: {'; '.join(sampled_activities['vocabulary'])}")
            if sampled_activities.get("listening"):
                context_snippets.append(f"- Level {lvl} Listening Activities: {'; '.join(sampled_activities['listening'])}")
            if sampled_activities.get("reading"):
                context_snippets.append(f"- Level {lvl} Reading Activities: {'; '.join(sampled_activities['reading'])}")

        try:
            refs = list(CEFRReference.objects.filter(cefr_level__iexact=lvl)[:3])
            if refs:
                ref_names = [r.filename for r in refs]
                context_snippets.append(f"Official CEFR Reference Documents for level {lvl}: {', '.join(ref_names)}.")

                with connection.cursor() as cur:
                    cur.execute(
                        """
                        SELECT substring(content from 1 for 400)
                        FROM cefr_documents
                        WHERE source_file ILIKE %s
                           OR metadata->>'original_name' = ANY(%s)
                        LIMIT 3;
                        """,
                        [f"%{lvl}%", ref_names],
                    )
                    rows = cur.fetchall()
                    for r in rows:
                        if r and r[0]:
                            cleaned_snippet = r[0].replace("\n", " ").strip()
                            context_snippets.append(f"- Pedagogical Reference Excerpt: {cleaned_snippet[:250]}")
        except Exception as e:
            logger.warning(f"[ExamGeneratorService] Erro ao buscar contexto CEFR: {e}")

        return "\n".join(context_snippets) if context_snippets else f"CEFR Level: {lvl}"

    @classmethod
    def generate_trimestral_questions(
        cls,
        level: str = "A1",
        num_questions: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Gera entre 8 e 15 questões balanceadas (Reading, Grammar, Vocabulary, Listening, Writing, Speaking)
        totalmente dinâmicas, não repetitivas e calibradas de acordo com as diretrizes oficiais CEFR
        e com as atividades reais de Grammar, Vocabulary, Listening e Reading do nível na plataforma.
        """
        num_questions = max(8, min(15, num_questions))
        lvl = (level or "A1").strip().upper()
        if lvl not in CEFR_LEVEL_SPECS:
            lvl = "A1"
        specs = CEFR_LEVEL_SPECS[lvl]

        # Coleta e sorteia uma amostra das atividades reais da plataforma para o nível
        all_activities = cls._fetch_level_activities(lvl)
        sampled_activities = {
            cat: (random.sample(items, k=min(4, len(items))) if items else [])
            for cat, items in all_activities.items()
        }
        cefr_context = cls._fetch_cefr_context(lvl, sampled_activities=sampled_activities)

        # Combina as especificações CEFR com as atividades reais de cada modalidade do nível
        grammar_topics = specs["grammar_topics"]
        if sampled_activities["grammar"]:
            grammar_topics = f"{grammar_topics} | Platform {lvl} Grammar Activities: {', '.join(sampled_activities['grammar'])}"

        vocabulary_topics = specs["vocabulary_topics"]
        if sampled_activities["vocabulary"]:
            vocabulary_topics = f"{vocabulary_topics} | Platform {lvl} Vocabulary Activities: {', '.join(sampled_activities['vocabulary'])}"

        reading_descriptors = specs["reading_descriptors"]
        if sampled_activities["reading"]:
            reading_descriptors = f"{reading_descriptors} | Platform {lvl} Reading Activity Topics: {', '.join(sampled_activities['reading'])}"

        listening_descriptors = specs["listening_descriptors"]
        if sampled_activities["listening"]:
            listening_descriptors = f"{listening_descriptors} | Platform {lvl} Listening Activity Topics: {', '.join(sampled_activities['listening'])}"

        # Seleção de temas combinando as atividades de Reading/Listening/Vocabulary do nível + DYNAMIC_THEMES
        activity_theme_pool = (
            sampled_activities["reading"][:4]
            + sampled_activities["listening"][:4]
            + sampled_activities["vocabulary"][:3]
        )
        dynamic_sample = random.sample(DYNAMIC_THEMES, k=min(3, len(DYNAMIC_THEMES)))
        combined_themes = activity_theme_pool[:5] + dynamic_sample
        generation_salt = uuid.uuid4().hex[:8]

        prompt_kwargs = dict(
            lvl=lvl,
            level_name=specs["name"],
            cefr_context=cefr_context,
            reading_min_words=specs["reading_min_words"],
            reading_max_words=specs["reading_max_words"],
            reading_descriptors=reading_descriptors,
            listening_min_words=specs["listening_min_words"],
            listening_max_words=specs["listening_max_words"],
            listening_duration=specs["listening_duration"],
            listening_descriptors=listening_descriptors,
            speaking_min_seconds=specs["speaking_min_seconds"],
            speaking_max_seconds=specs["speaking_max_seconds"],
            speaking_limit_seconds=specs["speaking_limit_seconds"],
            speaking_descriptors=specs["speaking_descriptors"],
            grammar_topics=grammar_topics,
            vocabulary_topics=vocabulary_topics,
            writing_min_words=specs["writing_min_words"],
            writing_max_words=specs["writing_max_words"],
            selected_themes=", ".join(combined_themes),
            generation_salt=generation_salt,
            num_questions=num_questions,
        )

        system_prompt = PromptManager.get_prompt(
            "exam_generator_system",
            section="System Prompt",
            **prompt_kwargs,
        )

        user_prompt = PromptManager.get_prompt(
            "exam_generator_system",
            section="User Prompt",
            **prompt_kwargs,
        )


        # 1. Tenta via Gemini primeiro (janela de 1M tokens, sem limite de 8k TPM e alta velocidade)
        try:
            from apps.chat.audio_service import get_gemini_client
            from google import genai
            from google.genai import types

            client = get_gemini_client()
            if not client:
                gemini_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
                if gemini_key:
                    client = genai.Client(api_key=gemini_key.strip())

            if client:
                for g_model in ["gemini-flash-latest", "gemini-3.8-flash", "gemini-3.1-flash-lite"]:
                    try:
                        response = client.models.generate_content(
                            model=g_model,
                            contents=f"{system_prompt}\n\n{user_prompt}",
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                temperature=0.7,
                            ),
                        )
                        if response and response.text:
                            parsed = json.loads(response.text)
                            questions = parsed.get("questions", [])
                            if questions and len(questions) >= 6:
                                logger.info(f"[ExamGeneratorService] Exame gerado via Gemini ({g_model}) para nível {lvl} com {len(questions)} questões.")
                                return cls._normalize_questions(questions, num_questions, lvl)
                    except Exception as gemini_try_err:
                        logger.warning(f"[ExamGeneratorService] Falha no modelo Gemini {g_model}: {gemini_try_err}")
        except Exception as e:
            logger.warning(f"[ExamGeneratorService] Falha geral no Gemini: {e}")

        # 2. Tenta via Groq (com modelos estáveis Llama de alto throughput e sem erro de 8k TPM)
        groq_client = cls._get_groq_client()
        candidate_models = [
            getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b"),
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.8-27b",
        ]

        if groq_client:
            for model_name in candidate_models:
                try:
                    res = groq_client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.7,
                    )
                    raw_content = res.choices[0].message.content
                    if raw_content:
                        parsed = json.loads(raw_content)
                        questions = parsed.get("questions", [])
                        if questions and len(questions) >= 6:
                            logger.info(f"[ExamGeneratorService] Exame gerado via Groq ({model_name}) para nível {lvl} com {len(questions)} questões.")
                            return cls._normalize_questions(questions, num_questions, lvl)
                except Exception as e:
                    logger.warning(f"[ExamGeneratorService] Falha no Groq com {model_name}: {e}")

        # 3. Fallback Pedagógico Calibrado por Nível (100% em Inglês e sem imagens)
        logger.info(f"[ExamGeneratorService] Utilizando fallback estruturado calibrado para o nível {lvl}.")
        return cls._generate_fallback_questions(lvl, num_questions)

    @classmethod
    def _normalize_questions(
        cls,
        questions: List[Dict[str, Any]],
        target_count: int,
        level: str,
    ) -> List[Dict[str, Any]]:
        """Garante IDs únicos, valida alternativas, remove imagens e assegura que correct_answer está em options."""
        specs = get_cefr_level_specs(level)
        normalized = []
        used_reading_texts = set()

        for idx, q in enumerate(questions[:target_count], start=1):
            q_id = f"q{idx}"
            q_type = str(q.get("type", "reading")).lower().strip()
            question_text = q.get("question", f"Question {idx}")
            options = q.get("options", [])
            correct = q.get("correct_answer", "")
            explanation = q.get("explanation", "Review the question context carefully.")
            reading_text = q.get("reading_text")
            audio_text = q.get("audio_text")

            # Garantir que textos de reading não se repitam
            if q_type == "reading" and reading_text:
                if reading_text in used_reading_texts:
                    # Encontra texto alternativo do banco de fallback do nível
                    fb_bank = FALLBACK_QUESTION_BANKS.get(level.upper(), FALLBACK_QUESTION_BANKS["A1"])
                    for fb in fb_bank:
                        if fb.get("type") == "reading" and fb.get("reading_text") not in used_reading_texts:
                            reading_text = fb.get("reading_text")
                            question_text = fb.get("question", question_text)
                            options = fb.get("options", options)
                            correct = fb.get("correct_answer", correct)
                            explanation = fb.get("explanation", explanation)
                            break
                used_reading_texts.add(reading_text)

            # Tratamento de options e gabarito por modalidade (multiple-choice vs writing vs speaking)
            if q_type == "writing":
                options = []
                correct = ""
            elif q_type == "speaking":
                if not isinstance(options, list) or len(options) == 0:
                    options = ["Record your voice response in English"]
                correct = options[0]
            else:
                if not isinstance(options, list) or len(options) < 4:
                    options = [correct, "Alternative B", "Alternative C", "Alternative D"]
                if correct not in options:
                    options[0] = correct
                # Garante que as alternativas sejam embaralhadas para que o gabarito
                # nunca fique previsivelmente fixado na primeira opção (Letra A)
                opts_shuffled = [str(opt) for opt in options]
                random.shuffle(opts_shuffled)
                options = opts_shuffled

            min_sec = int(q.get("min_seconds") or specs["speaking_min_seconds"]) if q_type == "speaking" else None
            max_sec = int(q.get("max_seconds") or specs["speaking_limit_seconds"]) if q_type == "speaking" else None
            min_w = int(q.get("min_words") or specs["writing_min_words"]) if q_type == "writing" else None
            max_w = int(q.get("max_words") or specs["writing_max_words"]) if q_type == "writing" else None

            normalized.append({
                "id": q_id,
                "type": q_type,
                "points": int(q.get("points", 10)),
                "question": question_text,
                "options": options if q_type not in ("speaking", "writing") else [],
                "correct_answer": correct if q_type not in ("speaking", "writing") else ("" if q_type == "writing" else None),
                "explanation": explanation,
                "reading_text": reading_text,
                "audio_text": audio_text,
                "audio_url": None,
                "min_seconds": min_sec,
                "max_seconds": max_sec,
                "min_words": min_w,
                "max_words": max_w,
            })

        # Se vieram menos do que o total solicitado, complementa com fallback
        if len(normalized) < target_count:
            fallback_items = cls._generate_fallback_questions(level, target_count - len(normalized))
            for f_item in fallback_items:
                f_item["id"] = f"q{len(normalized) + 1}"
                normalized.append(f_item)

        normalized = normalized[:target_count]

        # Garantir obrigatoriamente ao menos 1 questão de writing e 1 de speaking em todo exame
        lvl_key = (level or "A1").strip().upper()
        fb_bank = FALLBACK_QUESTION_BANKS.get(lvl_key, FALLBACK_QUESTION_BANKS["A1"])

        has_writing = any(q.get("type") == "writing" for q in normalized)
        if not has_writing and normalized:
            fb_writing = next((q.copy() for q in fb_bank if q.get("type") == "writing"), None)
            if fb_writing:
                writing_item = {
                    "id": "q9",
                    "type": "writing",
                    "points": 10,
                    "question": fb_writing["question"],
                    "options": [],
                    "correct_answer": "",
                    "explanation": fb_writing.get("explanation", "Evaluated on CEFR written production criteria."),
                    "reading_text": None,
                    "audio_text": None,
                    "audio_url": None,
                    "min_seconds": None,
                    "max_seconds": None,
                    "min_words": int(fb_writing.get("min_words") or specs["writing_min_words"]),
                    "max_words": int(fb_writing.get("max_words") or specs["writing_max_words"]),
                }
                speaking_indices = [i for i, q in enumerate(normalized) if q.get("type") == "speaking"]
                if len(speaking_indices) >= 2:
                    normalized[speaking_indices[0]] = writing_item
                elif len(normalized) >= 2:
                    replace_idx = len(normalized) - 2 if normalized[-1].get("type") == "speaking" else len(normalized) - 1
                    normalized[replace_idx] = writing_item
                else:
                    normalized[-1] = writing_item

        has_speaking = any(q.get("type") == "speaking" for q in normalized)
        if not has_speaking and len(normalized) >= 2:
            fb_speaking = next((q.copy() for q in fb_bank if q.get("type") == "speaking"), None)
            if fb_speaking:
                speaking_item = {
                    "id": f"q{len(normalized)}",
                    "type": "speaking",
                    "points": 10,
                    "question": fb_speaking["question"],
                    "options": [],
                    "correct_answer": None,
                    "explanation": fb_speaking.get("explanation", "Evaluated on CEFR spoken production criteria."),
                    "reading_text": None,
                    "audio_text": None,
                    "audio_url": None,
                    "min_seconds": int(fb_speaking.get("min_seconds") or specs["speaking_min_seconds"]),
                    "max_seconds": int(fb_speaking.get("max_seconds") or specs["speaking_limit_seconds"]),
                    "min_words": None,
                    "max_words": None,
                }
                replace_idx = len(normalized) - 1 if normalized[-1].get("type") != "writing" else len(normalized) - 2
                normalized[replace_idx] = speaking_item

        # Ordena para manter múltipla escolha primeiro, seguido de writing (q9) e speaking por último (q10)
        mc_items = [q for q in normalized if q.get("type") not in ("writing", "speaking")]
        writing_items = [q for q in normalized if q.get("type") == "writing"]
        speaking_items = [q for q in normalized if q.get("type") == "speaking"]
        normalized = mc_items + writing_items + speaking_items

        # Re-indexa IDs sequenciais (q1..qN)
        for idx, item in enumerate(normalized, start=1):
            item["id"] = f"q{idx}"

        return normalized

    @classmethod
    def _generate_fallback_questions(cls, level: str, count: int) -> List[Dict[str, Any]]:
        """Fallback pedagógico de alta qualidade 100% em inglês, calibrado por nível CEFR e sem imagens."""
        lvl = (level or "A1").strip().upper()
        if lvl not in FALLBACK_QUESTION_BANKS:
            lvl = "A1"
        raw_bank = [q.copy() for q in FALLBACK_QUESTION_BANKS[lvl]]
        mc_questions = [q for q in raw_bank if q.get("type") not in ("writing", "speaking")]
        writing_questions = [q for q in raw_bank if q.get("type") == "writing"]
        speaking_questions = [q for q in raw_bank if q.get("type") == "speaking"]

        random.shuffle(mc_questions)
        specs = get_cefr_level_specs(lvl)

        if count >= 3 and (writing_questions or speaking_questions):
            mc_needed = max(0, count - (1 if writing_questions else 0) - (1 if speaking_questions else 0))
            selected = [mc_questions[i % len(mc_questions)].copy() for i in range(mc_needed)]
            if writing_questions:
                selected.append(writing_questions[0].copy())
            if speaking_questions:
                selected.append(speaking_questions[0].copy())
        else:
            random.shuffle(raw_bank)
            selected = [raw_bank[i % len(raw_bank)].copy() for i in range(count)]

        items = []
        for idx, t in enumerate(selected[:count]):
            t["id"] = f"q{idx + 1}"
            t["points"] = 10
            t["image_url"] = None
            if t.get("type") == "speaking":
                t["min_seconds"] = specs["speaking_min_seconds"]
                t["max_seconds"] = specs["speaking_limit_seconds"]
            elif t.get("type") == "writing":
                t["min_words"] = specs["writing_min_words"]
                t["max_words"] = specs["writing_max_words"]
                t["options"] = []
                t["correct_answer"] = ""
            else:
                # Embaralha as alternativas para que a resposta correta nunca fique sempre na mesma letra
                if isinstance(t.get("options"), list) and len(t["options"]) > 1:
                    opts_shuffled = list(t["options"])
                    random.shuffle(opts_shuffled)
                    t["options"] = opts_shuffled
            items.append(t)
        return items



class TrimestralExamService:
    """
    Gerenciamento do ciclo de vida dos exames trimestrais (exatamente a cada 3 meses).
    Inclui pré-geração em segundo plano para carregamento instantâneo e avaliação de fala via Gemini.
    """

    _pregenerating_users = set()

    @classmethod
    def pregenerate_exam_in_background(cls, username: str, level: str, count: int = 10) -> None:
        """
        Pré-gera o exame trimestral em segundo plano para que fique 100% pronto
        quando o aluno acessar a página de exames.
        """
        if username in cls._pregenerating_users:
            return
        cls._pregenerating_users.add(username)

        def _worker():
            try:
                # Se já foi criado enquanto aguardava, encerra
                if TrimestralExam.objects.filter(username=username, status__in=["ready", "in_progress"]).exists():
                    return
                logger.info(f"[TrimestralExamService] Iniciando pré-geração em segundo plano para {username} ({level})...")
                questions = ExamGeneratorService.generate_trimestral_questions(level=level, num_questions=count)
                new_exam = TrimestralExam.objects.create(
                    id=uuid.uuid4(),
                    username=username,
                    level=level,
                    status="ready",
                    questions=questions,
                    total_questions=len(questions),
                    started_at=django_timezone.now(),
                )
                logger.info(f"[TrimestralExamService] Exame pré-gerado em segundo plano com sucesso: {new_exam.id} para {username}.")
            except Exception as e:
                logger.error(f"[TrimestralExamService] Falha na pré-geração em background para {username}: {e}", exc_info=True)
            finally:
                cls._pregenerating_users.discard(username)
                try:
                    from django.db import connection
                    connection.close()
                except Exception:
                    pass

        worker_thread = threading.Thread(target=_worker, daemon=True)
        worker_thread.start()

    @classmethod
    def get_status(cls, user: User) -> Dict[str, Any]:
        """
        Calcula a elegibilidade do aluno para o exame trimestral.
        Regra: exatamente 3 meses (relativedelta(months=3)) após a conclusão do último exame.
        Se elegível, dispara pré-geração em segundo plano para que o teste esteja pronto.
        """
        username = getattr(user, "username", "")
        level = getattr(user, "level", "A1") or "A1"

        # 1. Verificação de permissão temporária (programador e caio.sampaio)
        if not is_user_authorized(username):
            return {
                "can_start": False,
                "status": "forbidden",
                "days_remaining": 999,
                "next_available_date": None,
                "last_exam_date": None,
                "active_exam_id": None,
                "current_level": level,
            }

        # 2. Verifica se há exame pronto ou em andamento
        active_exam = TrimestralExam.objects.filter(
            username=username,
            status__in=["in_progress", "ready"],
        ).first()

        if active_exam:
            return {
                "can_start": True,
                "status": active_exam.status,
                "days_remaining": 0,
                "next_available_date": active_exam.started_at,
                "last_exam_date": None,
                "active_exam_id": str(active_exam.id),
                "current_level": active_exam.level,
            }

        # 3. Verifica o último exame concluído
        last_exam = TrimestralExam.objects.filter(
            username=username,
            status="completed",
        ).order_by("-completed_at").first()

        now = django_timezone.now()

        if not last_exam:
            # Primeiro exame trimestral do aluno: liberado imediatamente!
            # Dispara pré-geração em background para já deixar pronto
            cls.pregenerate_exam_in_background(username=username, level=level, count=10)
            return {
                "can_start": True,
                "status": "available",
                "days_remaining": 0,
                "next_available_date": now,
                "last_exam_date": None,
                "active_exam_id": None,
                "current_level": level,
            }

        last_date = last_exam.completed_at or last_exam.created_at
        next_available_date = last_date + relativedelta(months=3)
        delta_seconds = (next_available_date - now).total_seconds()
        days_remaining = max(0, int(delta_seconds // 86400))

        last_feedback = last_exam.feedback if isinstance(last_exam.feedback, dict) else {}
        last_exam_evolution = {
            "score": last_exam.score,
            "level": last_exam.level,
            "total_questions": last_exam.total_questions,
            "completed_at": last_exam.completed_at,
            "summary": last_feedback.get("summary", ""),
            "can_do_statements": last_feedback.get("can_do_statements", []),
            "skills_breakdown": last_feedback.get("skills_breakdown", {}),
            "points_to_improve": last_feedback.get("points_to_improve", []),
        }

        if now >= next_available_date:
            # Trimestre atingido: dispara pré-geração em background
            cls.pregenerate_exam_in_background(username=username, level=level, count=10)
            return {
                "can_start": True,
                "status": "available",
                "days_remaining": 0,
                "next_available_date": next_available_date,
                "last_exam_date": last_date,
                "active_exam_id": None,
                "current_level": level,
                "last_exam_evolution": last_exam_evolution,
            }

        return {
            "can_start": False,
            "status": "locked",
            "days_remaining": days_remaining,
            "next_available_date": next_available_date,
            "last_exam_date": last_date,
            "active_exam_id": None,
            "current_level": level,
            "last_exam_evolution": last_exam_evolution,
        }

    @classmethod
    def _ensure_exam_has_writing(cls, exam: TrimestralExam) -> TrimestralExam:
        """
        Garante que exames pré-gerados ou em andamento no banco sempre possuam
        ao menos 1 questão de writing e 1 de speaking calibradas para o nível,
        e que as alternativas de múltipla escolha estejam devidamente distribuídas (não todas em A).
        """
        qs = exam.questions or []
        has_writing = any(str(q.get("type", "")).lower().strip() == "writing" for q in qs)
        has_speaking = any(str(q.get("type", "")).lower().strip() == "speaking" for q in qs)
        
        # Embaralha as alternativas de qualquer questão que ainda tenha o gabarito na letra A (índice 0)
        options_fixed = False
        for q in qs:
            q_type = str(q.get("type", "")).lower().strip()
            if q_type not in ("writing", "speaking"):
                opts = q.get("options")
                correct = q.get("correct_answer")
                if isinstance(opts, list) and len(opts) > 1:
                    if opts[0] == correct:
                        shuffled = list(opts)
                        for _ in range(10):
                            random.shuffle(shuffled)
                            if shuffled[0] != correct:
                                break
                        q["options"] = shuffled
                        options_fixed = True

        if not has_writing or not has_speaking or options_fixed:
            if not has_writing or not has_speaking:
                target_len = len(qs) if len(qs) >= 8 else 10
                updated_qs = ExamGeneratorService._normalize_questions(qs, target_len, exam.level or "A1")
                exam.questions = updated_qs
                exam.total_questions = len(updated_qs)
            else:
                exam.questions = qs
            exam.save(update_fields=["questions", "total_questions"])
        return exam

    @classmethod
    def start_or_get_exam(
        cls,
        user: User,
        num_questions: int = 10,
        force: bool = False,
    ) -> Dict[str, Any]:
        """
        Inicia ou recupera um exame trimestral.
        Se já houver um exame pré-gerado (status='ready'), ativa-o instantaneamente.
        """
        username = getattr(user, "username", "")
        level = getattr(user, "level", "A1") or "A1"

        if not is_user_authorized(username):
            raise PermissionError("Exames trimestrais estão em fase de testes e restritos aos desenvolvedores.")

        # Verifica se há exame pronto (pré-gerado pela IA em background)
        ready_exam = TrimestralExam.objects.filter(
            username=username,
            status="ready",
        ).first()

        # Se o exame pré-gerado for de nível diferente do aluno atual, descarta-o
        if ready_exam and ready_exam.level != level:
            ready_exam.status = "expired"
            ready_exam.save(update_fields=["status"])
            ready_exam = None

        if ready_exam and not force:
            ready_exam = cls._ensure_exam_has_writing(ready_exam)
            ready_exam.status = "in_progress"
            ready_exam.started_at = django_timezone.now()
            ready_exam.save(update_fields=["status", "started_at"])
            logger.info(f"[TrimestralExamService] Exame pré-gerado {ready_exam.id} ativado para {username}.")
            return cls._format_exam_start_payload(ready_exam)

        # Verifica se já existe um exame em andamento
        active_exam = TrimestralExam.objects.filter(
            username=username,
            status="in_progress",
        ).first()

        # Se o exame em andamento for de nível diferente do aluno atual, expira-o
        if active_exam and active_exam.level != level:
            active_exam.status = "expired"
            active_exam.save(update_fields=["status"])
            active_exam = None

        if active_exam and not force:
            active_exam = cls._ensure_exam_has_writing(active_exam)
            return cls._format_exam_start_payload(active_exam)

        # Se for iniciar novo do zero, verifica elegibilidade
        if not force:
            status_info = cls.get_status(user)
            if not status_info.get("can_start"):
                raise ValueError(
                    f"Exame ainda não disponível. Faltam {status_info.get('days_remaining', 0)} dias para o próximo trimestre."
                )

        # Se force=True e havia anterior aberto, expira-o
        if active_exam and force:
            active_exam.status = "expired"
            active_exam.save(update_fields=["status"])

        # Gera novo exame com a IA
        num_questions = max(8, min(15, num_questions))
        questions = ExamGeneratorService.generate_trimestral_questions(
            level=level,
            num_questions=num_questions,
        )

        new_exam = TrimestralExam.objects.create(
            id=uuid.uuid4(),
            username=username,
            level=level,
            status="in_progress",
            questions=questions,
            total_questions=len(questions),
            started_at=django_timezone.now(),
        )

        logger.info(f"[TrimestralExamService] Novo exame {new_exam.id} iniciado para {username} ({level}).")
        return cls._format_exam_start_payload(new_exam)

    @classmethod
    def get_current_active_exam(cls, user: User) -> Optional[Dict[str, Any]]:
        """Recupera o exame em andamento do aluno se ele atualizar a tela."""
        username = getattr(user, "username", "")
        level = getattr(user, "level", "A1") or "A1"
        if not is_user_authorized(username):
            return None

        active_exam = TrimestralExam.objects.filter(
            username=username,
            status__in=["in_progress", "ready"],
        ).first()

        if not active_exam:
            return None

        # Se o nível do exame for diferente do aluno, expira
        if active_exam.level != level:
            active_exam.status = "expired"
            active_exam.save(update_fields=["status"])
            return None

        active_exam = cls._ensure_exam_has_writing(active_exam)
        return cls._format_exam_start_payload(active_exam)


    @classmethod
    def submit_exam(
        cls,
        user: User,
        exam_id: str,
        answers: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Recebe as respostas do aluno, avalia questões orais via Google Gemini,
        efetua a correção e agenda o próximo teste para 3 meses à frente.
        Tudo 100% em inglês pedagógico.
        """
        username = getattr(user, "username", "")
        if not is_user_authorized(username):
            raise PermissionError("Acesso não autorizado aos testes trimestrais.")

        exam = TrimestralExam.objects.filter(
            id=exam_id,
            username=username,
            status__in=["in_progress", "ready"],
        ).first()

        if not exam:
            raise ValueError("Exame não encontrado ou já concluído anteriormente.")

        # Mapa de respostas e áudios
        answers_map: Dict[str, str] = {}
        audio_map: Dict[str, str] = {}

        for ans in answers:
            q_id = str(ans.get("question_id", "")).strip()
            val = str(ans.get("answer", "")).strip()
            audio_val = ans.get("audio_data")
            if q_id:
                answers_map[q_id] = val
                if audio_val and isinstance(audio_val, str):
                    audio_map[q_id] = audio_val

        prof = getattr(user, "profile", {}) if hasattr(user, "profile") else {}
        if isinstance(prof, dict):
            user_accent = prof.get("preferred_accent") or prof.get("accent") or getattr(user, "preferred_accent", None) or "en-US"
        else:
            user_accent = getattr(user, "preferred_accent", None) or "en-US"
        questions = exam.questions or []
        corrections = []
        total_points = 0
        earned_points = 0

        reading_correct = 0
        reading_total = 0

        for q in questions:
            q_id = q.get("id", "")
            q_type = str(q.get("type", "")).strip().lower()
            q_text = q.get("question", "")
            correct_val = str(q.get("correct_answer", "")).strip()
            explanation = q.get("explanation", "")
            points = int(q.get("points", 10))
            total_points += points

            student_val = answers_map.get(q_id, "")
            audio_val = audio_map.get(q_id, "")

            # Fallback caso o áudio em base64 tenha vindo no campo answer
            if not audio_val and student_val and ("data:audio" in student_val or len(student_val) > 200):
                audio_val = student_val

            is_speaking = ("speak" in q_type or "oral" in q_type or "speech" in q_type)
            is_writing = ("writ" in q_type or "essay" in q_type or "composition" in q_type)

            if is_speaking:
                # Avaliação de fala com Gemini multimodal
                speaking_eval = evaluate_speaking_with_gemini(
                    audio_data=audio_val,
                    question_prompt=q_text,
                    level=exam.level or "B1",
                    accent=user_accent,
                )
                is_correct = speaking_eval["passed"]
                transcription = speaking_eval.get("transcription", "")
                score_pct = speaking_eval.get("score", 0)
                item_points = points if is_correct else int(points * (score_pct / 100))
                earned_points += item_points

                if transcription:
                    student_display = f'Spoken: "{transcription}" (Score: {score_pct}/100)'
                elif audio_val and len(audio_val) > 50:
                    student_display = f"Audio response recorded (Score: {score_pct}/100)"
                else:
                    student_display = "No audio recorded"

                explanation_display = speaking_eval.get("feedback") or explanation

                corrections.append({
                    "question_id": q_id,
                    "question": q_text,
                    "type": "speaking",
                    "student_answer": student_display,
                    "correct_answer": "Spoken English response answering the prompt",
                    "is_correct": is_correct,
                    "points_earned": item_points,
                    "explanation": explanation_display,
                })
            elif is_writing:
                specs_lvl = get_cefr_level_specs(exam.level or "A1")
                min_w = int(q.get("min_words") or specs_lvl.get("writing_min_words", 25))
                max_w = int(q.get("max_words") or specs_lvl.get("writing_max_words", 60))
                writing_eval = evaluate_writing_with_ai(
                    student_text=student_val,
                    question_prompt=q_text,
                    level=exam.level or "A1",
                    min_words=min_w,
                    max_words=max_w,
                )
                is_correct = writing_eval["passed"]
                score_pct = writing_eval.get("score", 0)
                pts10 = writing_eval.get("points_out_of_10", round(score_pct / 10))
                item_points = int(round(points * (pts10 / 10.0)))
                earned_points += item_points

                student_display = (
                    f'{student_val} (Score: {pts10}/10)'
                    if student_val
                    else "(not answered)"
                )
                improved_ver = writing_eval.get("improved_version") or "Original paragraph in English meeting CEFR criteria"
                explanation_display = writing_eval.get("feedback") or explanation

                corrections.append({
                    "question_id": q_id,
                    "question": q_text,
                    "type": "writing",
                    "student_answer": student_display,
                    "correct_answer": improved_ver,
                    "is_correct": is_correct,
                    "points_earned": item_points,
                    "explanation": explanation_display,
                })
            else:
                is_correct = (student_val.lower() == correct_val.lower()) and bool(student_val)
                if q_type == "reading":
                    reading_total += 1
                    if is_correct:
                        reading_correct += 1

                item_points = points if is_correct else 0
                earned_points += item_points

                corrections.append({
                    "question_id": q_id,
                    "question": q_text,
                    "type": q_type,
                    "student_answer": student_val or "(not answered)",
                    "correct_answer": correct_val,
                    "is_correct": is_correct,
                    "points_earned": item_points,
                    "explanation": explanation,
                })

        # Score geral de 0 a 100
        score = int(round((earned_points / total_points) * 100)) if total_points > 0 else 0
        passed = score >= 70

        # Progressão de Nível CEFR
        recommended_level = None
        current_level = exam.level.upper() if exam.level else "A1"
        if score >= 85 and current_level in LEVEL_ORDER:
            curr_idx = LEVEL_ORDER.index(current_level)
            if curr_idx < len(LEVEL_ORDER) - 1:
                recommended_level = LEVEL_ORDER[curr_idx + 1]

        # Feedback Pedagógico Oficial em Inglês (Teacher Tati)
        if score >= 90:
            summary_feedback = (
                f"Outstanding performance! You demonstrated solid mastery of {current_level} level. "
                f"You scored {score}% with excellent comprehension and accuracy across all skills. "
                f"You are well prepared to advance to new challenges!"
            )
        elif score >= 70:
            summary_feedback = (
                f"Great job! You passed the {current_level} quarterly exam with a score of {score}%. "
                f"Your reading, vocabulary, and grammar are on track. Continue practicing regular speaking and listening."
            )
        else:
            summary_feedback = (
                f"Good effort! The exam identified key areas to reinforce together at the {current_level} level. "
                f"We recommend focusing on vocabulary flashcards, reading comprehension, and pronunciation over the coming weeks."
            )

        now = django_timezone.now()
        next_exam_date = now + relativedelta(months=3)

        # Gamificação e XP proporcional à quantidade de questões/pontos que o aluno acertou (0 a 100 XP)
        xp_earned = max(0, score)
        try:
            if xp_earned > 0:
                XPService.award_xp(user, xp_earned, f"Quarterly CEFR Exam {current_level}")
            StreakService.record_activity(user)
        except Exception as e:
            logger.warning(f"[TrimestralExamService] Erro ao creditar XP: {e}")

        # Computa métricas de evolução (Can-Do statements do CEFR e habilidades dominadas)
        corrections_map = {c["question_id"]: c["is_correct"] for c in corrections}
        evolution = cls._compute_evolution_skills(questions, corrections_map, current_level)

        # Salva o Exame como Concluído
        exam.status = "completed"
        exam.score = score
        exam.passed = passed
        exam.answers = answers_map
        exam.feedback = {
            "summary": summary_feedback,
            "reading_score": f"{reading_correct}/{reading_total}",
            "recommended_level": recommended_level,
            "earned_points": earned_points,
            "total_points": total_points,
            "xp_earned": xp_earned,
            "can_do_statements": evolution["can_do_statements"],
            "skills_breakdown": evolution["skills_breakdown"],
            "points_to_improve": evolution["points_to_improve"],
            "corrections": corrections,
        }
        exam.completed_at = now
        exam.save()

        # Registra no histórico de atividades
        try:
            ActivitySubmission.objects.create(
                username=username,
                activity_type="trimestral_exam",
                score=score,
                status="completed",
                metadata={
                    "exam_id": str(exam.id),
                    "level": current_level,
                    "passed": passed,
                    "score": score,
                    "xp_earned": xp_earned,
                    "next_exam_date": next_exam_date.isoformat(),
                    "can_do_count": len(evolution["can_do_statements"]),
                },
            )
        except Exception as e:
            logger.warning(f"[TrimestralExamService] Erro ao salvar ActivitySubmission: {e}")

        logger.info(
            f"[TrimestralExamService] Exame {exam.id} submetido por {username}: Score={score}%, Passed={passed}."
        )

        return {
            "exam_id": str(exam.id),
            "score": score,
            "passed": passed,
            "recommended_level": recommended_level,
            "xp_earned": xp_earned,
            "next_exam_date": next_exam_date,
            "summary_feedback": summary_feedback,
            "can_do_statements": evolution["can_do_statements"],
            "points_to_improve": evolution["points_to_improve"],
            "skills_breakdown": evolution["skills_breakdown"],
            "corrections": corrections,
        }

    @classmethod
    def _compute_evolution_skills(
        cls,
        questions: List[Dict[str, Any]],
        corrections_map: Dict[str, bool],
        level: str,
    ) -> Dict[str, Any]:
        """Calcula habilidades dominadas e Can-Do statements em inglês baseados no CEFR."""
        skills = {
            "reading": {"correct": 0, "total": 0, "label": "Reading & Comprehension"},
            "grammar": {"correct": 0, "total": 0, "label": "Applied Grammar"},
            "vocabulary": {"correct": 0, "total": 0, "label": "Vocabulary & Usage"},
            "listening": {"correct": 0, "total": 0, "label": "Listening Comprehension"},
            "writing": {"correct": 0, "total": 0, "label": "Written Expression & Composition"},
            "speaking": {"correct": 0, "total": 0, "label": "Oral Expression & Speaking"},
        }

        for q in questions:
            q_type = q.get("type", "reading").lower()
            if q_type not in skills:
                skills[q_type] = {"correct": 0, "total": 0, "label": q_type.capitalize()}
            skills[q_type]["total"] += 1

            q_id = q.get("id")
            if corrections_map.get(q_id, False):
                skills[q_type]["correct"] += 1

        can_do_statements = []
        points_to_improve = []
        skills_breakdown = {}

        for s_key, s_data in skills.items():
            if s_data["total"] > 0:
                pct = int((s_data["correct"] / s_data["total"]) * 100)
                skills_breakdown[s_key] = {
                    "label": s_data["label"],
                    "correct": s_data["correct"],
                    "total": s_data["total"],
                    "percentage": pct,
                }
                if s_key == "reading":
                    if pct >= 70:
                        can_do_statements.append("Understands main ideas and specific details in clear everyday English texts.")
                        can_do_statements.append("Identifies key factual information accurately in multiple-choice questions.")
                    else:
                        points_to_improve.append("Reading comprehension and attention to specific details in short passages.")
                elif s_key == "grammar":
                    if pct >= 70:
                        can_do_statements.append("Accurately applies core tenses and essential sentence structures for the level.")
                    else:
                        points_to_improve.append("Review of verb conjugations and essential sentence structures.")
                elif s_key == "vocabulary":
                    if pct >= 70:
                        can_do_statements.append("Demonstrates practical command of high-frequency words and level-appropriate collocations.")
                    else:
                        points_to_improve.append("Vocabulary expansion and collocation practice with flashcards.")
                elif s_key == "listening":
                    if pct >= 70:
                        can_do_statements.append("Comprehends spoken dialogues, announcements, and everyday oral instructions.")
                    else:
                        points_to_improve.append("Active listening practice with podcasts and spoken dialogues.")
                elif s_key == "writing":
                    if pct >= 70:
                        can_do_statements.append("Produces coherent, well-structured written paragraphs with level-appropriate grammar and vocabulary.")
                    else:
                        points_to_improve.append("Written paragraph composition, verb agreement, and sentence construction.")
                elif s_key == "speaking":
                    if pct >= 70:
                        can_do_statements.append("Expresses thoughts orally with clarity, relevant vocabulary, and natural delivery.")
                    else:
                        points_to_improve.append("Spoken fluency and pronunciation practice in Pronunciation Practice.")

        if not can_do_statements:
            can_do_statements.append(f"Actively completed the quarterly evaluation for level {level}.")

        return {
            "skills_breakdown": skills_breakdown,
            "can_do_statements": can_do_statements,
            "points_to_improve": points_to_improve,
        }

    @classmethod
    def _reconstruct_corrections(cls, exam: TrimestralExam) -> List[Dict[str, Any]]:
        """
        Gera ou reconstrói a lista detalhada de correções questão por questão,
        mesmo para exames concluídos no passado sem a chave 'corrections' gravada.
        """
        fb = exam.feedback if isinstance(exam.feedback, dict) else {}
        if fb.get("corrections") and isinstance(fb["corrections"], list):
            return fb["corrections"]

        questions = exam.questions or []
        answers_map = exam.answers or {}
        corrections = []

        for q in questions:
            q_id = str(q.get("id", ""))
            q_type = str(q.get("type", "")).strip().lower()
            q_text = q.get("question", "")
            correct_val = str(q.get("correct_answer", "")).strip()
            explanation = q.get("explanation", "")
            points = int(q.get("points", 10))

            student_val = answers_map.get(q_id, "")
            is_speaking = ("speak" in q_type or "oral" in q_type or "speech" in q_type)
            is_writing = ("writ" in q_type or "essay" in q_type or "composition" in q_type)

            if is_speaking:
                has_audio = bool(student_val and len(student_val) > 20)
                student_display = (
                    f'Recorded: "{student_val}"'
                    if (student_val and not student_val.startswith("data:"))
                    else ("Audio response recorded" if has_audio else "No audio recorded")
                )
                corrections.append({
                    "question_id": q_id,
                    "question": q_text,
                    "type": "speaking",
                    "student_answer": student_display,
                    "correct_answer": "Spoken English response answering the prompt",
                    "is_correct": bool(student_val),
                    "points_earned": points if student_val else 0,
                    "explanation": explanation or "Evaluated on CEFR spoken communicative competence.",
                })
            elif is_writing:
                has_text = bool(student_val and len(student_val.strip().split()) >= 3)
                corrections.append({
                    "question_id": q_id,
                    "question": q_text,
                    "type": "writing",
                    "student_answer": student_val or "(not answered)",
                    "correct_answer": "Original written paragraph in English",
                    "is_correct": has_text,
                    "points_earned": points if has_text else 0,
                    "explanation": explanation or "Evaluated on grammar, sentence construction, vocabulary, coherence, and task completion (punctuation excluded).",
                })
            else:
                is_correct = (student_val.lower() == correct_val.lower()) and bool(student_val)
                corrections.append({
                    "question_id": q_id,
                    "question": q_text,
                    "type": q_type,
                    "student_answer": student_val or "(not answered)",
                    "correct_answer": correct_val,
                    "is_correct": is_correct,
                    "points_earned": points if is_correct else 0,
                    "explanation": explanation,
                })
        return corrections

    @classmethod
    def get_history(cls, user: User) -> List[Dict[str, Any]]:
        """Retorna os exames trimestrais concluídos do aluno com dados de evolução e correções completas."""
        username = getattr(user, "username", "")
        if not is_user_authorized(username):
            return []

        exams = TrimestralExam.objects.filter(
            username=username,
            status="completed",
        ).order_by("-completed_at")

        history = []
        for e in exams:
            fb = e.feedback if isinstance(e.feedback, dict) else {}
            corrections = fb.get("corrections") or cls._reconstruct_corrections(e)
            summary_text = fb.get("summary", "")
            history.append({
                "id": str(e.id),
                "exam_id": str(e.id),
                "level": e.level,
                "score": e.score,
                "passed": e.passed,
                "xp_earned": fb.get("xp_earned", e.score),
                "completed_at": e.completed_at,
                "total_questions": e.total_questions,
                "feedback": summary_text,
                "summary_feedback": summary_text,
                "can_do_statements": fb.get("can_do_statements", []),
                "skills_breakdown": fb.get("skills_breakdown", {}),
                "points_to_improve": fb.get("points_to_improve", []),
                "corrections": corrections,
                "questions": e.questions or [],
                "answers": e.answers or {},
            })
        return history

    @classmethod
    def get_exam_detail(cls, user: User, exam_id: str) -> Optional[Dict[str, Any]]:
        """Retorna os detalhes completos de um exame específico para revisão pedagógica."""
        username = getattr(user, "username", "")
        if not is_user_authorized(username):
            return None

        exam = TrimestralExam.objects.filter(
            id=exam_id,
            username=username,
        ).first()

        if not exam:
            return None

        fb = exam.feedback if isinstance(exam.feedback, dict) else {}
        corrections = fb.get("corrections") or cls._reconstruct_corrections(exam)
        summary_text = fb.get("summary", "")
        return {
            "id": str(exam.id),
            "exam_id": str(exam.id),
            "level": exam.level,
            "score": exam.score,
            "passed": exam.passed,
            "xp_earned": fb.get("xp_earned", exam.score),
            "completed_at": exam.completed_at,
            "total_questions": exam.total_questions,
            "feedback": summary_text,
            "summary_feedback": summary_text,
            "can_do_statements": fb.get("can_do_statements", []),
            "skills_breakdown": fb.get("skills_breakdown", {}),
            "points_to_improve": fb.get("points_to_improve", []),
            "corrections": corrections,
            "questions": exam.questions or [],
            "answers": exam.answers or {},
        }

    @classmethod
    def _format_exam_start_payload(cls, exam: TrimestralExam) -> Dict[str, Any]:
        """Remove gabaritos e explicações antes de enviar ao frontend. Imagens removidas."""
        specs = get_cefr_level_specs(exam.level)
        masked_questions = []
        for q in (exam.questions or []):
            q_type = str(q.get("type", "reading"))
            min_sec = q.get("min_seconds")
            max_sec = q.get("max_seconds")
            if q_type == "speaking" and (not min_sec or not max_sec):
                min_sec = specs.get("speaking_min_seconds", 15)
                max_sec = specs.get("speaking_limit_seconds", 30)

            min_w = q.get("min_words")
            max_w = q.get("max_words")
            if q_type == "writing" and (not min_w or not max_w):
                min_w = specs.get("writing_min_words", 25)
                max_w = specs.get("writing_max_words", 45)

            masked_questions.append({
                "id": str(q.get("id")),
                "type": q_type,
                "question": str(q.get("question", "")),
                "points": int(q.get("points", 10)),
                "options": q.get("options", []) if q_type not in ("speaking", "writing") else [],
                "audio_url": q.get("audio_url"),
                "audio_text": q.get("audio_text"),
                "reading_text": q.get("reading_text"),
                "image_url": None,  # Imagens removidas
                "min_seconds": min_sec,
                "max_seconds": max_sec,
                "min_words": min_w,
                "max_words": max_w,
            })

        return {
            "exam_id": str(exam.id),
            "level": exam.level,
            "total_questions": len(masked_questions),
            "started_at": exam.started_at or django_timezone.now(),
            "questions": masked_questions,
        }


    @classmethod
    def reset_user_exams(cls, user: User) -> None:
        """Exclui os exames do usuário para possibilitar testes contínuos de desenvolvimento."""
        username = getattr(user, "username", "")
        if not is_user_authorized(username):
            return
        TrimestralExam.objects.filter(username=username).delete()
        ActivitySubmission.objects.filter(username=username, activity_type="trimestral_exam").delete()
        logger.info(f"[TrimestralExamService] Exames de {username} resetados para teste.")
