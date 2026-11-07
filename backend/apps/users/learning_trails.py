from django.db import transaction
from apps.notifications.websocket import notify_teacher, notify_user
import copy
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from django.utils import timezone as django_timezone
from apps.authentication.models import User

logger = logging.getLogger(__name__)

# Standard learning trail templates by CEFR level with direct URLs and English content
TRAIL_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "A1": {
        "template_id": "a1_beginner_quest",
        "level": "A1",
        "title": "Beginner Journey: Foundations & Daily Life (A1)",
        "teacher_notes": "Focus on personal introductions, the verb to be, and essential everyday vocabulary.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Phase 1: Personal Introductions & Daily Routine",
                "description": "Learn to introduce yourself, describe everyday objects, and talk about your family.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-a1-1",
                        "category": "grammar",
                        "title": "Present simple forms of 'to be': am/is/are",
                        "description": "Practice affirmative, negative, and interrogative sentences with the verb to be.",
                        "route": "https://test-english.com/grammar-points/a1/present-simple-forms-of-to-be/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-2",
                        "category": "vocabulary",
                        "title": "Common things - A1 English Vocabulary",
                        "description": "Expand your vocabulary with essential everyday objects and personal items.",
                        "route": "https://test-english.com/vocabulary/a1/common-things-a1-english-vocabulary/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-3",
                        "category": "listening",
                        "title": "Meeting people - A1 English Listening Test",
                        "description": "Listen to people meeting for the first time and identify personal details.",
                        "route": "https://test-english.com/listening/a1/meeting-people-a1-english-listening-test/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-4",
                        "category": "reading",
                        "title": "Personal profiles - A1 English Reading Test",
                        "description": "Read short personal profiles and answer reading comprehension questions.",
                        "route": "https://test-english.com/reading/a1/personal-profiles-a1-reading-test/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-5",
                        "category": "simulations",
                        "title": "Simulation: Meeting Someone at a Cafe",
                        "description": "Practice conversational English with Teacher Tati in a friendly cafe greeting.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-a1-p1",
                    "title": "Phase 1 Exam",
                    "description": "Comprehensive evaluation covering grammar, vocabulary, listening, and speaking.",
                    "min_score": 7.0,
                    "is_unlocked": False,
                    "is_completed": False,
                    "score": None,
                    "completed_at": None,
                    "teacher_feedback": None,
                    "route": "/exams",
                },
            },
            {
                "id": "phase-2",
                "number": 2,
                "title": "Phase 2: City Life & Food",
                "description": "Ask for directions, talk about food and restaurants, and describe locations.",
                "duration_days": 30,
                "status": "locked",
                "steps": [
                    {
                        "id": "step-a1-6",
                        "category": "grammar",
                        "title": "There is, there are, some, any - Plural nouns",
                        "description": "Describe places, rooms, and available items using there is/are.",
                        "route": "https://test-english.com/grammar-points/a1/there-is-there-are-some-any/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-7",
                        "category": "vocabulary",
                        "title": "Food and meals - A1 English Vocabulary",
                        "description": "Master essential terms for food, drinks, and ordering at a restaurant.",
                        "route": "https://test-english.com/vocabulary/a1/food-and-meals-a1-english-vocabulary/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-8",
                        "category": "games",
                        "title": "Learning Game: Food & Urban Vocabulary",
                        "description": "Reinforce your knowledge through quick interactive practice.",
                        "route": "/activities?tab=games",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-a1-p2",
                    "title": "Phase 2 Exam",
                    "description": "Evaluation test to assess readiness for Level A2.",
                    "min_score": 7.0,
                    "is_unlocked": False,
                    "is_completed": False,
                    "score": None,
                    "completed_at": None,
                    "teacher_feedback": None,
                    "route": "/exams",
                },
            },
        ],
    },
    "A2": {
        "template_id": "a2_waystage_quest",
        "level": "A2",
        "title": "Autonomy Path: Past Events & Travel (A2)",
        "teacher_notes": "Focus on the Simple Past (regular and irregular verbs) and describing past trips.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Phase 1: Last Holidays & Simple Past",
                "description": "Narrate past events, talk about previous experiences, and ask past questions.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-a2-1",
                        "category": "grammar",
                        "title": "Past simple - Regular and irregular verbs",
                        "description": "Practice affirmative, negative, and question forms with 'Did you...?'",
                        "route": "https://test-english.com/grammar-points/a2/past-simple-regular-irregular/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-2",
                        "category": "vocabulary",
                        "title": "Holidays and travel - A2 English Vocabulary",
                        "description": "Essential terms for booking flights, navigating hotels, and vacations.",
                        "route": "https://test-english.com/vocabulary/a2/holidays-travel-a2-english-vocabulary/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-3",
                        "category": "reading",
                        "title": "A travel blog from London - A2 Reading Test",
                        "description": "Read a travel diary and answer questions about the itinerary.",
                        "route": "https://test-english.com/reading/a2/travel-blog-london-a2-reading-test/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-4",
                        "category": "listening",
                        "title": "Airport announcements - A2 Listening Test",
                        "description": "Listen to boarding gates and airport staff instructions.",
                        "route": "https://test-english.com/listening/a2/airport-announcements-a2-listening-test/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-5",
                        "category": "simulations",
                        "title": "Simulation: Asking for Help at Hotel Reception",
                        "description": "Practice conversational English with Teacher Tati checking into a hotel.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-a2-p1",
                    "title": "Phase 1 Exam",
                    "description": "Evaluation of Simple Past mastery and listening comprehension. Minimum score: 7.0.",
                    "min_score": 7.0,
                    "is_unlocked": False,
                    "is_completed": False,
                    "score": None,
                    "completed_at": None,
                    "teacher_feedback": None,
                    "route": "/exams",
                },
            },
            {
                "id": "phase-2",
                "number": 2,
                "title": "Phase 2: Future Plans & Lifestyle",
                "description": "Express future intentions with 'be going to' and give recommendations with 'should'.",
                "duration_days": 30,
                "status": "locked",
                "steps": [
                    {
                        "id": "step-a2-6",
                        "category": "grammar",
                        "title": "Future forms - Will, be going to, present continuous",
                        "description": "Differentiate between planned intentions and spontaneous decisions.",
                        "route": "https://test-english.com/grammar-points/a2/future-forms-will-be-going-to/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-7",
                        "category": "music",
                        "title": "Music & Lyrics: Sing along with Teacher Tati",
                        "description": "Improve your ear and pronunciation with interactive lyrics.",
                        "route": "/activities?tab=musics",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-a2-p2",
                    "title": "Phase 2 Exam",
                    "description": "Assess complete mastery of A2 topics and readiness for Intermediate B1.",
                    "min_score": 7.0,
                    "is_unlocked": False,
                    "is_completed": False,
                    "score": None,
                    "completed_at": None,
                    "teacher_feedback": None,
                    "route": "/exams",
                },
            },
        ],
    },
    "B1": {
        "template_id": "b1_threshold_quest",
        "level": "B1",
        "title": "Intermediate Trail: Fluency & Career (B1)",
        "teacher_notes": "Focus on the Present Perfect, discourse connectors, and workplace conversations.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Phase 1: Life Experiences & Present Perfect",
                "description": "Connect the past to the present and share professional and personal achievements.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-b1-1",
                        "category": "grammar",
                        "title": "Past simple or present perfect?",
                        "description": "Differentiate between finished past events and ongoing experiences.",
                        "route": "https://test-english.com/grammar-points/b1/past-simple-present-perfect/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-2",
                        "category": "vocabulary",
                        "title": "More daily routines - B1 English Vocabulary",
                        "description": "Expand your vocabulary to discuss routines, tasks, and responsibilities.",
                        "route": "https://test-english.com/vocabulary/b1/more-daily-routines-b1-english-vocabulary/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-3",
                        "category": "reading",
                        "title": "Why your coworkers hate you - B1 English Reading Test",
                        "description": "Engaging workplace article with relevant professional vocabulary.",
                        "route": "https://test-english.com/reading/b1/why-your-coworkers-hate-you-b1-english-reading-test/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-4",
                        "category": "listening",
                        "title": "Personal Work Stories - B1 English Listening Test",
                        "description": "Listen to professionals sharing their career milestones and challenges.",
                        "route": "https://test-english.com/listening/b1/personal-work-stories-b1-english-listening-test/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-5",
                        "category": "simulations",
                        "title": "Simulation: Job Interview in English",
                        "description": "Simulate answering key interview questions with Teacher Tati.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-b1-p1",
                    "title": "Phase 1 Exam",
                    "description": "Comprehensive evaluation covering the activities practiced in Phase 1. Minimum score: 7.0.",
                    "min_score": 7.0,
                    "is_unlocked": False,
                    "is_completed": False,
                    "score": None,
                    "completed_at": None,
                    "teacher_feedback": None,
                    "route": "/exams",
                },
            },
            {
                "id": "phase-2",
                "number": 2,
                "title": "Phase 2: Conditionals, Arguments & Debates",
                "description": "Use First & Second Conditionals to discuss hypothetical scenarios and give opinions.",
                "duration_days": 30,
                "status": "locked",
                "steps": [
                    {
                        "id": "step-b1-6",
                        "category": "grammar",
                        "title": "First, second, and third conditionals",
                        "description": "Express hypothetical situations using 'If I had... I would...'",
                        "route": "https://test-english.com/grammar-points/b1/first-second-third-conditionals/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-7",
                        "category": "flashcards",
                        "title": "Flashcards: Business Connectors & Phrasal Verbs",
                        "description": "Master essential connectors like 'although', 'however', and key phrasal verbs.",
                        "route": "/activities?tab=flashcards",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-b1-p2",
                    "title": "Phase 2 Exam",
                    "description": "Evaluation test assessing readiness for Upper-Intermediate B2.",
                    "min_score": 7.0,
                    "is_unlocked": False,
                    "is_completed": False,
                    "score": None,
                    "completed_at": None,
                    "teacher_feedback": None,
                    "route": "/exams",
                },
            },
        ],
    },
    "B2": {
        "template_id": "b2_vantage_quest",
        "level": "B2",
        "title": "Upper-Intermediate Trail: Spontaneous Fluency (B2)",
        "teacher_notes": "Focus on vocabulary nuances, complex clauses, and persuasive communication.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Phase 1: Persuasive Communication & Complex Structures",
                "description": "Engage in discussions at natural speed and use complex clauses with precision.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-b2-1",
                        "category": "grammar",
                        "title": "Clauses of contrast, purpose, reason and result",
                        "description": "Connect ideas logically with advanced linking structures.",
                        "route": "https://test-english.com/grammar-points/b2/clauses-contrast-purpose-reason-result/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b2-2",
                        "category": "vocabulary",
                        "title": "Feelings and emotions - B2 English Vocabulary",
                        "description": "Nuanced adjectives and idiomatic expressions for precise communication.",
                        "route": "https://test-english.com/vocabulary/b2/feelings-and-emotions-b2-english-vocabulary/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b2-3",
                        "category": "reading",
                        "title": "Remote work trends - B2 English Reading Test",
                        "description": "In-depth editorial article analyzing modern workplace dynamics.",
                        "route": "https://test-english.com/reading/b2/remote-work-trends-b2-reading-test/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b2-4",
                        "category": "listening",
                        "title": "Technical Discussion & Panel - B2 English Listening Test",
                        "description": "Comprehend natural dialogue with various international accents.",
                        "route": "https://test-english.com/listening/b2/panel-discussion-b2-listening-test/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b2-5",
                        "category": "simulations",
                        "title": "Simulation: Negotiating with a Difficult Client",
                        "description": "Defend your proposal with diplomacy and confidence in voice chat.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-b2-p1",
                    "title": "Phase 1 Exam",
                    "description": "Comprehensive evaluation of spoken and written skills. Minimum passing score: 7.0.",
                    "min_score": 7.0,
                    "is_unlocked": False,
                    "is_completed": False,
                    "score": None,
                    "completed_at": None,
                    "teacher_feedback": None,
                    "route": "/exams",
                },
            }
        ],
    },
    "C1": {
        "template_id": "c1_proficiency_quest",
        "level": "C1",
        "title": "Professional Mastery: Eloquence & Precision (C1)",
        "teacher_notes": "Emphatic inversions, academic discourse, and fluent natural speech without hesitation.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Phase 1: Sophisticated Discourse & Nuanced Speech",
                "description": "Native-level textual comprehension and precision in formal and professional contexts.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-c1-1",
                        "category": "grammar",
                        "title": "Negative inversion and cleft sentences",
                        "description": "Master emphatic sentence structures like 'Seldom have I seen...'",
                        "route": "https://test-english.com/grammar-points/c1/negative-inversion-cleft-sentences/",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-c1-2",
                        "category": "simulations",
                        "title": "Simulation: Executive Keynote Presentation & Q&A",
                        "description": "Deliver a professional presentation and answer complex audience questions.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-c1-p1",
                    "title": "Phase 1 Exam",
                    "description": "High-performance evaluation according to CEFR C1 standards. Minimum score: 7.5.",
                    "min_score": 7.5,
                    "is_unlocked": False,
                    "is_completed": False,
                    "score": None,
                    "completed_at": None,
                    "teacher_feedback": None,
                    "route": "/exams",
                },
            }
        ],
    },
}


