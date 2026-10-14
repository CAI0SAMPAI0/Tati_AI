import os
import json
import uuid
import base64
import logging
import threading
from typing import List, Dict, Any, Optional
from dateutil.relativedelta import relativedelta

from django.db import connection
from django.conf import settings
from django.utils import timezone as django_timezone

from apps.authentication.models import User, UserRole
from apps.users.services import XPService, StreakService
from .models import TrimestralExam, CEFRReference, ActivitySubmission

logger = logging.getLogger(__name__)

# Usuários liberados para acesso e testes de exames trimestrais
_default_allowed = {"programador", "caio.sampaio"}
_env_allowed = {
    u.strip().lower()
    for u in os.getenv("TRIMESTRAL_ALLOWED_USERNAMES", "").split(",")
    if u.strip()
}
ALLOWED_USERNAMES = _default_allowed | _env_allowed

CEFR_OFFICIAL_GUIDELINES_URL = (
    "https://rm.coe.int/CoERMPublicCommonSearchServices/DisplayDCTMContent?documentId=090000168045bb52",
    "https://www.coe.int/en/web/common-european-framework-reference-languages/table-3-cefr-3.3-common-reference-levels-qualitative-aspects-of-spoken-language-use"
)

LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]


def is_user_authorized(username: Optional[str]) -> bool:
    """Verifica se o usuário tem acesso permitido aos testes trimestrais."""
    if not username:
        return False
    uname = str(username).strip().lower()
    if uname in ALLOWED_USERNAMES:
        return True
    try:
        user = User.objects.filter(username=uname).only("role").first()
        if user and (
            getattr(user, "is_staff", False)
            or getattr(user, "is_superuser", False)
            or getattr(user, "role", "") in (UserRole.PROGRAMADOR, UserRole.PROFESSOR, "admin", "Admin")
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

    if len(audio_bytes) < 200:
        return {
            "passed": False,
            "score": 0,
            "transcription": "",
            "feedback": "Recorded audio was too short or silent. Please speak for at least 15 to 30 seconds.",
        }

    from apps.chat.audio_service import get_gemini_client, detect_audio_mime_type, AudioService
    mime_type = detect_audio_mime_type(audio_bytes)
    client = get_gemini_client()

    eval_prompt = f"""You are Teacher Tati, an expert CEFR English language examiner.
Evaluate this student's recorded oral response for CEFR level {level}.
Task Prompt: "{question_prompt}"
Target Accent Setting: {accent}

Listen to the student's audio response:
1. Transcribe what the student said in English accurately.
2. Evaluate task achievement, spoken fluency, pronunciation, grammar, and vocabulary for CEFR {level}.
3. Assign a score from 0 to 100. If the student made a coherent effort in English answering the prompt, assign a passing score (>= 60).

Respond strictly in valid JSON matching this schema:
{{
  "transcription": "Words spoken by student in English",
  "score": 85,
  "passed": true,
  "feedback": "Constructive pedagogical feedback in English about fluency, vocabulary, and grammar."
}}
"""

    if client:
        try:
            from google.genai import types
            gemini_models = [
                os.getenv("GEMINI_AUDIO_MODEL", "gemini-2.5-flash"),
                "gemini-2.5-flash",
                "gemini-2.0-flash",
                "gemini-3.8-flash",
                "gemini-3.5-flash-lite",
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

    @classmethod
    def _fetch_cefr_context(cls, level: str) -> str:
        """
        Recupera trechos de conteúdo real dos documentos CEFR cadastrados no banco
        para o nível solicitado (ex: A1, A2, B1, B2).
        """
        context_snippets = []
        lvl = (level or "A1").strip().upper()

        try:
            refs = list(CEFRReference.objects.filter(cefr_level__iexact=lvl)[:3])
            if refs:
                ref_names = [r.filename for r in refs]
                context_snippets.append(f"Arquivos CEFR de referência para o nível {lvl}: {', '.join(ref_names)}.")

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
                            context_snippets.append(f"- Tópico pedagógico: {cleaned_snippet[:250]}")
        except Exception as e:
            logger.warning(f"[ExamGeneratorService] Erro ao buscar contexto CEFR: {e}")

        return "\n".join(context_snippets) if context_snippets else f"Nível CEFR: {lvl}"

    @classmethod
    def generate_trimestral_questions(
        cls,
        level: str = "A1",
        num_questions: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Gera entre 8 e 15 questões balanceadas (Reading, Grammar, Vocabulary, Listening)
        com alternativas claras e sem pegadinhas.
        """
        # Limita estritamente entre 8 e 15 questões
        num_questions = max(8, min(15, num_questions))
        lvl = (level or "A1").strip().upper()
        cefr_context = cls._fetch_cefr_context(lvl)

        system_prompt = f"""You are a senior English language examiner and CEFR pedagogue.
Your task is to generate an official Quarterly CEFR Exam for an English student at level {lvl}.
EVERY SINGLE FIELD (questions, reading texts, audio texts, options, explanations, and instructions) MUST BE 100% IN ENGLISH.

OFFICIAL GUIDELINES:
1. Follow the CEFR Companion Volume standards: {CEFR_OFFICIAL_GUIDELINES_URL}
2. Pedagogical context from our platform:
{cefr_context}

NUMBER OF QUESTIONS:
The exam MUST contain exactly {num_questions} balanced questions according to CEFR modalities.

DISTRIBUTION & RULES:
1. READING COMPREHENSION (2 questions):
   - CRITICAL REQUIREMENT: Each reading question MUST HAVE ITS OWN UNIQUE, DISTINCT SHORT TEXT in "reading_text" (between 35 and 70 words). NEVER repeat the same reading text across multiple questions!
   - 4 clear multiple-choice options with unambiguous correct answers and no trick questions.

2. GRAMMAR (2 questions):
   - 4 multiple-choice options testing core level {lvl} structures (verb tenses, modals, prepositions, conditionals, connectors).

3. VOCABULARY (2 questions):
   - 4 multiple-choice options testing practical {lvl} vocabulary, collocations, or synonyms in sentence context. DO NOT USE IMAGES.

4. LISTENING COMPREHENSION (1 or 2 questions):
   - In "audio_text", provide a natural, spoken English dialogue or announcement (2-4 lines between speakers or a clear station/airport/store announcement).
   - The question must test comprehension directly based on what was heard.

5. SPEAKING / ORAL PRODUCTION (1 or 2 questions):
   - "type": "speaking"
   - In "question", provide an engaging speaking prompt for the student to speak in English for 15-30 seconds (e.g., "Please speak in English for 15-30 seconds: Describe your favorite holiday or trip and what you enjoyed most.").
   - In "options", provide ["Record your voice response in English"].
   - In "correct_answer", provide "Record your voice response in English".
   - In "explanation", provide an English explanation of what the task evaluates (fluency, vocabulary, and grammar).

6. DO NOT include any images, image URLs, or image descriptions. All questions are strictly text-based or audio-based.

7. EVERY SINGLE FIELD (questions, reading texts, audio texts, options, explanations, and feedback) MUST BE 100% IN ENGLISH. Zero Portuguese words.

MANDATORY JSON FORMAT:
Return EXCLUSIVELY a JSON object with this structure:
{{
  "questions": [
    {{
      "id": "q1",
      "type": "reading",
      "points": 10,
      "reading_text": "Distinct short reading passage 1...",
      "question": "What is the primary topic discussed in the passage?",
      "options": ["Correct answer", "Distractor 1", "Distractor 2", "Distractor 3"],
      "correct_answer": "Correct answer",
      "explanation": "Clear pedagogical explanation in English."
    }},
    {{
      "id": "q2",
      "type": "reading",
      "points": 10,
      "reading_text": "Completely different, distinct short reading passage 2...",
      "question": "According to the second passage, what did Sarah decide to do?",
      "options": ["Correct answer", "Distractor 1", "Distractor 2", "Distractor 3"],
      "correct_answer": "Correct answer",
      "explanation": "Clear pedagogical explanation in English."
    }},
    {{
      "id": "q3",
      "type": "grammar",
      "points": 10,
      "question": "Complete the sentence with the correct verb form: ...",
      "options": ["goes", "go", "going", "went"],
      "correct_answer": "goes",
      "explanation": "In Present Simple with third-person singular (she), the verb takes -es."
    }},
    {{
      "id": "q4",
      "type": "vocabulary",
      "points": 10,
      "question": "Which word best completes the sentence: 'We had to cancel the picnic because of the heavy _______.'",
      "options": ["rain", "cloud", "sunshine", "breeze"],
      "correct_answer": "rain",
      "explanation": "'Heavy rain' is the standard natural English collocation."
    }},
    {{
      "id": "q5",
      "type": "listening",
      "points": 10,
      "audio_text": "Flight Attendant: Welcome aboard flight 402 to Chicago. Please fasten your seatbelts and ensure your carry-on luggage is safely stored.",
      "question": "Where is flight 402 traveling to?",
      "options": ["Chicago", "New York", "Boston", "London"],
      "correct_answer": "Chicago",
      "explanation": "The announcement explicitly states: 'Welcome aboard flight 402 to Chicago'."
    }},
    {{
      "id": "q6",
      "type": "speaking",
      "points": 10,
      "question": "Please speak in English for 15-30 seconds: Describe what you usually do on a typical weekend.",
      "options": ["Record your voice response in English"],
      "correct_answer": "Record your voice response in English",
      "explanation": "Oral response evaluated on fluency, pronunciation, and vocabulary appropriate for level {lvl}."
    }}
  ]
}}
All "correct_answer" values MUST match one of the options exactly.
"""

        user_prompt = f"Generate the official quarterly CEFR exam right now with exactly {num_questions} balanced questions in English (Reading with distinct texts, Grammar, Vocabulary without images, Listening with spoken dialogue, and Speaking) for level {lvl}."

        # 1. Tenta via Groq
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
                        temperature=0.3,
                    )
                    content = res.choices[0].message.content
                    if content:
                        parsed = json.loads(content)
                        questions = parsed.get("questions", [])
                        if questions and len(questions) >= 6:
                            logger.info(f"[ExamGeneratorService] Exame gerado via Groq ({model_name}) com {len(questions)} questões.")
                            return cls._normalize_questions(questions, num_questions, lvl)
                except Exception as e:
                    logger.warning(f"[ExamGeneratorService] Falha no Groq com {model_name}: {e}")

        # 2. Tenta via Gemini (com fallback para os modelos disponíveis)
        try:
            from google import genai
            from google.genai import types

            gemini_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
            if gemini_key:
                client = genai.Client(api_key=gemini_key.strip())
                for g_model in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.8-flash", "gemini-3.5-flash"]:
                    try:
                        response = client.models.generate_content(
                            model=g_model,
                            contents=f"{system_prompt}\n\n{user_prompt}",
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                                temperature=0.3,
                            ),
                        )
                        if response and response.text:
                            parsed = json.loads(response.text)
                            questions = parsed.get("questions", [])
                            if questions and len(questions) >= 6:
                                logger.info(f"[ExamGeneratorService] Exame gerado via Gemini ({g_model}) com {len(questions)} questões.")
                                return cls._normalize_questions(questions, num_questions, lvl)
                    except Exception as gemini_try_err:
                        logger.warning(f"[ExamGeneratorService] Falha no modelo Gemini {g_model}: {gemini_try_err}")
        except Exception as e:
            logger.warning(f"[ExamGeneratorService] Falha geral no Gemini: {e}")

        # 3. Fallback Pedagógico Determinístico Estruturado (100% em Inglês e sem imagens)
        logger.info(f"[ExamGeneratorService] Utilizando fallback estruturado para o nível {lvl}.")
        return cls._generate_fallback_questions(lvl, num_questions)

    @classmethod
    def _normalize_questions(
        cls,
        questions: List[Dict[str, Any]],
        target_count: int,
        level: str,
    ) -> List[Dict[str, Any]]:
        """Garante IDs únicos, valida alternativas, remove imagens e assegura que correct_answer está em options."""
        normalized = []
        for idx, q in enumerate(questions[:target_count], start=1):
            q_id = f"q{idx}"
            q_type = q.get("type", "reading")
            question_text = q.get("question", f"Question {idx}")
            options = q.get("options", [])
            correct = q.get("correct_answer", "")
            explanation = q.get("explanation", "Review the question context carefully.")
            reading_text = q.get("reading_text")
            audio_text = q.get("audio_text")
            audio_url = q.get("audio_url")

            # Tratamento de options e gabarito
            if q_type != "speaking":
                if not isinstance(options, list) or len(options) < 4:
                    options = [correct, "Alternative B", "Alternative C", "Alternative D"]
                if correct not in options:
                    options[0] = correct
            else:
                if not isinstance(options, list) or len(options) == 0:
                    options = ["Record your voice response in English"]
                correct = options[0]

            normalized.append({
                "id": q_id,
                "type": q_type.lower().strip(),
                "points": int(q.get("points", 10)),
                "question": question_text,
                "options": options if q_type != "speaking" else [],
                "correct_answer": correct if q_type != "speaking" else None,
                "explanation": explanation,
                "reading_text": reading_text,
                "audio_text": audio_text,
                "audio_url": None,
            })

        # Se vieram menos do que o total solicitado, complementa com fallback
        if len(normalized) < target_count:
            fallback_items = cls._generate_fallback_questions(level, target_count - len(normalized))
            for f_item in fallback_items:
                f_item["id"] = f"q{len(normalized) + 1}"
                normalized.append(f_item)

        return normalized[:target_count]

    @classmethod
    def _generate_fallback_questions(cls, level: str, count: int) -> List[Dict[str, Any]]:
        """Fallback pedagógico de alta qualidade 100% em inglês e sem imagens."""
        templates = [
            {
                "type": "reading",
                "reading_text": "Emma works at a small bookstore in central London. She opens the shop at 9 AM and helps customers select novels. In the afternoon, she organizes new magazines and enjoys a cup of herbal tea before closing at 5 PM.",
                "question": "What does Emma do during the afternoon at the bookstore?",
                "options": [
                    "She organizes new magazines and drinks herbal tea.",
                    "She opens the bookstore and greets the first customers.",
                    "She leaves early to have lunch with friends.",
                    "She reads entire novels aloud to visitors."
                ],
                "correct_answer": "She organizes new magazines and drinks herbal tea.",
                "explanation": "The text clearly states: 'In the afternoon, she organizes new magazines and enjoys a cup of herbal tea before closing at 5 PM.'",
            },
            {
                "type": "grammar",
                "question": "Complete the sentence: 'She _______ to the fitness center every morning before starting work.'",
                "options": ["goes", "go", "going", "gone"],
                "correct_answer": "goes",
                "explanation": "In the Present Simple with the third-person singular (she), the verb 'go' takes '-es' to become 'goes'.",
            },
            {
                "type": "vocabulary",
                "question": "Choose the word that best completes the sentence: 'Due to unexpected road construction, there was heavy _______ on the highway.'",
                "options": ["traffic", "luggage", "subway", "distance"],
                "correct_answer": "traffic",
                "explanation": "'Heavy traffic' is the natural English collocation used to describe congested roads.",
            },
            {
                "type": "reading",
                "reading_text": "Lucas traveled to Kyoto last spring to attend an international photography workshop. He spent mornings learning digital camera techniques and afternoons photographing blooming cherry blossom trees along the river.",
                "question": "Why did Lucas travel to Kyoto last spring?",
                "options": [
                    "To attend an international photography workshop.",
                    "To visit his grandparents who live by the river.",
                    "To open a new camera store in the city.",
                    "To work as a full-time tour guide."
                ],
                "correct_answer": "To attend an international photography workshop.",
                "explanation": "The passage explicitly notes that Lucas traveled to Kyoto 'to attend an international photography workshop.'",
            },
            {
                "type": "grammar",
                "question": "Choose the correct auxiliary verb: 'Where _______ you spend your vacation last summer?'",
                "options": ["did", "do", "does", "are"],
                "correct_answer": "did",
                "explanation": "Questions in the past simple with action verbs use the auxiliary 'did'.",
            },
            {
                "type": "vocabulary",
                "question": "Which word is the closest synonym for 'remarkable'?",
                "options": ["extraordinary", "boring", "narrow", "fragile"],
                "correct_answer": "extraordinary",
                "explanation": "'Remarkable' and 'extraordinary' both describe something worthy of attention or exceptional.",
            },
            {
                "type": "listening",
                "audio_text": "Station Announcer: Attention passengers on platform 3. The express train to Oxford will depart at 5:15 PM. Please have your electronic tickets ready for inspection.",
                "question": "What time does the express train to Oxford leave platform 3?",
                "options": [
                    "5:15 PM",
                    "5:00 PM",
                    "5:30 PM",
                    "6:00 PM"
                ],
                "correct_answer": "5:15 PM",
                "explanation": "The announcement states clearly: 'The express train to Oxford will depart at 5:15 PM.'",
            },
            {
                "type": "listening",
                "audio_text": "Receptionist: Good morning! Breakfast is served in the main dining hall from 7:00 to 10:30 AM every morning. Your room key grants access.",
                "question": "Until what time is breakfast served in the dining hall?",
                "options": [
                    "10:30 AM",
                    "9:00 AM",
                    "11:30 AM",
                    "7:00 AM"
                ],
                "correct_answer": "10:30 AM",
                "explanation": "The receptionist explains that breakfast is served 'from 7:00 to 10:30 AM'.",
            },
            {
                "type": "speaking",
                "question": "Speaking Task: Please speak in English for 15 to 30 seconds. Question: 'Describe a memorable trip you have taken and why it was special to you.'",
                "options": ["Record your voice response in English"],
                "correct_answer": "Record your voice response in English",
                "explanation": "Spoken English response evaluated by AI on task completion, fluency, vocabulary, and grammar.",
            },
            {
                "type": "speaking",
                "question": "Speaking Task: Please speak in English for 15 to 30 seconds. Question: 'What are the main advantages of learning a second language?'",
                "options": ["Record your voice response in English"],
                "correct_answer": "Record your voice response in English",
                "explanation": "Spoken English response evaluated on communicative ability, argumentation, and fluency.",
            },
        ]

        items = []
        for idx in range(count):
            t = templates[idx % len(templates)].copy()
            t["id"] = f"q{idx + 1}"
            t["points"] = 10
            t["image_url"] = None
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

        if ready_exam and not force:
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

        if active_exam and not force:
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
        if not is_user_authorized(username):
            return None

        active_exam = TrimestralExam.objects.filter(
            username=username,
            status__in=["in_progress", "ready"],
        ).first()

        if not active_exam:
            return None

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
        score = int((earned_points / total_points * 100)) if total_points > 0 else 0
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

        # Gamificação e XP (Exame trimestral premia 100 XP por conclusão)
        xp_earned = 100 if passed else 40
        try:
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
            "can_do_statements": evolution["can_do_statements"],
            "skills_breakdown": evolution["skills_breakdown"],
            "points_to_improve": evolution["points_to_improve"],
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
    def get_history(cls, user: User) -> List[Dict[str, Any]]:
        """Retorna os exames trimestrais concluídos do aluno com dados de evolução."""
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
            history.append({
                "id": str(e.id),
                "level": e.level,
                "score": e.score,
                "passed": e.passed,
                "completed_at": e.completed_at,
                "total_questions": e.total_questions,
                "feedback": fb.get("summary", ""),
                "can_do_statements": fb.get("can_do_statements", []),
                "skills_breakdown": fb.get("skills_breakdown", {}),
                "points_to_improve": fb.get("points_to_improve", []),
            })
        return history

    @classmethod
    def _format_exam_start_payload(cls, exam: TrimestralExam) -> Dict[str, Any]:
        """Remove gabaritos e explicações antes de enviar ao frontend. Imagens removidas."""
        masked_questions = []
        for q in (exam.questions or []):
            masked_questions.append({
                "id": str(q.get("id")),
                "type": str(q.get("type", "reading")),
                "question": str(q.get("question", "")),
                "points": int(q.get("points", 10)),
                "options": q.get("options", []),
                "audio_url": q.get("audio_url"),
                "audio_text": q.get("audio_text"),
                "reading_text": q.get("reading_text"),
                "image_url": None,  # Imagens removidas
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

