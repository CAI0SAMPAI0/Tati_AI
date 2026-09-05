import os
import json
import uuid
import random
import logging
import base64
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from django.core.cache import cache
from io import BytesIO
from typing import List, Dict, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from apps.authentication.models import User
from apps.chat.models import Conversation, Message
from apps.chat.audio_service import AudioService, get_groq_keys, strip_emojis
from apps.notifications.services import BrevoEmailService
from apps.users.services import XPService, StreakService

logger = logging.getLogger(__name__)

# Load diagnostic questions
DATA_FILE = os.path.join(os.path.dirname(__file__), "leveling_data.json")

def load_leveling_questions() -> Dict[str, List[Dict[str, Any]]]:
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"[Leveling] Error reading leveling_data.json: {e}")
    return {}

LEVELING_QUESTIONS_BANK = load_leveling_questions()
QUESTIONS_PER_LEVEL_MIN = 3
QUESTIONS_PER_LEVEL_MAX = 5


class LevelingService:
    @staticmethod
    def is_leveling_conversation(user: User, conversation_id: str) -> bool:
        """
        Verifica com seguranca se a conversa e uma sessao de nivelamento ativa.
        Recarrega o perfil direto do banco para evitar instancias em memoria defasadas no WebSocket.
        """
        if not user or not conversation_id:
            return False
        try:
            # 1. Verifica se a conversa no banco existe e tem titulo de nivelamento
            conv = Conversation.objects.filter(id=conversation_id).first()
            if not conv or not (conv.title.startswith("CEFR Leveling") or "leveling" in conv.title.lower()):
                return False

            # 2. Busca perfil atualizado do banco de dados
            user_profile = User.objects.filter(username=user.username).values_list("profile", flat=True).first()
            if isinstance(user_profile, dict):
                active = user_profile.get("active_leveling")
                if isinstance(active, dict) and active.get("conversation_id") == conversation_id:
                    return not active.get("completed", False)

            # 3. Fallback no user em memoria
            if hasattr(user, "profile") and isinstance(user.profile, dict):
                active = user.profile.get("active_leveling")
                if isinstance(active, dict) and active.get("conversation_id") == conversation_id:
                    return not active.get("completed", False)
        except Exception as e:
            logger.error(f"[Leveling] Error checking is_leveling_conversation: {e}")
        return False

    @staticmethod
    def start_leveling_session(
        user: User,
        total_questions: Optional[int] = None,
        count_per_level: Optional[int] = None,
        accent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Inicia uma nova sessao de nivelamento com Teacher Tati.
        Seleciona perguntas aleatorias equilibradas entre os niveis CEFR (A1, A2, B1, B2).
        """
        bank = LEVELING_QUESTIONS_BANK or load_leveling_questions()
        selected_questions = []

        # Determina a quantidade de perguntas por nivel
        if total_questions:
            total_q_target = max(4, min(24, int(total_questions)))
            base_count = total_q_target // 4
            remainder = total_q_target % 4
        elif count_per_level:
            base_count = max(1, min(6, int(count_per_level)))
            remainder = 0
            total_q_target = base_count * 4
        else:
            # Padrao rapido e amigavel: 8 perguntas (2 de cada nivel)
            base_count = 2
            remainder = 0
            total_q_target = 8

        levels = ["A1", "A2", "B1", "B2"]
        extra_allocations = set(random.sample(levels, remainder)) if remainder > 0 else set()

        for lvl in levels:
            pool = bank.get(lvl, [])
            count = base_count + (1 if lvl in extra_allocations else 0)
            if pool:
                sampled = random.sample(pool, min(count, len(pool)))
                selected_questions.extend(sampled)

        # Embaralha todas as perguntas selecionadas em ordem aleatoria
        random.shuffle(selected_questions)

        if not selected_questions:
            selected_questions = [
                {"id": "A1_1", "level": "A1", "question": "What's your name and where are you from?", "target": "Basic introduction"},
                {"id": "A2_1", "level": "A2", "question": "What did you do last weekend?", "target": "Past simple tense"},
                {"id": "B1_1", "level": "B1", "question": "What's something you used to do but don't do anymore?", "target": "Used to habit"},
                {"id": "B2_1", "level": "B2", "question": "Do you think people today are more impatient than before? Why?", "target": "Abstract opinion"}
            ]

        now_str = datetime.now(timezone.utc).isoformat()
        conv_id = str(uuid.uuid4())

        fresh_user = User.objects.filter(username=user.username).first() or user
        user_accent = accent
        if not user_accent or str(user_accent).lower() in ["default", ""]:
            if fresh_user and hasattr(fresh_user, "profile") and isinstance(fresh_user.profile, dict):
                user_accent = fresh_user.profile.get("preferred_accent") or fresh_user.profile.get("accent") or "en-US"
            else:
                user_accent = "en-US"
        user_accent = user_accent or "en-US"

        # 1. Cria a conversa dedicada no banco
        conv = Conversation.objects.create(
            id=conv_id,
            username=user.username,
            title="CEFR Leveling Assessment - Teacher Tati",
            model="groq/openai/gpt-oss-20b",
            is_simulation=False,
            created_at=now_str,
            updated_at=now_str,
        )

        total_q = len(selected_questions)
        session_data = {
            "conversation_id": conv_id,
            "questions": selected_questions,
            "current_index": 0,
            "total_questions": total_q,
            "scores": {
                "A1": {"correct": 0, "total": sum(1 for q in selected_questions if q.get("level") == "A1")},
                "A2": {"correct": 0, "total": sum(1 for q in selected_questions if q.get("level") == "A2")},
                "B1": {"correct": 0, "total": sum(1 for q in selected_questions if q.get("level") == "B1")},
                "B2": {"correct": 0, "total": sum(1 for q in selected_questions if q.get("level") == "B2")},
            },
            "answers": [],
            "completed": False,
            "started_at": now_str,
            "current_follow_ups": 0,
            "current_answers": [],
            "accent": user_accent,
        }

        if not isinstance(fresh_user.profile, dict):
            fresh_user.profile = {}
        fresh_user.profile = dict(fresh_user.profile)
        fresh_user.profile["active_leveling"] = session_data
        fresh_user.save(update_fields=["profile"])

        # 2. Mensagem inicial da Teacher Tati com a Questao 1 (SEM EMOJIS)
        first_q = selected_questions[0]
        student_name = fresh_user.name or fresh_user.username

        opening_text = (
            f"Hello {student_name}! Welcome to your CEFR English Leveling Challenge.\n\n"
            f"I have prepared {total_q} questions to discover your exact proficiency level (A1 to B2). Answer naturally in English! (Type /finish anytime to conclude).\n\n"
            f"---\n"
            f"**Question 1/{total_q}**:\n"
            f"**{first_q['question']}**"
        )
        opening_text = strip_emojis(opening_text)

        audio_b64 = AudioService.text_to_speech(opening_text, accent=user_accent)

        Message.objects.create(
            session_id=conv_id,
            username=fresh_user.username,
            role="assistant",
            content=opening_text,
            audio_b64=audio_b64,
        )

        return {
            "conversation_id": conv_id,
            "title": conv.title,
            "message": opening_text,
            "reply": opening_text,
            "audio_b64": audio_b64,
            "audio": audio_b64,
            "accent": user_accent,
            "is_leveling": True,
            "current_question": 1,
            "total_questions": total_q,
            "question_text": first_q["question"],
        }

    @staticmethod
    def _award_daily_leveling_xp(user: User) -> bool:
        """
        O usuário pode ganhar pontos apenas 1 vez ao dia fazendo o teste CEFR (25 XP).
        """
        try:
            today_str = datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat()
            daily_key = f"daily_cefr_xp_{user.username}_{today_str}"
            if cache.add(daily_key, "1", timeout=86400):
                XPService.award_xp(user, 25, "Desafio de Nivelamento CEFR (Diário)")
                logger.info(f"[Leveling XP] +25 XP concedido a {user.username} pelo Desafio CEFR.")
                return True
            else:
                logger.info(f"[Leveling XP] Aluno {user.username} já recebeu os 25 XP do Desafio CEFR hoje.")
                return False
        except Exception as e:
            logger.error(f"[Leveling XP] Erro ao pontuar XP diário do CEFR: {e}")
            return False

    @staticmethod
    def finish_leveling_early(user: User, conversation_id: str, accent: Optional[str] = None) -> Dict[str, Any]:
        """
        Encerra antecipadamente o teste de nivelamento quando o aluno envia /finish.
        Avalia com base no que foi respondido ate o momento e pontua as restantes como 0 / nao respondidas.
        Gera relatorio em PDF, envia e-mail e atualiza o nivel do aluno.
        """
        fresh_user = User.objects.filter(username=user.username).first() or user
        profile = getattr(fresh_user, "profile", {}) or {}
        session = profile.get("active_leveling")

        session_accent = accent
        if not session_accent or str(session_accent).lower() in ["default", ""]:
            session_accent = (
                session.get("accent")
                if isinstance(session, dict)
                else None
            ) or (
                fresh_user.profile.get("preferred_accent")
                if isinstance(getattr(fresh_user, "profile", None), dict)
                else None
            ) or (
                fresh_user.profile.get("accent")
                if isinstance(getattr(fresh_user, "profile", None), dict)
                else None
            ) or "en-US"
        session_accent = session_accent or "en-US"

        if not isinstance(session, dict) or session.get("completed"):
            return {
                "ok": False,
                "reply": "No active leveling assessment found to finish.",
                "audio_b64": "",
                "accent": session_accent,
                "is_leveling": False,
            }

        total_q = session.get("total_questions", 8)
        questions = session.get("questions", [])
        curr_idx = session.get("current_index", 0)
        old_level = fresh_user.level or "A1"
        scores = session.get("scores", {})

        # As perguntas restantes nao respondidas contam como erro (0 pontos)
        for rem_idx in range(curr_idx, total_q):
            if rem_idx < len(questions):
                rem_q = questions[rem_idx]
                session["answers"].append({
                    "index": rem_idx + 1,
                    "question_id": rem_q.get("id", f"Q_{rem_idx+1}"),
                    "level": rem_q.get("level", "A1"),
                    "question": rem_q.get("question", ""),
                    "user_answer": "[Not answered - Finished early via /finish]",
                    "is_correct": False,
                    "mistakes": ["Question skipped due to early conclusion."],
                    "corrections": [],
                    "feedback": "Skipped.",
                })

        # Calcula o melhor nivel
        best_level = "A1"
        max_correct = -1
        level_hierarchy = ["A1", "A2", "B1", "B2"]

        for lvl in level_hierarchy:
            c = scores.get(lvl, {}).get("correct", 0)
            if c >= max_correct:
                max_correct = c
                best_level = lvl

        if max_correct == 0 and best_level != "A1":
            best_level = "A1"

        fresh_user.level = best_level

        now_iso = datetime.now(timezone.utc).isoformat()
        session["completed"] = True
        session["completed_at"] = now_iso
        session["assigned_level"] = best_level
        session["old_level"] = old_level
        session["early_finish"] = True
        session["answered_count"] = curr_idx

        if "leveling_history" not in fresh_user.profile or not isinstance(fresh_user.profile.get("leveling_history"), list):
            fresh_user.profile["leveling_history"] = []
        fresh_user.profile["leveling_history"].append(session)
        fresh_user.profile["active_leveling"] = None
        fresh_user.save(update_fields=["level", "profile"])

        # Pontua 25 XP apenas uma vez ao dia no CEFR
        LevelingService._award_daily_leveling_xp(fresh_user)
        StreakService.record_activity(fresh_user)

        # Geracao do relatorio em PDF
        pdf_bytes = LevelingService.generate_pdf_report(
            student_name=fresh_user.name or fresh_user.username,
            date_str=datetime.now().strftime("%B %d, %Y"),
            old_level=old_level,
            new_level=best_level,
            scores_by_level=scores,
            qa_list=session.get("answers", []),
        )

        # Envio de e-mail com PDF
        student_email = fresh_user.email
        email_sent = False
        if student_email and "@" in student_email:
            try:
                email_html = LevelingService.build_email_html(
                    student_name=fresh_user.name or fresh_user.username,
                    new_level=best_level,
                    old_level=old_level,
                    scores=scores,
                    qa_list=session.get("answers", []),
                )
                pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
                attachments = [{
                    "name": f"Level_Assessment_Report_{fresh_user.username}.pdf",
                    "content": pdf_b64,
                }]
                res = BrevoEmailService.send_email_detailed(
                    to_email=student_email,
                    subject="Your English Level Assessment Results - Teacher Tati",
                    html_content=email_html,
                    recipient_name=fresh_user.name or fresh_user.username,
                    attachments=attachments,
                )
                email_sent = res.get("success", False)
            except Exception as mail_err:
                logger.error(f"[Leveling] Failed sending report email on early finish: {mail_err}")

        email_notice = (
            f"A detailed diagnostic PDF report has been sent to your email ({student_email}) with your scores, mistakes, and corrections in English."
            if student_email
            else "Update your email in your profile to receive diagnostic reports directly in your inbox."
        )

        final_reply = (
            f"You have finished the Leveling Assessment early using /finish.\n\n"
            f"---\n"
            f"**Leveling Assessment Summary for {fresh_user.name or fresh_user.username}**:\n\n"
            f"• Questions completed: {curr_idx} of {total_q}\n"
            f"• Questions skipped: {total_q - curr_idx} (marked as 0)\n\n"
            f"**Your Performance by Level:**\n"
            f"• Level A1: {scores.get('A1', {}).get('correct', 0)}/{scores.get('A1', {}).get('total', 0)} correct\n"
            f"• Level A2: {scores.get('A2', {}).get('correct', 0)}/{scores.get('A2', {}).get('total', 0)} correct\n"
            f"• Level B1: {scores.get('B1', {}).get('correct', 0)}/{scores.get('B1', {}).get('total', 0)} correct\n"
            f"• Level B2: {scores.get('B2', {}).get('correct', 0)}/{scores.get('B2', {}).get('total', 0)} correct\n\n"
            f"**Your Assessed CEFR Level: {best_level}**\n"
            f"Your profile in Teacher Tati AI has been updated to **{best_level}**.\n\n"
            f"{email_notice}\n\n"
            f"Good effort! You can practice in normal chat or take another assessment whenever you are ready."
        )
        final_reply = strip_emojis(final_reply)

        audio_b64 = AudioService.text_to_speech(final_reply, accent=session_accent)

        Message.objects.create(
            session_id=conversation_id,
            username=fresh_user.username,
            role="assistant",
            content=final_reply,
            audio_b64=audio_b64,
        )

        Conversation.objects.filter(id=conversation_id).update(
            updated_at=datetime.now(timezone.utc).isoformat()
        )

        return {
            "ok": True,
            "reply": final_reply,
            "audio_b64": audio_b64,
            "audio": audio_b64,
            "accent": session_accent,
            "is_leveling": True,
            "completed": True,
            "new_level": best_level,
            "scores": scores,
            "email_sent": email_sent,
        }

    @staticmethod
    def process_leveling_step(
        user: User,
        conversation_id: str,
        user_text: str,
        accent: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Processa uma resposta do aluno no teste de nivelamento.
        Avalia gramatica/vocabulario com IA, pontua o nivel e faz a pergunta seguinte ou conclui o teste.
        """
        # Salva mensagem do usuario
        Message.objects.create(
            session_id=conversation_id,
            username=user.username,
            role="user",
            content=user_text,
        )

        fresh_user = User.objects.filter(username=user.username).first() or user
        profile = getattr(fresh_user, "profile", {}) or {}

        if not isinstance(profile, dict) or "active_leveling" not in profile:
            return {
                "reply": "No active leveling session found. Starting a regular chat.",
                "audio_b64": "",
                "is_leveling": False,
            }

        session = profile["active_leveling"]
        session_accent = accent
        if not session_accent or str(session_accent).lower() in ["default", ""]:
            session_accent = (
                session.get("accent")
                if isinstance(session, dict)
                else None
            ) or (
                fresh_user.profile.get("preferred_accent")
                if isinstance(getattr(fresh_user, "profile", None), dict)
                else None
            ) or (
                fresh_user.profile.get("accent")
                if isinstance(getattr(fresh_user, "profile", None), dict)
                else None
            ) or "en-US"
        session_accent = session_accent or "en-US"
        if isinstance(session, dict):
            session["accent"] = session_accent

        if not isinstance(session, dict) or session.get("completed"):
            return {
                "reply": "Your leveling test has already been completed! Great job!",
                "audio_b64": "",
                "accent": session_accent,
                "is_leveling": False,
            }

        # 1. Verifica se o usuario solicitou o comando /finish
        clean_input = user_text.strip().lower()
        if clean_input in ["/finish", "/fim", "/encerrar", "/end", "/stop", "finish", "fim"] or clean_input.startswith("/finish"):
            return LevelingService.finish_leveling_early(fresh_user, conversation_id, accent=session_accent)

        questions = session.get("questions", [])
        curr_idx = session.get("current_index", 0)
        total_q = session.get("total_questions", len(questions))

        if curr_idx >= len(questions):
            return {
                "reply": "Your leveling test has already been completed! Great job!",
                "audio_b64": "",
                "is_leveling": False,
            }

        curr_q = questions[curr_idx]
        q_level = curr_q.get("level", "A1")
        q_text = curr_q.get("question", "")
        q_target = curr_q.get("target", "")

        # Coleta respostas acumuladas para a pergunta atual (caso tenha havido follow-up)
        prev_answers = session.get("current_answers", [])
        combined_answer = " ".join(prev_answers + [user_text]).strip()

        # 2. Avaliacao via IA da resposta do aluno
        evaluation = LevelingService._evaluate_answer(
            user_name=fresh_user.name or fresh_user.username,
            question=q_text,
            question_level=q_level,
            target=q_target,
            student_answer=combined_answer,
        )

        is_correct = evaluation.get("is_correct", False)
        mistakes = evaluation.get("mistakes", [])
        corrections = evaluation.get("corrections", [])
        feedback = evaluation.get("pedagogical_feedback", "")
        needs_follow_up = evaluation.get("needs_follow_up", False)
        follow_up_q = evaluation.get("follow_up_question", "")

        current_follow_ups = session.get("current_follow_ups", 0)

        # 3. Regra de follow-ups:
        # "ela nao deve conversar tanto e sim ir direto nas perguntas, claro fazer 2 perguntas no maximo a mais"
        # Se a resposta foi excessivamente curta (< 5 palavras) e precisa de mais detalhe, permite no maximo 2 perguntas extras
        words_count = len(user_text.strip().split())
        should_ask_follow_up = (
            current_follow_ups < 2
            and needs_follow_up
            and bool(follow_up_q)
            and words_count < 6
        )

        if should_ask_follow_up:
            session["current_follow_ups"] = current_follow_ups + 1
            session["current_answers"] = prev_answers + [user_text]
            fresh_user.profile["active_leveling"] = session
            fresh_user.save(update_fields=["profile"])

            follow_up_reply = f"{feedback}\n\n{follow_up_q}".strip()
            follow_up_reply = strip_emojis(follow_up_reply)

            audio_b64 = AudioService.text_to_speech(follow_up_reply, accent=session_accent)
            Message.objects.create(
                session_id=conversation_id,
                username=fresh_user.username,
                role="assistant",
                content=follow_up_reply,
                audio_b64=audio_b64,
            )
            Conversation.objects.filter(id=conversation_id).update(
                updated_at=datetime.now(timezone.utc).isoformat()
            )

            return {
                "ok": True,
                "reply": follow_up_reply,
                "audio_b64": audio_b64,
                "audio": audio_b64,
                "accent": session_accent,
                "is_leveling": True,
                "completed": False,
                "current_question": curr_idx + 1,
                "total_questions": total_q,
                "is_follow_up": True,
            }

        # Reseta follow-ups para a proxima pergunta
        session["current_follow_ups"] = 0
        session["current_answers"] = []

        # Atualiza contagem de acertos para o nivel avaliado
        if is_correct:
            if q_level in session["scores"]:
                session["scores"][q_level]["correct"] += 1

        # Registra atividade de ofensiva (XP do teste e concedido 1x ao dia na conclusao)
        StreakService.record_activity(fresh_user)

        # Registra resposta detalhada
        session["answers"].append({
            "index": curr_idx + 1,
            "question_id": curr_q.get("id", f"{q_level}_{curr_idx+1}"),
            "level": q_level,
            "question": q_text,
            "user_answer": combined_answer,
            "is_correct": is_correct,
            "mistakes": mistakes,
            "corrections": corrections,
            "feedback": feedback,
        })

        next_idx = curr_idx + 1
        session["current_index"] = next_idx

        # 4. Verifica se ainda ha mais perguntas
        if next_idx < total_q:
            next_q = questions[next_idx]
            reply_text = (
                f"{feedback}\n\n"
                f"---\n"
                f"**Question {next_idx + 1}/{total_q}**:\n"
                f"**{next_q['question']}**"
            )
            reply_text = strip_emojis(reply_text)

            # Salva o estado atualizado no perfil
            fresh_user.profile["active_leveling"] = session
            fresh_user.save(update_fields=["profile"])

            audio_b64 = AudioService.text_to_speech(reply_text, accent=session_accent)
            Message.objects.create(
                session_id=conversation_id,
                username=fresh_user.username,
                role="assistant",
                content=reply_text,
                audio_b64=audio_b64,
            )

            Conversation.objects.filter(id=conversation_id).update(
                updated_at=datetime.now(timezone.utc).isoformat()
            )

            return {
                "ok": True,
                "reply": reply_text,
                "audio_b64": audio_b64,
                "audio": audio_b64,
                "accent": session_accent,
                "is_leveling": True,
                "completed": False,
                "current_question": next_idx + 1,
                "total_questions": total_q,
            }
        else:
            # ── 5. TESTE CONCLUIDO COM SUCESSO! ─────────────────────────
            scores = session.get("scores", {})
            old_level = fresh_user.level or "A1"

            best_level = "A1"
            max_correct = -1
            level_hierarchy = ["A1", "A2", "B1", "B2"]

            for lvl in level_hierarchy:
                c = scores.get(lvl, {}).get("correct", 0)
                if c >= max_correct:
                    max_correct = c
                    best_level = lvl

            if max_correct == 0 and best_level != "A1":
                best_level = "A1"

            fresh_user.level = best_level

            now_iso = datetime.now(timezone.utc).isoformat()
            session["completed"] = True
            session["completed_at"] = now_iso
            session["assigned_level"] = best_level
            session["old_level"] = old_level

            if "leveling_history" not in fresh_user.profile or not isinstance(fresh_user.profile.get("leveling_history"), list):
                fresh_user.profile["leveling_history"] = []
            fresh_user.profile["leveling_history"].append(session)
            fresh_user.profile["active_leveling"] = None
            fresh_user.save(update_fields=["level", "profile"])

            # Pontua 25 XP apenas 1 vez ao dia no CEFR
            LevelingService._award_daily_leveling_xp(fresh_user)
            StreakService.record_activity(fresh_user)

            pdf_bytes = LevelingService.generate_pdf_report(
                student_name=fresh_user.name or fresh_user.username,
                date_str=datetime.now().strftime("%B %d, %Y"),
                old_level=old_level,
                new_level=best_level,
                scores_by_level=scores,
                qa_list=session.get("answers", []),
            )

            student_email = fresh_user.email
            email_sent = False
            if student_email and "@" in student_email:
                try:
                    email_html = LevelingService.build_email_html(
                        student_name=fresh_user.name or fresh_user.username,
                        new_level=best_level,
                        old_level=old_level,
                        scores=scores,
                        qa_list=session.get("answers", []),
                    )
                    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
                    attachments = [{
                        "name": f"Level_Assessment_Report_{fresh_user.username}.pdf",
                        "content": pdf_b64,
                    }]
                    res = BrevoEmailService.send_email_detailed(
                        to_email=student_email,
                        subject="Your English Level Assessment Results - Teacher Tati",
                        html_content=email_html,
                        recipient_name=fresh_user.name or fresh_user.username,
                        attachments=attachments,
                    )
                    email_sent = res.get("success", False)
                except Exception as mail_err:
                    logger.error(f"[Leveling] Failed sending report email: {mail_err}")

            email_notice = (
                f"A detailed diagnostic PDF report has been sent to your email ({student_email}) with your scores, mistakes, and corrections in English."
                if student_email
                else "Update your email in your profile to receive diagnostic reports directly in your inbox."
            )

            final_reply = (
                f"{feedback}\n\n"
                f"---\n"
                f"**Congratulations, {fresh_user.name or fresh_user.username}! You have completed your Leveling Assessment!**\n\n"
                f"**Your Performance by Level:**\n"
                f"• Level A1: {scores.get('A1', {}).get('correct', 0)}/{scores.get('A1', {}).get('total', 0)} correct\n"
                f"• Level A2: {scores.get('A2', {}).get('correct', 0)}/{scores.get('A2', {}).get('total', 0)} correct\n"
                f"• Level B1: {scores.get('B1', {}).get('correct', 0)}/{scores.get('B1', {}).get('total', 0)} correct\n"
                f"• Level B2: {scores.get('B2', {}).get('correct', 0)}/{scores.get('B2', {}).get('total', 0)} correct\n\n"
                f"**Your new CEFR Level is: {best_level}**\n"
                f"Your profile in Teacher Tati AI has been updated to **{best_level}**.\n\n"
                f"{email_notice}\n\n"
                f"I am so proud of your dedication! Keep practicing with me every day to reach your next fluency goal."
            )
            final_reply = strip_emojis(final_reply)

            audio_b64 = AudioService.text_to_speech(final_reply, accent=session_accent)

            Message.objects.create(
                session_id=conversation_id,
                username=fresh_user.username,
                role="assistant",
                content=final_reply,
                audio_b64=audio_b64,
            )

            Conversation.objects.filter(id=conversation_id).update(
                updated_at=datetime.now(timezone.utc).isoformat()
            )

            return {
                "ok": True,
                "reply": final_reply,
                "audio_b64": audio_b64,
                "audio": audio_b64,
                "accent": session_accent,
                "is_leveling": True,
                "completed": True,
                "new_level": best_level,
                "scores": scores,
                "email_sent": email_sent,
            }

    @staticmethod
    def _evaluate_answer(
        user_name: str,
        question: str,
        question_level: str,
        target: str,
        student_answer: str,
    ) -> Dict[str, Any]:
        """
        Avalia a resposta do aluno com LLM (Groq / Gemini) retornando JSON estruturado.
        Regra estrita: NENHUM emoji. Feedback conciso de no maximo 2 linhas citando o que o aluno falou.
        """
        prompt = (
            f"You are Teacher Tatiana Duarte (Teacher Tati), evaluating a student's answer in a CEFR English Leveling Assessment.\n"
            f"Question (CEFR Level {question_level}): \"{question}\"\n"
            f"Target Skills / Grammar: {target}\n"
            f"Student's Answer: \"{student_answer}\"\n\n"
            f"Evaluate whether the student's answer demonstrates sufficient communicative ability and grammatical control for CEFR Level {question_level}.\n"
            f"A minor slip should still pass if the meaning is clear and appropriate for {question_level}.\n\n"
            f"CRITICAL RULES:\n"
            f"1. In 'pedagogical_feedback', write AT MOST 2 LINES in English. You MUST specifically acknowledge or reference what the student said in their sentence (e.g. quote words or topics they mentioned like a place, food, activity, noise, feeling, etc.) and give a brief natural tip or phrasing correction. DO NOT ask conversational questions in 'pedagogical_feedback'.\n"
            f"2. If the student's answer was too brief (fewer than 4 words or vague) and you need them to speak a bit more to properly judge CEFR {question_level}, set 'needs_follow_up': true and provide 1 short follow-up question in 'follow_up_question'. Otherwise set 'needs_follow_up': false and 'follow_up_question': \"\".\n"
            f"3. Absolutely DO NOT use any emojis anywhere. No emojis permitted.\n\n"
            f"Respond ONLY with a valid JSON object matching this schema:\n"
            f"{{\n"
            f'  "is_correct": true,\n'
            f'  "mistakes": ["List specific grammatical or vocabulary mistakes in English, if any"],\n'
            f'  "corrections": ["Natural and correct English phrasing for the student\'s answer"],\n'
            f'  "pedagogical_feedback": "At most 2 lines in English specifically acknowledging what the user said with a constructive tip. NO emojis.",\n'
            f'  "needs_follow_up": false,\n'
            f'  "follow_up_question": ""\n'
            f"}}"
        )

        keys = get_groq_keys()
        for g_model in ["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]:
            for key in keys:
                try:
                    from groq import Groq
                    client = Groq(api_key=key, timeout=12.0)
                    res = client.chat.completions.create(
                        model=g_model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.2,
                        response_format={"type": "json_object"},
                        max_tokens=1000,
                    )
                    raw_json = res.choices[0].message.content
                    data = json.loads(raw_json)
                    if isinstance(data, dict):
                        if data.get("pedagogical_feedback"):
                            data["pedagogical_feedback"] = strip_emojis(data["pedagogical_feedback"]).strip()
                        return data
                except Exception as e:
                    logger.warning(f"[Leveling AI] Model {g_model} with key {key[:10]} failed: {e}")

        # Fallback Gemini
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")
        if gemini_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel("gemini-1.5-flash")
                res = model.generate_content(prompt + "\nReturn strictly JSON.")
                raw_text = res.text.strip()
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_text:
                    raw_text = raw_text.split("```")[1].split("```")[0].strip()
                data = json.loads(raw_text)
                if isinstance(data, dict):
                    if data.get("pedagogical_feedback"):
                        data["pedagogical_feedback"] = strip_emojis(data["pedagogical_feedback"]).strip()
                    return data
            except Exception as e:
                logger.warning(f"[Leveling AI] Gemini fallback failed: {e}")

        # Fallback heuristico seguro caso todas as APIs falhem (refere-se explicitamente ao que o aluno falou)
        clean_ans = student_answer.strip()
        words = clean_ans.split()
        has_text = len(clean_ans) > 3 and len(words) >= 2
        snippet = " ".join(words[:6])
        if has_text:
            pedagogical = f'You mentioned "{snippet}"—good effort! Try phrasing it in a complete sentence to sound even more natural.'
        elif snippet:
            pedagogical = f'You said "{snippet}". Try to answer with a full English sentence so I can better assess your level.'
        else:
            pedagogical = "Try to answer with a complete sentence in English so I can evaluate your level."

        return {
            "is_correct": has_text,
            "mistakes": [] if has_text else ["Answer was too short or incomplete."],
            "corrections": [clean_ans] if has_text else ["Please provide a complete sentence in English."],
            "pedagogical_feedback": strip_emojis(pedagogical),
            "needs_follow_up": not has_text,
            "follow_up_question": "Could you tell me a little more about that?" if not has_text else "",
        }


    @staticmethod
    def generate_pdf_report(
        student_name: str,
        date_str: str,
        old_level: str,
        new_level: str,
        scores_by_level: dict,
        qa_list: list,
    ) -> bytes:
        """
        Gera um arquivo PDF oficial de diagnóstico com ReportLab todo em inglês.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40,
        )

        styles = getSampleStyleSheet()
        primary_color = colors.HexColor("#7c3aed")
        primary_dark = colors.HexColor("#5b21b6")
        bg_light = colors.HexColor("#f8fafc")
        text_dark = colors.HexColor("#1e293b")
        text_muted = colors.HexColor("#64748b")

        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=primary_color,
            alignment=TA_CENTER,
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=text_muted,
            alignment=TA_CENTER,
        )
        section_title = ParagraphStyle(
            "SectionTitle",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=primary_dark,
            spaceBefore=14,
            spaceAfter=6,
        )
        normal_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13.5,
            textColor=text_dark,
        )
        bold_style = ParagraphStyle(
            "BodyBold",
            parent=normal_style,
            fontName="Helvetica-Bold",
        )

        story = []

        # 1. Header Banner
        story.append(Paragraph("TEACHER TATI AI • ENGLISH ACADEMY", subtitle_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph("CEFR English Diagnostic Assessment Report", title_style))
        story.append(Paragraph(f"Official Diagnostic Evaluation — {date_str}", subtitle_style))
        story.append(Spacer(1, 14))

        # 2. Student Info & Level Card
        level_card_data = [
            [
                Paragraph(
                    f"<b>Student:</b> {student_name}<br/>"
                    f"<b>Date:</b> {date_str}<br/>"
                    f"<b>Previous Level:</b> {old_level}",
                    normal_style,
                ),
                Paragraph(
                    f"<b>Assigned Level</b><br/><br/>"
                    f"<font size=28 color='#7c3aed'><b>{new_level}</b></font><br/><br/>"
                    f"<font size=8.5 color='#64748b'>CEFR Standard</font>",
                    ParagraphStyle("CenterLevel", parent=normal_style, alignment=TA_CENTER, leading=16),
                ),
            ]
        ]
        level_table = Table(level_card_data, colWidths=[350, 180])
        level_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg_light),
            ("BOX", (0, 0), (-1, -1), 1.5, primary_color),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 12),
            ("LINEAFTER", (0, 0), (0, 0), 1, colors.HexColor("#e2e8f0")),
        ]))
        story.append(level_table)
        story.append(Spacer(1, 16))

        # 3. Score Breakdown by Level
        story.append(Paragraph("1. Level Performance Breakdown", section_title))
        table_data = [["CEFR Level", "Questions Answered", "Correct Answers", "Proficiency Score", "Status"]]

        total_q = 0
        total_c = 0
        for lvl in ["A1", "A2", "B1", "B2"]:
            s = scores_by_level.get(lvl, {"correct": 0, "total": 0})
            corr = s.get("correct", 0)
            tot = s.get("total", 0)
            total_q += tot
            total_c += corr
            pct = (corr / tot * 100) if tot > 0 else 0
            status = "Mastered" if pct >= 80 else ("Competent" if pct >= 50 else "Developing")
            table_data.append([
                lvl,
                str(tot),
                str(corr),
                f"{pct:.0f}%",
                status,
            ])

        overall_pct = (total_c / total_q * 100) if total_q > 0 else 0
        table_data.append([
            "Overall Total",
            str(total_q),
            str(total_c),
            f"{overall_pct:.0f}%",
            f"Assigned: {new_level}",
        ])

        score_table = Table(table_data, colWidths=[90, 110, 110, 110, 110])
        score_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), primary_color),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 1), (0, -1), "LEFT"),
            ("BACKGROUND", (0, 1), (-1, -2), colors.white),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(score_table)
        story.append(Spacer(1, 16))

        # 4. Detailed Questions, Mistakes & Corrections
        story.append(Paragraph("2. Detailed Answers, Mistakes & Pedagogical Corrections", section_title))
        story.append(Paragraph(
            "Below is the complete transcript of questions answered during the diagnostic assessment, "
            "identifying points of friction and Teacher Tati's recommended corrections:",
            normal_style,
        ))
        story.append(Spacer(1, 8))

        for idx, item in enumerate(qa_list, 1):
            q_text = item.get("question", "")
            u_ans = item.get("user_answer", "")
            lvl = item.get("level", "")
            is_corr = item.get("is_correct", False)
            mistakes = item.get("mistakes", [])
            corrections = item.get("corrections", [])
            feedback = item.get("feedback", "")

            status_tag = (
                "<font color='#16a34a'><b>[CORRECT / PASS]</b></font>"
                if is_corr
                else "<font color='#dc2626'><b>[NEEDS IMPROVEMENT]</b></font>"
            )

            detail_flowables = []
            detail_flowables.append(Paragraph(f"<b>Question {idx} ({lvl})</b>: {q_text} — {status_tag}", bold_style))
            detail_flowables.append(Spacer(1, 2))
            detail_flowables.append(Paragraph(f"<b>Your Answer:</b> <i>\"{u_ans}\"</i>", normal_style))

            if mistakes:
                m_str = "; ".join(mistakes) if isinstance(mistakes, list) else str(mistakes)
                detail_flowables.append(Paragraph(f"<font color='#dc2626'><b>Mistake identified:</b></font> {m_str}", normal_style))

            if corrections:
                c_str = "; ".join(corrections) if isinstance(corrections, list) else str(corrections)
                detail_flowables.append(Paragraph(f"<font color='#16a34a'><b>Teacher Tati's Correction:</b></font> {c_str}", normal_style))

            if feedback:
                detail_flowables.append(Paragraph(f"<b>Feedback & Tip:</b> {feedback}", normal_style))

            detail_flowables.append(Spacer(1, 6))
            detail_flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=6))

            story.append(KeepTogether(detail_flowables))

        # 5. Teacher Tati's Recommendations & Next Steps
        story.append(Spacer(1, 10))
        story.append(Paragraph("3. Recommendations & Next Steps", section_title))
        rec_text = (
            f"Congratulations on completing your Diagnostic Assessment, {student_name}! "
            f"Your placed level in Teacher Tati AI has been updated to <b>{new_level}</b>. "
            f"To accelerate your journey to higher CEFR levels, practice speaking and conversation daily in the Chat, "
            f"review grammar topics in Activities, and practice your personalized Flashcards."
        )
        story.append(Paragraph(rec_text, normal_style))
        story.append(Spacer(1, 14))
        story.append(Paragraph("Teacher Tatiana Duarte • Teacher Tati AI", ParagraphStyle("Sign", parent=normal_style, fontName="Helvetica-Bold", textColor=primary_color)))

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def build_email_html(
        student_name: str,
        new_level: str,
        old_level: str,
        scores: dict,
        qa_list: list,
    ) -> str:
        """
        Gera o corpo HTML do e-mail de nivelamento totalmente em inglês.
        """
        rows_html = ""
        for lvl in ["A1", "A2", "B1", "B2"]:
            s = scores.get(lvl, {"correct": 0, "total": 0})
            corr = s.get("correct", 0)
            tot = s.get("total", 0)
            pct = (corr / tot * 100) if tot > 0 else 0
            rows_html += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 14px; font-weight: bold; color: #1e293b;">Level {lvl}</td>
                <td style="padding: 10px 14px; text-align: center; color: #475569;">{corr} / {tot}</td>
                <td style="padding: 10px 14px; text-align: center; font-weight: bold; color: {'#16a34a' if pct>=70 else '#7c3aed'};">{pct:.0f}%</td>
            </tr>
            """

        qa_html = ""
        for i, qa in enumerate(qa_list, 1):
            is_corr = qa.get("is_correct", False)
            badge = "<span style='color: #16a34a; font-weight: bold;'>[CORRECT]</span>" if is_corr else "<span style='color: #dc2626; font-weight: bold;'>[NEEDS IMPROVEMENT]</span>"
            mistake_html = ""
            if qa.get("mistakes"):
                m_str = "; ".join(qa["mistakes"]) if isinstance(qa["mistakes"], list) else str(qa["mistakes"])
                mistake_html = f"<p style='margin: 4px 0; color: #dc2626; font-size: 13px;'><b>Mistake:</b> {m_str}</p>"

            corr_html = ""
            if qa.get("corrections"):
                c_str = "; ".join(qa["corrections"]) if isinstance(qa["corrections"], list) else str(qa["corrections"])
                corr_html = f"<p style='margin: 4px 0; color: #16a34a; font-size: 13px;'><b>Correction:</b> {c_str}</p>"

            qa_html += f"""
            <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid {'#16a34a' if is_corr else '#dc2626'};">
                <div style="font-size: 13px; font-weight: bold; color: #334155; margin-bottom: 4px;">
                    Question {i} ({qa.get('level')}): {qa.get('question')} {badge}
                </div>
                <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">
                    <b>Your answer:</b> <i>"{qa.get('user_answer')}"</i>
                </div>
                {mistake_html}
                {corr_html}
                <div style="font-size: 12.5px; color: #64748b; margin-top: 4px;">
                    <b>Feedback:</b> {qa.get('feedback')}
                </div>
            </div>
            """

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Leveling Assessment Report</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0; color: #333333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #6366f1; margin: 0 0 4px 0; font-size: 22px; font-weight: 700;">Teacher Tatiana Duarte</h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0;">Your personal AI English tutor</p>
                </div>

                <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 1px;">Diagnostic Assessment Complete</div>
                    <div style="font-size: 20px; font-weight: 800; color: #1e293b; margin: 4px 0;">CEFR English Diagnostic Results</div>
                </div>

                <p style="font-size: 16px; color: #1e293b; margin: 16px 0 12px 0;">Hello, <strong>{student_name}</strong>!</p>
                <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 12px 0;">
                    You have successfully completed your diagnostic leveling assessment with Teacher Tati.
                    Based on your performance across all levels, your profile has been updated.
                </p>

                <div style="background: #f8fafc; border: 2px solid #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 12px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 1px;">Your Placed CEFR Level</span>
                    <div style="font-size: 38px; font-weight: 900; color: #6366f1; margin: 6px 0;">{new_level}</div>
                    <span style="font-size: 13px; color: #64748b;">Previous level: {old_level}</span>
                </div>

                <h3 style="color: #1e293b; font-size: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 24px;">
                    Score Breakdown by Level
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
                            <th style="padding: 10px 14px; color: #475569;">Level</th>
                            <th style="padding: 10px 14px; text-align: center; color: #475569;">Correct</th>
                            <th style="padding: 10px 14px; text-align: center; color: #475569;">Accuracy</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_html}
                    </tbody>
                </table>

                <h3 style="color: #1e293b; font-size: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 24px;">
                    Detailed Questions, Mistakes & Corrections
                </h3>
                {qa_html}

                <div style="background: #f8fafc; border-radius: 8px; padding: 14px; margin-top: 24px; text-align: center; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                        <b>Official PDF Report Attached</b>: We have attached your complete diagnostic report as a PDF to this email for your records.
                    </p>
                </div>

                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://tati-ai.vercel.app/chat" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 14px 28px; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 15px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
                        Continue Practicing in Chat
                    </a>
                </div>

                <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                    Tati AI — English Learning Experience. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        """
