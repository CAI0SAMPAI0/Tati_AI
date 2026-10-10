import os
import json
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

from django.db import connection
from django.conf import settings
from django.utils import timezone as django_timezone

from apps.authentication.models import User
from apps.users.services import XPService, StreakService
from .models import TrimestralExam, CEFRReference, ActivitySubmission

logger = logging.getLogger(__name__)

# Usuários liberados temporariamente para acesso aos exames trimestrais
ALLOWED_USERNAMES = {"programador", "caio.sampaio"}

CEFR_OFFICIAL_GUIDELINES_URL = (
    "https://rm.coe.int/CoERMPublicCommonSearchServices/DisplayDCTMContent?documentId=090000168045bb52"
)

LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]


def is_user_authorized(username: Optional[str]) -> bool:
    """Verifica se o usuário tem acesso permitido aos testes trimestrais."""
    if not username:
        return False
    return username.strip().lower() in ALLOWED_USERNAMES


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

        system_prompt = f"""Você é um examinador e pedagogo sênior de língua inglesa especializado no Quadro Comum Europeu de Referência (CEFR).
Sua missão é criar um Exame Trimestral personalizado para um aluno do nível {lvl}.

DIRETRIZES OFICIAIS:
1. Siga estritamente as especificações oficiais do CEFR Companion Volume: {CEFR_OFFICIAL_GUIDELINES_URL}
2. Contexto do material didático da plataforma:
{cefr_context}

QUANTIDADE DE QUESTÕES:
O exame DEVE ter exatamente {num_questions} perguntas.

REGRAS DE CONTEÚDO E FORMATO (MUITO IMPORTANTE):
1. Exercícios de READING COMPREHENSION (3 a 5 questões):
   - Apresente um texto de fácil compreensão no campo "reading_text", compatível com o nível {lvl} (entre 50 e 120 palavras).
   - As perguntas sobre o texto devem ser de MARCAR X (múltipla escolha) com 4 opções em "options".
   - REGRA DE OURO SOBRE AS ALTERNATIVAS: As opções devem ser CLARAS e INEQUÍVOCAS.
   - É ESTRITAMENTE PROIBIDO criar pegadinhas ou opções ambíguas que deixem o aluno em dúvida entre 2 ou 3 alternativas.
   - A resposta correta deve ser diretamente evidente a partir da leitura atenta do texto, e os distratores devem ser claramente incorretos ou não mencionados no texto.

2. Exercícios de GRAMMAR (3 a 4 questões):
   - Múltipla escolha (4 opções) cobrindo estruturas fundamentais do nível {lvl} (ex: tempos verbais, preposições, pronomes).
   - Sem ambiguidade nas alternativas.

3. Exercícios de VOCABULARY (2 a 3 questões):
   - Múltipla escolha (4 opções) com vocabulário comum e de alta frequência do nível {lvl}.

4. Exercícios de LISTENING ou DIÁLOGO (1 a 2 questões):
   - Curto diálogo ou transcrição de fala cotidiana (1 a 3 falas) no campo "audio_text".
   - Pergunta objetiva com 4 alternativas claras.

ESTRUTURA JSON OBRIGATÓRIA:
Retorne EXCLUSIVAMENTE um objeto JSON no formato:
{{
  "questions": [
    {{
      "id": "q1",
      "type": "reading",
      "points": 10,
      "reading_text": "Texto claro e direto em inglês...",
      "question": "What is the main topic discussed in the text?",
      "options": ["Opção correta", "Distrator 1", "Distrator 2", "Distrator 3"],
      "correct_answer": "Opção correta",
      "explanation": "Explicação pedagógica clara e encorajadora em português."
    }},
    {{
      "id": "q2",
      "type": "grammar",
      "points": 10,
      "question": "Complete the sentence with the correct verb...",
      "options": ["walks", "walk", "walking", "walked"],
      "correct_answer": "walks",
      "explanation": "Explicação em português explicando a regra gramatical."
    }}
  ]
}}
Cada "correct_answer" DEVE ser uma cópia exata de uma das 4 strings em "options".
"""

        user_prompt = f"Gere agora o exame trimestral oficial com exatamente {num_questions} questões para o nível {lvl}."

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

        # 2. Tenta via Gemini
        try:
            from google import genai
            from google.genai import types

            gemini_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
            if gemini_key:
                client = genai.Client(api_key=gemini_key.strip())
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=f"{system_prompt}\n\n{user_prompt}",
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                    ),
                )
                if response.text:
                    parsed = json.loads(response.text)
                    questions = parsed.get("questions", [])
                    if questions:
                        logger.info(f"[ExamGeneratorService] Exame gerado via Gemini com {len(questions)} questões.")
                        return cls._normalize_questions(questions, num_questions, lvl)
        except Exception as e:
            logger.warning(f"[ExamGeneratorService] Falha com Gemini: {e}")

        # 3. Fallback Pedagógico Determinístico Estruturado
        logger.info(f"[ExamGeneratorService] Utilizando fallback estruturado para o nível {lvl}.")
        return cls._generate_fallback_questions(lvl, num_questions)

    @classmethod
    def _normalize_questions(
        cls,
        questions: List[Dict[str, Any]],
        target_count: int,
        level: str,
    ) -> List[Dict[str, Any]]:
        """Garante IDs únicos, valida alternativas e assegura que correct_answer está em options."""
        normalized = []
        for idx, q in enumerate(questions[:target_count], start=1):
            q_id = f"q{idx}"
            q_type = q.get("type", "reading")
            question_text = q.get("question", f"Question {idx}")
            options = q.get("options", [])
            correct = q.get("correct_answer", "")
            explanation = q.get("explanation", "Resposta correta baseada no nível.")
            reading_text = q.get("reading_text")
            audio_text = q.get("audio_text")

            # Garante que temos pelo menos 4 opções
            if not isinstance(options, list) or len(options) < 4:
                options = [correct, "Alternative B", "Alternative C", "Alternative D"]

            # Assegura que correct_answer está presente nas opções
            if correct not in options:
                options[0] = correct

            normalized.append({
                "id": q_id,
                "type": q_type,
                "points": int(q.get("points", 10)),
                "question": question_text,
                "options": options,
                "correct_answer": correct,
                "explanation": explanation,
                "reading_text": reading_text,
                "audio_text": audio_text,
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
        """Fallback pedagógico de alta qualidade caso as APIs de IA estejam indisponíveis."""
        templates = [
            {
                "type": "reading",
                "reading_text": "Emma works at a small bookstore in London. She starts at 9 AM and helps customers find books. In the afternoon, she organizes new magazines and enjoys a cup of tea before leaving at 5 PM.",
                "question": "What does Emma do during the afternoon at the bookstore?",
                "options": [
                    "She organizes new magazines and drinks tea.",
                    "She starts her work and opens the shop.",
                    "She goes home to have lunch.",
                    "She reads entire novels to customers."
                ],
                "correct_answer": "She organizes new magazines and drinks tea.",
                "explanation": "O texto afirma claramente: 'In the afternoon, she organizes new magazines and enjoys a cup of tea'."
            },
            {
                "type": "reading",
                "reading_text": "Lucas loves traveling on weekends. Last Saturday, he took a train to Brighton with his friends. The weather was sunny, so they walked along the beach and ate fish and chips.",
                "question": "How did Lucas and his friends travel to Brighton?",
                "options": [
                    "They took a train.",
                    "They drove a car.",
                    "They rode bicycles.",
                    "They traveled by plane."
                ],
                "correct_answer": "They took a train.",
                "explanation": "O texto menciona: 'he took a train to Brighton with his friends'."
            },
            {
                "type": "grammar",
                "question": "Complete the sentence: 'She _______ to the gym every morning before work.'",
                "options": ["goes", "go", "going", "gone"],
                "correct_answer": "goes",
                "explanation": "No Present Simple com a terceira pessoa do singular (she), acrescenta-se 'es' ao verbo go."
            },
            {
                "type": "grammar",
                "question": "Choose the correct question: 'Where _______ you live during your college years?'",
                "options": ["did", "do", "does", "are"],
                "correct_answer": "did",
                "explanation": "Para perguntas no passado com verbos de ação usa-se o auxiliar 'did'."
            },
            {
                "type": "vocabulary",
                "question": "Which word is the opposite of 'expensive'?",
                "options": ["cheap", "heavy", "crowded", "modern"],
                "correct_answer": "cheap",
                "explanation": "'Cheap' significa barato, que é o oposto direto de 'expensive' (caro)."
            },
            {
                "type": "vocabulary",
                "question": "Complete the phrase: 'Please remember to _______ off the lights when leaving.'",
                "options": ["turn", "make", "put", "take"],
                "correct_answer": "turn",
                "explanation": "O phrasal verb comum para apagar a luz é 'turn off'."
            },
            {
                "type": "reading",
                "reading_text": "David is preparing for an English meeting. He reviewed his notes yesterday and prepared a 10-minute presentation about sales growth in South America.",
                "question": "How long will David's presentation be?",
                "options": [
                    "Ten minutes.",
                    "Two hours.",
                    "One full day.",
                    "Thirty seconds."
                ],
                "correct_answer": "Ten minutes.",
                "explanation": "O texto diz explicitamente: 'prepared a 10-minute presentation'."
            },
            {
                "type": "grammar",
                "question": "Select the correct option: 'I haven't seen that movie _______.'",
                "options": ["yet", "already", "still", "ever"],
                "correct_answer": "yet",
                "explanation": "Em frases negativas no Present Perfect, 'yet' é usado no final para indicar 'ainda não'."
            },
            {
                "type": "vocabulary",
                "question": "What is the best synonym for 'huge'?",
                "options": ["enormous", "tiny", "narrow", "slow"],
                "correct_answer": "enormous",
                "explanation": "'Enormous' e 'huge' significam enorme / muito grande."
            },
            {
                "type": "listening",
                "audio_text": "Hello Sarah! Are you free for lunch at 1 PM today? Let's meet at the Italian restaurant near the office.",
                "question": "Where does the speaker want to meet Sarah?",
                "options": [
                    "At the Italian restaurant near the office.",
                    "At Sarah's house.",
                    "Inside the office cafeteria.",
                    "At the train station."
                ],
                "correct_answer": "At the Italian restaurant near the office.",
                "explanation": "O falante diz: 'Let's meet at the Italian restaurant near the office'."
            },
        ]

        items = []
        for idx in range(count):
            t = templates[idx % len(templates)].copy()
            t["id"] = f"q{idx + 1}"
            t["points"] = 10
            items.append(t)
        return items


class TrimestralExamService:
    """
    Gerenciamento do ciclo de vida dos exames trimestrais (exatamente a cada 3 meses).
    """

    @classmethod
    def get_status(cls, user: User) -> Dict[str, Any]:
        """
        Calcula a elegibilidade do aluno para o exame trimestral.
        Regra: exatamente 3 meses (relativedelta(months=3)) após a conclusão do último exame.
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

        # 2. Verifica se há exame em andamento (in_progress)
        active_exam = TrimestralExam.objects.filter(
            username=username,
            status="in_progress",
        ).first()

        if active_exam:
            return {
                "can_start": True,
                "status": "in_progress",
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
            # Primeiro exame trimestral do aluno: liberado imediatamente para teste!
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
        Inicia ou recupera um exame trimestral ativo.
        Gera questões balanceadas e mascara o gabarito para proteção contra trapaça.
        """
        username = getattr(user, "username", "")
        level = getattr(user, "level", "A1") or "A1"

        if not is_user_authorized(username):
            raise PermissionError("Exames trimestrais estão em fase de testes e restritos aos desenvolvedores.")

        # Verifica se já existe um exame em andamento
        active_exam = TrimestralExam.objects.filter(
            username=username,
            status="in_progress",
        ).first()

        if active_exam and not force:
            return cls._format_exam_start_payload(active_exam)

        # Se for iniciar novo, verifica elegibilidade
        if not force:
            status_info = cls.get_status(user)
            if not status_info.get("can_start"):
                raise ValueError(
                    f"Exame ainda não disponível. Faltam {status_info.get('days_remaining', 0)} dias para o próximo trimestre."
                )

        # Se force=True e havia um anterior em andamento, expira o anterior
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
            status="in_progress",
        ).first()

        if not active_exam:
            return None

        return cls._format_exam_start_payload(active_exam)

    @classmethod
    def submit_exam(
        cls,
        user: User,
        exam_id: str,
        answers: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """
        Recebe as respostas do aluno, efetua a correção automática,
        atribui pontuação e feedback pedagógico, e agenda o próximo teste para 3 meses à frente.
        """
        username = getattr(user, "username", "")
        if not is_user_authorized(username):
            raise PermissionError("Acesso não autorizado aos testes trimestrais.")

        exam = TrimestralExam.objects.filter(
            id=exam_id,
            username=username,
            status="in_progress",
        ).first()

        if not exam:
            raise ValueError("Exame não encontrado ou já concluído anteriormente.")

        # Mapa de respostas do aluno: { "q1": "opcao_escolhida" }
        answers_map = {}
        for ans in answers:
            q_id = str(ans.get("question_id", "")).strip()
            val = str(ans.get("answer", "")).strip()
            if q_id:
                answers_map[q_id] = val

        questions = exam.questions or []
        corrections = []
        total_points = 0
        earned_points = 0

        reading_correct = 0
        reading_total = 0

        for q in questions:
            q_id = q.get("id", "")
            q_type = q.get("type", "general")
            q_text = q.get("question", "")
            correct_val = str(q.get("correct_answer", "")).strip()
            explanation = q.get("explanation", "")
            points = int(q.get("points", 10))
            total_points += points

            student_val = answers_map.get(q_id, "")
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
                "student_answer": student_val,
                "correct_answer": correct_val,
                "is_correct": is_correct,
                "points_earned": item_points,
                "explanation": explanation,
            })

        # Score de 0 a 100
        score = int((earned_points / total_points * 100)) if total_points > 0 else 0
        passed = score >= 70

        # Progressão de Nível CEFR
        recommended_level = None
        current_level = exam.level.upper() if exam.level else "A1"
        if score >= 85 and current_level in LEVEL_ORDER:
            curr_idx = LEVEL_ORDER.index(current_level)
            if curr_idx < len(LEVEL_ORDER) - 1:
                recommended_level = LEVEL_ORDER[curr_idx + 1]

        # Feedback Pedagógico (Estilo Teacher Tati)
        if score >= 90:
            summary_feedback = (
                f"Excelente desempenho! Você demonstrou domínio sólido do nível {current_level}. "
                f"Acertou {reading_correct} de {reading_total} questões de leitura com interpretação impecável. "
                f"Você está pronto para avançar para novos desafios!"
            )
        elif score >= 70:
            summary_feedback = (
                f"Muito bom! Você foi aprovado no exame do nível {current_level}. "
                f"Sua leitura e vocabulário estão no caminho certo. Continue revisando os pontos gramaticais assinalados."
            )
        else:
            summary_feedback = (
                f"Bom esforço! O exame revelou áreas importantes para reforçarmos juntos no nível {current_level}. "
                f"Recomendamos focar nos flashcards de vocabulário e nas lições de leitura nas próximas semanas."
            )

        now = django_timezone.now()
        next_exam_date = now + relativedelta(months=3)

        # Gamificação e XP (Exame trimestral premia 100 XP por conclusão)
        xp_earned = 100 if passed else 40
        try:
            XPService.award_xp(user, xp_earned, f"Exame Trimestral {current_level}")
            StreakService.record_activity(user)
        except Exception as e:
            logger.warning(f"[TrimestralExamService] Erro ao creditar XP: {e}")

        # Computa métricas de evolução (Can-Do statements do CEFR e habilidades dominadas)
        evolution = cls._compute_evolution_skills(questions, answers_map, current_level)

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

        # Registra no histórico de atividades para sincronizar com o dashboard do aluno
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
        answers_map: Dict[str, str],
        level: str,
    ) -> Dict[str, Any]:
        """Calcula habilidades dominadas e Can-Do statements baseados no CEFR."""
        skills = {
            "reading": {"correct": 0, "total": 0, "label": "Leitura & Interpretação"},
            "grammar": {"correct": 0, "total": 0, "label": "Gramática Aplicada"},
            "vocabulary": {"correct": 0, "total": 0, "label": "Vocabulário & Expressões"},
            "listening": {"correct": 0, "total": 0, "label": "Compreensão Auditiva"},
        }

        for q in questions:
            q_type = q.get("type", "reading").lower()
            if q_type not in skills:
                skills[q_type] = {"correct": 0, "total": 0, "label": q_type.capitalize()}
            skills[q_type]["total"] += 1

            q_id = q.get("id")
            student_val = answers_map.get(q_id, "").strip().lower()
            correct_val = str(q.get("correct_answer", "")).strip().lower()
            if student_val and student_val == correct_val:
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
                        can_do_statements.append("Compreende a ideia principal e fatos pontuais em textos claros do cotidiano em inglês.")
                        can_do_statements.append("Identifica respostas objetivas sem hesitação ao analisar alternativas.")
                    else:
                        points_to_improve.append("Interpretação e atenção a detalhes em leituras de textos curtos.")
                elif s_key == "grammar":
                    if pct >= 70:
                        can_do_statements.append("Aplica com precisão os tempos verbais e conectores essenciais do nível.")
                    else:
                        points_to_improve.append("Revisão de conjugação verbal e estruturas gramaticais fundamentais.")
                elif s_key == "vocabulary":
                    if pct >= 70:
                        can_do_statements.append("Reconhece palavras de alta frequência e expressões idiomáticas do nível.")
                    else:
                        points_to_improve.append("Prática de expansão de vocabulário e collocations com flashcards.")
                elif s_key == "listening":
                    if pct >= 70:
                        can_do_statements.append("Compreende diálogos cotidianos e instruções diretas de fala.")
                    else:
                        points_to_improve.append("Prática de escuta ativa na área de podcasts e listenings.")

        if not can_do_statements:
            can_do_statements.append(f"Demonstrou participação ativa na avaliação trimestral do nível {level}.")

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
        """Remove gabaritos e explicações antes de enviar ao frontend."""
        masked_questions = []
        for q in (exam.questions or []):
            masked_questions.append({
                "id": str(q.get("id")),
                "type": str(q.get("type", "reading")),
                "question": str(q.get("question", "")),
                "points": int(q.get("points", 10)),
                "options": q.get("options", []),
                "audio_url": q.get("audio_url"),
                "reading_text": q.get("reading_text"),
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

