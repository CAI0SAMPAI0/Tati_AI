"""
Serviço e Estruturas de Trilha de Aprendizado Gamificada (Learning Trails).
Permite que a Professora Tatiana crie e customize planos com Fases (estágios),
atividades obrigatórias (Grammar, Vocab, Reading, Listening, Music, Games, Simulations, PDFs)
e o Boss Fight final (Exame Trimestral da Fase).
"""
import copy
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from django.utils import timezone as django_timezone
from apps.authentication.models import User

logger = logging.getLogger(__name__)

# Modelos padrão de trilhas divididos por nível CEFR
TRAIL_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "A1": {
        "template_id": "a1_beginner_quest",
        "level": "A1",
        "title": "Jornada do Aprendiz: Desbravando o Básico (A1)",
        "teacher_notes": "Concentre-se nos cumprimentos, Simple Present e vocabulário básico do cotidiano.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Fase 1: Apresentações Pessoais & Rotina",
                "description": "Aprenda a se apresentar, falar de onde você é e descrever seus hábitos.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-a1-1",
                        "category": "grammar",
                        "title": "Grammar: Verbo To Be e Pronomes Pessoais",
                        "description": "Pratique a conjugação de 'am, is, are' com frases afirmativas e interrogativas.",
                        "route": "/activities?tab=grammar",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-2",
                        "category": "vocabulary",
                        "title": "Vocabulário: Família, Países e Números",
                        "description": "Expanda seu vocabulário e domine palavras essenciais para apresentações.",
                        "route": "/activities?tab=vocabulary",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-3",
                        "category": "listening",
                        "title": "Listening: Diálogo de Apresentação em Inglês",
                        "description": "Ouça o diálogo entre duas pessoas se conhecendo e identifique os detalhes.",
                        "route": "/activities?tab=listening",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-4",
                        "category": "reading",
                        "title": "Reading: Meu Primeiro Dia de Aula",
                        "description": "Texto curto para treinar leitura inicial e responder perguntas de compreensão.",
                        "route": "/activities?tab=reading",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-5",
                        "category": "simulations",
                        "title": "Simulação: Conhecendo Alguém no Café",
                        "description": "Converse com a Teacher Tati simulando uma saudação amigável.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-a1-p1",
                    "title": "👑 Boss Fight: Phase 1 Exam",
                    "description": "Teste completo de 4 habilidades. Atinja nota mínima de 7.0 para derrotar o Boss e desbloquear a Fase 2!",
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
                "title": "Fase 2: Vida na Cidade & Compras",
                "description": "Pergunte direções, faça compras no mercado e descreva seu ambiente.",
                "duration_days": 30,
                "status": "locked",
                "steps": [
                    {
                        "id": "step-a1-6",
                        "category": "grammar",
                        "title": "Grammar: There is / There are e Preposições de Lugar",
                        "description": "Descreva o que há em uma sala ou bairro usando there is/are.",
                        "route": "/activities?tab=grammar",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-7",
                        "category": "vocabulary",
                        "title": "Vocabulário: Comida, Bebidas e Restaurante",
                        "description": "Aprenda itens do cardápio e termos comuns em restaurantes.",
                        "route": "/activities?tab=vocabulary",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a1-8",
                        "category": "games",
                        "title": "Game: Wordwall das Palavras Urbanas",
                        "description": "Fixe o vocabulário de forma dinâmica e divertida no jogo interativo.",
                        "route": "/activities?tab=games",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-a1-p2",
                    "title": "👑 Boss Fight: Phase 2 Exam",
                    "description": "Desafio decisivo para certificar a conclusão do nível A1 rumo ao nível A2!",
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
        "title": "Caminho da Autonomia: Passado e Viagens (A2)",
        "teacher_notes": "Foque no Simple Past (verbos regulares e irregulares) e descrições de experiências passadas.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Fase 1: Minhas Últimas Férias & Simple Past",
                "description": "Aprenda a narrar eventos que já aconteceram e falar sobre suas lembranças.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-a2-1",
                        "category": "grammar",
                        "title": "Grammar: Simple Past (Regular vs Irregular Verbs)",
                        "description": "Pratique verbos no passado e as perguntas com 'Did you...?'",
                        "route": "/activities?tab=grammar",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-2",
                        "category": "vocabulary",
                        "title": "Vocabulário: Viagens, Aeroporto e Hotéis",
                        "description": "Termos indispensáveis para se virar em viagens ao exterior.",
                        "route": "/activities?tab=vocabulary",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-3",
                        "category": "reading",
                        "title": "Reading: Um Diário de Bordo em Londres",
                        "description": "Leia a crônica de viagem e responda às perguntas.",
                        "route": "/activities?tab=reading",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-4",
                        "category": "listening",
                        "title": "Listening: Check-in no Aeroporto",
                        "description": "Entenda as instruções do agente de imigração e portão de embarque.",
                        "route": "/activities?tab=listening",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-5",
                        "category": "simulations",
                        "title": "Simulação: Pedindo Ajuda no Hotel",
                        "description": "Simule uma conversa em inglês na recepção de um hotel.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-a2-p1",
                    "title": "👑 Boss Fight: Phase 1 Exam",
                    "description": "Mostre seu domínio do Simple Past e compreensão auditiva. Nota mínima: 7.0.",
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
                "title": "Fase 2: Planos Futuros & Vida Saudável",
                "description": "Expresse intenções com 'going to' e conselhos com 'should'.",
                "duration_days": 30,
                "status": "locked",
                "steps": [
                    {
                        "id": "step-a2-6",
                        "category": "grammar",
                        "title": "Grammar: Going to vs Will para o Futuro",
                        "description": "Diferencie planos planejados de decisões tomadas no momento.",
                        "route": "/activities?tab=grammar",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-a2-7",
                        "category": "music",
                        "title": "Música & Letras: Canção em Inglês com Teacher Tati",
                        "description": "Treine audição e ritmo cantando e completando a letra.",
                        "route": "/activities?tab=musics",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-a2-p2",
                    "title": "👑 Boss Fight: Phase 2 Exam",
                    "description": "Prove que está pronto para o nível Intermediário B1!",
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
        "title": "Trilha Intermediária: Rumo à Fluência & Carreira (B1)",
        "teacher_notes": "Foque no Present Perfect, conectores de discurso e situações de trabalho.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Fase 1: Experiências de Vida & Present Perfect",
                "description": "Conecte o passado ao presente e compartilhe conquistas profissionais e pessoais.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-b1-1",
                        "category": "grammar",
                        "title": "Grammar: Present Perfect vs Simple Past",
                        "description": "Diferencie 'have you ever...?' de eventos com tempo determinado.",
                        "route": "/activities?tab=grammar",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-2",
                        "category": "vocabulary",
                        "title": "Vocabulário: Carreira, Entrevistas e Soft Skills",
                        "description": "Expressões corporativas para falar de responsabilidades e metas.",
                        "route": "/activities?tab=vocabulary",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-3",
                        "category": "reading",
                        "title": "Reading: As Novas Formas de Trabalho Remoto",
                        "description": "Artigo moderno sobre trabalho híbrido com vocabulário de negócios.",
                        "route": "/activities?tab=reading",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-4",
                        "category": "listening",
                        "title": "Listening: Podcast sobre Inovação e Carreira",
                        "description": "Ouça especialistas internacionais discutindo o futuro das profissões.",
                        "route": "/activities?tab=listening",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-5",
                        "category": "simulations",
                        "title": "Simulação: Entrevista de Emprego em Inglês",
                        "description": "Simule com a Teacher Tati perguntas clássicas de entrevista (strengths, goals).",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-b1-p1",
                    "title": "👑 Boss Fight: Phase 1 Exam",
                    "description": "Avaliação completa com áudio e escrita. Conquiste 7.0 para derrotar o Boss e liberar a Fase 2!",
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
                "title": "Fase 2: Condicionais, Argumentação & Debates",
                "description": "Use First & Second Conditionals para discutir hipóteses e defender opiniões.",
                "duration_days": 30,
                "status": "locked",
                "steps": [
                    {
                        "id": "step-b1-6",
                        "category": "grammar",
                        "title": "Grammar: Second Conditional (Hypothetical Scenarios)",
                        "description": "Estruturas com 'If I had... I would...' para expressar desejos e hipóteses.",
                        "route": "/activities?tab=grammar",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b1-7",
                        "category": "flashcards",
                        "title": "Flashcards: Conectores e Phrasal Verbs de Negócios",
                        "description": "Domine 'although', 'however', 'in addition' e verbos frasais essenciais.",
                        "route": "/activities?tab=flashcards",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-b1-p2",
                    "title": "👑 Boss Fight: Phase 2 Exam",
                    "description": "Prove sua capacidade de se comunicar com independência e solidez.",
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
        "title": "Domínio Avançado: Fluência Espontânea & Negociações (B2)",
        "teacher_notes": "Foco em nuances de vocabulário, passive voice avançada e argumentação persuasiva.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Fase 1: Comunicação Persuasiva & Estruturas Complexas",
                "description": "Participe de conversas com ritmo natural e use estruturas avançadas com clareza.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-b2-1",
                        "category": "grammar",
                        "title": "Grammar: Third & Mixed Conditionals",
                        "description": "Analise consequências do passado com 'If I had known, I wouldn't have...'",
                        "route": "/activities?tab=grammar",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b2-2",
                        "category": "vocabulary",
                        "title": "Vocabulário: Idioms, Collocations & Nuanced Adjectives",
                        "description": "Expanda o vocabulário para além dos termos comuns.",
                        "route": "/activities?tab=vocabulary",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b2-3",
                        "category": "reading",
                        "title": "Reading: Relatório Socioeconômico e Editorial",
                        "description": "Interpretação de textos opinativos e pontos de vista sutis.",
                        "route": "/activities?tab=reading",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b2-4",
                        "category": "listening",
                        "title": "Listening: Debate Técnico & Painel de Discussão",
                        "description": "Compreensão de falas rápidas com diferentes sotaques nativos.",
                        "route": "/activities?tab=listening",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-b2-5",
                        "category": "simulations",
                        "title": "Simulação: Negociação Comercial com Cliente Difícil",
                        "description": "Defenda sua proposta com diplomacia e firmeza.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-b2-p1",
                    "title": "👑 Boss Fight: Phase 1 Exam",
                    "description": "Exame aprofundado com avaliação de pronúncia e fluência via IA. Nota mínima: 7.0.",
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
        "title": "Maestria Profissional: Eloquência e Precisão (C1)",
        "teacher_notes": "Inversões enfáticas, linguagem acadêmica e discurso natural sem hesitações.",
        "phases": [
            {
                "id": "phase-1",
                "number": 1,
                "title": "Fase 1: Discurso Sofisticado & Nuances Linguísticas",
                "description": "Compreensão e produção textual de nível nativo em contextos formais e profissionais.",
                "duration_days": 30,
                "status": "active",
                "steps": [
                    {
                        "id": "step-c1-1",
                        "category": "grammar",
                        "title": "Grammar: Negative Inversion & Cleft Sentences",
                        "description": "'Seldom have I seen...', 'What matters most is...'",
                        "route": "/activities?tab=grammar",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                    {
                        "id": "step-c1-2",
                        "category": "simulations",
                        "title": "Simulação: Keynote Presentation & Q&A Sessão",
                        "description": "Apresentação executiva e resposta a perguntas complexas em inglês.",
                        "route": "/voice",
                        "target_count": 1,
                        "progress": 0,
                        "is_completed": False,
                        "completed_at": None,
                    },
                ],
                "boss_fight": {
                    "id": "boss-c1-p1",
                    "title": "👑 Boss Fight: Phase 1 Exam",
                    "description": "Avaliação de alta performance com critérios rígidos do CEFR.",
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
        Retorna a trilha atual do aluno, sincronizando automaticamente o progresso
        com as atividades e exames reais realizados no banco de dados.
        """
        username = getattr(user, "username", "")
        level = (getattr(user, "level", "A1") or "A1").upper()

        trail_data = None
        # 1. Tenta recuperar do weekly_plan["learning_trail"]
        if isinstance(user.weekly_plan, dict) and "learning_trail" in user.weekly_plan:
            trail_data = user.weekly_plan.get("learning_trail")
        elif isinstance(user.study_goals, dict) and "learning_trail" in user.study_goals:
            trail_data = user.study_goals.get("learning_trail")

        # 2. Se o aluno ainda não possui trilha customizada, cria uma inicial baseada no nível dele
        if not trail_data or not isinstance(trail_data, dict) or not trail_data.get("phases"):
            trail_data = cls.get_template_for_level(level)
            trail_data["username"] = username
            trail_data["created_at"] = django_timezone.now().isoformat()
            # Salva como baseline inicial
            if not isinstance(user.weekly_plan, dict):
                user.weekly_plan = {}
            user.weekly_plan["learning_trail"] = trail_data
            user.save(update_fields=["weekly_plan"])

        # 3. Sincroniza progresso em tempo real com ActivitySubmission e TrimestralExam
        trail_data = cls._sync_live_progress(user, trail_data)
        return trail_data

    @classmethod
    def _sync_live_progress(cls, user: User, trail: Dict[str, Any]) -> Dict[str, Any]:
        """
        Atualiza o status dos steps e do Boss Fight com base no banco de dados.
        """
        username = getattr(user, "username", "")
        phases = trail.get("phases", [])
        if not phases:
            return trail

        # Busca histórico de submissões do aluno
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

        # Processa cada fase
        all_prior_phases_done = True
        for idx, phase in enumerate(phases):
            steps = phase.get("steps", [])
            phase_steps_done = 0

            for step in steps:
                cat = step.get("category", "").lower()
                # Se já estiver marcado manualmente pela professora ou aluno, respeita
                if step.get("is_completed"):
                    phase_steps_done += 1
                    continue

                # Auto-marcação por categoria completada
                if cat in completed_categories:
                    step["is_completed"] = True
                    step["progress"] = step.get("target_count", 1)
                    phase_steps_done += 1

            total_steps = len(steps)
            all_steps_completed = (total_steps > 0 and phase_steps_done >= total_steps)

            boss = phase.get("boss_fight") or {}
            min_score = float(boss.get("min_score", 7.0))
            min_score_percent = min_score * 10 if min_score <= 10 else min_score

            # Se todos os steps foram feitos, o Boss Fight é desbloqueado!
            if all_steps_completed:
                boss["is_unlocked"] = True
            
            # Se já fez o exame com nota suficiente para este nível/fase
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

            # Se a fase está bloqueada, o boss também deve permanecer bloqueado
            if phase.get("status") == "locked":
                boss["is_unlocked"] = False

            # Atualiza flags para a próxima fase
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

        # Validações básicas
        if not isinstance(trail_data, dict):
            raise ValueError("Dados da trilha devem ser um objeto JSON.")

        trail_data["updated_at"] = django_timezone.now().isoformat()
        trail_data["updated_by"] = getattr(teacher_user, "username", "teacher")

        if not isinstance(student.weekly_plan, dict):
            student.weekly_plan = {}

        student.weekly_plan["learning_trail"] = trail_data
        student.save(update_fields=["weekly_plan"])

        logger.info(
            f"[LearningTrail] Trilha do aluno {student_username} atualizada por {teacher_user.username}."
        )
        return cls.get_student_trail(student)

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
        """
        student = User.objects.filter(username=student_username).first()
        if not student:
            raise ValueError("Aluno não encontrado.")

        trail = cls.get_student_trail(student)
        phases = trail.get("phases", [])

        target_found = False
        for phase in phases:
            if phase.get("id") == phase_id or not phase_id:
                for step in phase.get("steps", []):
                    if step.get("id") == step_id:
                        new_status = (
                            is_completed
                            if is_completed is not None
                            else not step.get("is_completed", False)
                        )
                        step["is_completed"] = new_status
                        step["progress"] = step.get("target_count", 1) if new_status else 0
                        step["completed_at"] = (
                            django_timezone.now().isoformat() if new_status else None
                        )
                        target_found = True
                        break

        if not target_found:
            raise ValueError(f"Step '{step_id}' não encontrado na trilha.")

        return cls.save_student_trail(user, student_username, trail)

    @classmethod
    def unlock_boss(cls, teacher_user: User, student_username: str, phase_id: str) -> Dict[str, Any]:
        """
        A Professora Tatiana pode liberar manualmente o Boss Fight de uma fase.
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