class LearningTrailService:
    """
    Controlador central de Trilhas de Aprendizado por Fases para Professora Tatiana e Alunos.
    """

    @classmethod
    def get_template_for_level(cls, level: str) -> Dict[str, Any]:
        lvl = (level or "A1").upper().strip()
        if lvl not in TRAIL_TEMPLATES:
            lvl = "B1" if "B" in lvl else "A1"
        return copy.deepcopy(TRAIL_TEMPLATES.get(lvl, TRAIL_TEMPLATES["A1"]))

    @classmethod
    def get_student_trail(cls, user: User) -> Dict[str, Any]:
        """
        Retorna a trilha atual do aluno, sincronizando o progresso
        com as atividades e exames reais realizados no banco de dados.
        Auto-migra trilhas antigas com textos em português para os templates oficiais em inglês.
        """
        username = getattr(user, "username", "")
        level = (getattr(user, "level", "A1") or "A1").upper()

        trail_data = None
        if isinstance(user.weekly_plan, dict) and "learning_trail" in user.weekly_plan:
            trail_data = user.weekly_plan.get("learning_trail")
        elif isinstance(user.study_goals, dict) and "learning_trail" in user.study_goals:
            trail_data = user.study_goals.get("learning_trail")

        # Verifica se a trilha salva é legada (em português ou com rotas antigas /grammar, /vocabulary)
        is_legacy = False
        if trail_data and isinstance(trail_data, dict):
            t_title = str(trail_data.get("title", ""))
            if any(w in t_title for w in ["Trilha", "Jornada", "Caminho", "Aprendiz", "Desbravando", "Fluência", "Carreira", "Maestria"]):
                is_legacy = True
            for ph in trail_data.get("phases", []):
                p_title = str(ph.get("title", ""))
                if any(w in p_title for w in ["Fase", "Experiências", "Apresentações", "Vida na Cidade", "Férias", "Condicionais", "Comunicação", "Discurso"]):
                    is_legacy = True
                for st in ph.get("steps", []):
                    s_route = str(st.get("route", ""))
                    s_title = str(st.get("title", ""))
                    if s_route in ["/grammar", "/vocabulary", "/reading", "/listening", ""] or any(w in s_title for w in ["Vocabulário", "Simulação", "Música"]):
                        is_legacy = True

        if not trail_data or not isinstance(trail_data, dict) or not trail_data.get("phases") or is_legacy:
            fresh = cls.get_template_for_level(level)
            fresh["username"] = username
            fresh["created_at"] = django_timezone.now().isoformat()

            # Se for migração de trilha existente, preserva os passos que o aluno já havia completado
            if is_legacy and trail_data and trail_data.get("phases"):
                for old_p, new_p in zip(trail_data.get("phases", []), fresh.get("phases", [])):
                    for old_s, new_s in zip(old_p.get("steps", []), new_p.get("steps", [])):
                        if old_s.get("is_completed"):
                            new_s["is_completed"] = True
                            new_s["progress"] = new_s.get("target_count", 1)
                            new_s["completed_at"] = old_s.get("completed_at")

            trail_data = fresh
            if not isinstance(user.weekly_plan, dict):
                user.weekly_plan = {}
            user.weekly_plan["learning_trail"] = trail_data
            user.save(update_fields=["weekly_plan"])
            logger.info(f"[LearningTrail] Trilha de {username} migrada para o template em inglês com links diretos.")

        trail_data = cls._sync_live_progress(user, trail_data)
        return trail_data

    @classmethod
    def _sync_live_progress(cls, user: User, trail: Dict[str, Any]) -> Dict[str, Any]:
        """
        Atualiza o status dos steps e do Exame com base no banco de dados.
        Remove emojis legados e assegura nomes limpos em inglês.
        """
        username = getattr(user, "username", "")
        phases = trail.get("phases", [])
        if not phases:
            return trail

        from apps.activities.models import ActivitySubmission, TrimestralExam

        subs = list(
            ActivitySubmission.objects.filter(
                username=username, status="completed"
            ).values("activity_type", "metadata", "created_at")[:100]
        )

        completed_categories = set()
        for s in subs:
            act_type = (s.get("activity_type") or "").lower()
            meta = s.get("metadata") or {}
            cat = (meta.get("category") or "").lower()

            for key in ["grammar", "vocabulary", "reading", "listening", "music", "simulations", "games", "flashcards"]:
                if key in act_type or key in cat:
                    completed_categories.add(key)

        # Checa exames trimestrais concluídos
        completed_exam = (
            TrimestralExam.objects.filter(username=username, status="completed")
            .order_by("-completed_at")
            .first()
        )

        exam_score = completed_exam.score if completed_exam else None
        exam_passed = bool(completed_exam and (completed_exam.passed or (exam_score and exam_score >= 70)))
        exam_date = completed_exam.completed_at.isoformat() if completed_exam and completed_exam.completed_at else None

        all_prior_phases_done = True
        import re

        PT_TO_EN_PHASE_MAP = {
            "Experiências de Vida & Present Perfect": "Life Experiences & Present Perfect",
            "Experiências de Vida": "Life Experiences",
            "Apresentações Pessoais & Rotina Diária": "Personal Introductions & Daily Routine",
            "Vida na Cidade & Alimentação": "City Life & Food",
            "Últimas Férias & Passado Simples": "Last Holidays & Simple Past",
            "Planos Futuros & Estilo de Vida": "Future Plans & Lifestyle",
            "Condicionais, Argumentos & Debates": "Conditionals, Arguments & Debates",
            "Comunicação Profissional & Liderança": "Professional Communication & Leadership",
            "Discurso Fluente & Temas Contemporâneos": "Fluent Speech & Contemporary Topics",
        }

        PT_TO_EN_STEP_MAP = {
            "Vocabulário: Carreira, Entrevistas e Soft Skills": "More daily routines - B1 English Vocabulary",
            "Simulação: Entrevista de Emprego em Inglês": "Simulation: Job Interview in English",
            "Expressões corporativas para falar de responsabilidades e metas.": "Expand your vocabulary to discuss routines, tasks, and responsibilities.",
        }

        t_title = str(trail.get("title", ""))
        for pt_k, en_v in [
            ("Trilha Intermediária", "Intermediate Trail: Fluency & Career (B1)"),
            ("Trilha Iniciante", "Beginner Journey: Foundations & Daily Life (A1)"),
            ("Trilha Autonomia", "Autonomy Path: Past Events & Travel (A2)"),
            ("Trilha Avançada", "Advanced Path: Leadership & Mastery (B2)"),
            ("Trilha Fluência", "Full Fluency: Complex Expression (C1)"),
        ]:
            if pt_k in t_title:
                trail["title"] = en_v
                break

        for idx, phase in enumerate(phases):
            p_num = phase.get("number", idx + 1)
            # Sanitiza título e descrição da fase (remove prefixo redundante Phase X: ou Fase X:)
            raw_p_title = str(phase.get("title", ""))
            cleaned_p_title = re.sub(r'^(Phase|Fase)\s*\d+\s*:\s*', '', raw_p_title, flags=re.IGNORECASE).strip()
            cleaned_p_title = PT_TO_EN_PHASE_MAP.get(cleaned_p_title, cleaned_p_title)
            phase["title"] = (
                cleaned_p_title
                .replace("👑", "")
                .replace("⚔️", "")
                .replace("🏆", "")
                .replace("🔒", "")
                .replace("👩‍🏫", "")
                .strip()
            )
            raw_p_desc = str(phase.get("description", ""))
            cleaned_p_desc = PT_TO_EN_PHASE_MAP.get(raw_p_desc, raw_p_desc)
            phase["description"] = (
                cleaned_p_desc
                .replace("👑", "")
                .replace("⚔️", "")
                .replace("🏆", "")
                .replace("🔒", "")
                .replace("👩‍🏫", "")
                .strip()
            )

            steps = phase.get("steps", [])
            phase_steps_done = 0

            for step in steps:
                cat = step.get("category", "").lower()
                raw_st_title = str(step.get("title", ""))
                cleaned_st_title = PT_TO_EN_STEP_MAP.get(raw_st_title, raw_st_title)
                step["title"] = (
                    cleaned_st_title
                    .replace("👑", "")
                    .replace("⚔️", "")
                    .replace("🏆", "")
                    .replace("🔒", "")
                    .replace("👩‍🏫", "")
                    .strip()
                )
                raw_st_desc = str(step.get("description", ""))
                cleaned_st_desc = PT_TO_EN_STEP_MAP.get(raw_st_desc, raw_st_desc)
                step["description"] = (
                    cleaned_st_desc
                    .replace("👑", "")
                    .replace("⚔️", "")
                    .replace("🏆", "")
                    .replace("🔒", "")
                    .replace("👩‍🏫", "")
                    .strip()
                )

                # Assegura que rotas de atividades pedagógicas apontem para links diretos
                s_route = (step.get("route") or "").strip()
                if not s_route.startswith("http") and not s_route.startswith("/voice"):
                    if cat in ("grammar", "vocabulary", "reading", "listening"):
                        from apps.activities.services import ExternalContentService
                        te_data = ExternalContentService.get_test_english_content("all", cat)
                        items = te_data.get("items", []) if isinstance(te_data, dict) else []
                        s_title_lower = step.get("title", "").lower()
                        match = next((it for it in items if it.get("title", "").lower() in s_title_lower or s_title_lower in it.get("title", "").lower()), None)
                        if match and match.get("url"):
                            step["route"] = match["url"]
                        elif items:
                            step["route"] = items[0].get("url", f"https://test-english.com/{cat}/")

                if step.get("is_completed"):
                    phase_steps_done += 1
                    continue

                if cat in completed_categories:
                    step["is_completed"] = True
                    step["progress"] = step.get("target_count", 1)
                    phase_steps_done += 1

            total_steps = len(steps)
            all_steps_completed = (total_steps > 0 and phase_steps_done >= total_steps)

            boss = phase.get("boss_fight") or {}
            # Limpa título do boss/exam
            b_title = boss.get("title", "")
            if not b_title or "Boss Fight" in b_title or "Transição" in b_title:
                boss["title"] = f"Phase {p_num} Exam"
            boss["title"] = (
                str(boss["title"])
                .replace("👑", "")
                .replace("⚔️", "")
                .replace("🏆", "")
                .replace("🔒", "")
                .replace("Boss Fight: ", "")
                .strip()
            )
            boss["description"] = (
                str(boss.get("description", ""))
                .replace("👑", "")
                .replace("⚔️", "")
                .replace("🏆", "")
                .replace("🔒", "")
                .replace("Boss Fight", "Exam")
                .strip()
            )

            min_score = float(boss.get("min_score", 7.0))
            min_score_percent = min_score * 10 if min_score <= 10 else min_score

            if all_steps_completed:
                boss["is_unlocked"] = True

            if exam_passed and (exam_score is not None and exam_score >= min_score_percent):
                boss["is_unlocked"] = True
                boss["is_completed"] = True
                boss["score"] = round(exam_score / 10.0 if exam_score > 10 else exam_score, 1)
                boss["completed_at"] = exam_date
                phase["status"] = "completed"
            elif phase.get("status") != "completed":
                if all_prior_phases_done:
                    phase["status"] = "active"
                else:
                    phase["status"] = "locked"

            if phase.get("status") == "locked":
                boss["is_unlocked"] = False

            if phase.get("status") == "completed":
                all_prior_phases_done = True
            else:
                all_prior_phases_done = False

            phase["steps_completed_count"] = phase_steps_done
            phase["total_steps_count"] = total_steps
            phase["boss_fight"] = boss

        trail["phases"] = phases
        return trail

    @classmethod
    def save_student_trail(
        cls, teacher_user: User, student_username: str, trail_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Permite à Professora Tatiana salvar uma trilha personalizada para o aluno.
        """
        student = User.objects.filter(username=student_username).first()
        if not student:
            raise ValueError(f"Aluno {student_username} não encontrado.")

        if not isinstance(trail_data, dict):
            raise ValueError("Dados da trilha devem ser um objeto JSON.")

        trail_data["updated_at"] = django_timezone.now().isoformat()
        trail_data["updated_by"] = getattr(teacher_user, "username", "teacher")

        if not isinstance(student.weekly_plan, dict):
            student.weekly_plan = {}

        student.weekly_plan["learning_trail"] = trail_data
        student.save(update_fields=["weekly_plan"])
        from django.core.cache import cache
        cache.delete(f"user_trail_{student_username}")
        cache.delete(f"user_goals_{student_username}")

        logger.info(
            f"[LearningTrail] Trilha do aluno {student_username} atualizada por {teacher_user.username}."
        )
        updated_trail = cls.get_student_trail(student)

        event_data = {
            "student_id": getattr(student, "id", None),
            "student_username": student.username,
            "student_name": getattr(student, "name", student.username),
            "trail": updated_trail,
            "action": "saved",
        }

        def broadcast_trail_save():
            try:
                notify_teacher(
                    event_type="learning_trail_updated",
                    data=event_data,
                )
                if student and getattr(student, "id", None):
                    notify_user(
                        user_id=student.id,
                        event_type="learning_trail_updated",
                        data=event_data,
                    )
            except Exception as err:
                logger.warning(f"[LearningTrail] Erro ao emitir evento WS save_trail: {err}")

        try:
            if transaction.get_connection().in_atomic_block:
                transaction.on_commit(broadcast_trail_save)
            else:
                broadcast_trail_save()
        except Exception:
            broadcast_trail_save()

        return updated_trail

    @classmethod
    def apply_template_to_student(
        cls, teacher_user: User, student_username: str, template_level: str
    ) -> Dict[str, Any]:
        """
        Aplica um template pronto (A1, A2, B1, B2, C1) na trilha do aluno.
        """
        template = cls.get_template_for_level(template_level)
        return cls.save_student_trail(teacher_user, student_username, template)

    @classmethod
    
    @classmethod
    def toggle_step(
        cls,
        user: User,
        student_username: str,
        phase_id: str,
        step_id: str,
        is_completed: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        Alterna ou marca o status de conclusão de um step específico.
        Atualiza também ActivitySubmission, XP e Streak no sistema todo.
        """
        student = User.objects.filter(username=student_username).first()
        if not student:
            raise ValueError("Aluno não encontrado.")

        trail = cls.get_student_trail(student)
        phases = trail.get("phases", [])

        target_found = False
        target_step: Optional[Dict[str, Any]] = None
        completed_now = False

        # Localiza o step e atualiza seu status
        for phase in phases:
            if phase.get("id") == phase_id or not phase_id:
                for step in phase.get("steps", []):
                    if step.get("id") == step_id:
                        was_completed = step.get("is_completed", False)

                        new_status = (
                            is_completed
                            if is_completed is not None
                            else not was_completed
                        )

                        completed_now = not was_completed and new_status

                        step["is_completed"] = new_status
                        step["progress"] = (
                            step.get("target_count", 1) if new_status else 0
                        )
                        step["completed_at"] = (
                            django_timezone.now().isoformat()
                            if new_status else None
                        )

                        target_found = True
                        target_step = step
                        break

            if target_found:
                break

        if not target_found or not target_step:
            raise ValueError(f"Step '{step_id}' não encontrado na trilha.")

        # 2. Sincroniza com SubmissionService para conceder XP e atualizar Streak
        try:
            from apps.activities.services import SubmissionService

            if target_step.get("is_completed"):
                SubmissionService.submit_activity(student, {
                    "activity_id": target_step.get("id"),
                    "activity_type": target_step.get("category", "exercise"),
                    "score": 100,
                    "metadata": {
                        "id": target_step.get("id"),
                        "activity_id": target_step.get("id"),
                        "title": target_step.get("title"),
                        "category": target_step.get("category"),
                        "url": target_step.get("route"),
                        "route": target_step.get("route"),
                        "points_awarded": 25,
                    },
                })
            else:
                SubmissionService.submit_activity(student, {
                    "activity_id": target_step.get("id"),
                    "score": 0,
                    "status": "pending",
                    "metadata": {
                        "id": target_step.get("id"),
                        "activity_id": target_step.get("id"),
                        "url": target_step.get("route"),
                    },
                })

        except Exception as e:
            logger.warning(
                f"[LearningTrail] Aviso ao sincronizar submissão via toggle_step: {e}"
            )

        # 3. Salva a trilha atualizada no banco
        saved_trail = cls.save_student_trail(
            user,
            student_username,
            trail,
        )
        
        # 4. Notifica via WebSocket sempre que o status de uma etapa mudar (Completed ou Pending)
        status_changed = was_completed != new_status
        if status_changed:
            try:
                student.refresh_from_db(fields=["streak_data", "xp_data"])
            except Exception:
                pass
            streak_count = getattr(student, "streak_count", 0) or 0
            total_xp = getattr(student, "total_xp", 0) or 0

            phase_obj = next((p for p in phases if p.get("id") == phase_id or not phase_id), None)
            phase_steps = phase_obj.get("steps", []) if phase_obj else []
            completed_count = sum(1 for s in phase_steps if s.get("is_completed"))
            total_steps = len(phase_steps)
            boss = phase_obj.get("boss_fight", {}) if phase_obj else {}

            event_data = {
                "student_id": getattr(student, "id", None),
                "student_username": student.username,
                "student_name": getattr(student, "name", student.username),
                "phase_id": phase_id or (phase_obj.get("id") if phase_obj else ""),
                "step_id": step_id,
                "step_title": target_step.get("title", ""),
                "is_completed": bool(new_status),
                "progress": target_step.get("progress", 1 if new_status else 0),
                "completed_count": completed_count,
                "total_steps": total_steps,
                "boss_unlocked": bool(boss.get("is_unlocked") or (total_steps > 0 and completed_count == total_steps)),
                "current_streak": streak_count,
                "total_xp": total_xp,
            }

            def broadcast_trail_update():
                try:
                    notify_teacher(
                        event_type="learning_trail_step_updated",
                        data=event_data,
                    )
                    if student and getattr(student, "id", None):
                        notify_user(
                            user_id=student.id,
                            event_type="learning_trail_step_updated",
                            data=event_data,
                        )
                except Exception as err:
                    logger.warning(f"[LearningTrail] Erro ao emitir evento WS: {err}")

            try:
                transaction.on_commit(broadcast_trail_update)
            except Exception:
                broadcast_trail_update()

        return saved_trail

    @classmethod
    def unlock_boss(cls, teacher_user: User, student_username: str, phase_id: str) -> Dict[str, Any]:
        """
        A Professora Tatiana pode liberar manualmente o Exame de uma fase.
        """
        student = User.objects.filter(username=student_username).first()
        if not student:
            raise ValueError("Aluno não encontrado.")

        trail = cls.get_student_trail(student)
        phases = trail.get("phases", [])

        for phase in phases:
            if phase.get("id") == phase_id:
                boss = phase.get("boss_fight") or {}
                boss["is_unlocked"] = True
                phase["boss_fight"] = boss

        return cls.save_student_trail(teacher_user, student_username, trail)

    @classmethod
    def reset_student_trail(cls, teacher_user: User, student_username: str) -> Dict[str, Any]:
        """
        Restaura a trilha do aluno para o estado padrão do seu nível CEFR atual.
        """
        student = User.objects.filter(username=student_username).first()
        if not student:
            raise ValueError("Aluno não encontrado.")

        level = getattr(student, "level", "A1") or "A1"
        fresh_template = cls.get_template_for_level(level)
        return cls.save_student_trail(teacher_user, student_username, fresh_template)
