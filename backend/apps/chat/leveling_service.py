import os
import json
import uuid
import random
import logging
import base64
from datetime import datetime, timezone
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
from apps.chat.audio_service import AudioService, get_groq_keys
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
        if not user or not hasattr(user, "profile") or not isinstance(user.profile, dict):
            return False
        active = user.profile.get("active_leveling")
        if isinstance(active, dict) and active.get("conversation_id") == conversation_id:
            return not active.get("completed", False)
        return False

    @staticmethod
    def start_leveling_session(user: User, count_per_level: Optional[int] = None) -> Dict[str, Any]:
        """
        Inicia uma nova sessão de nivelamento com Teacher Tati.
        Seleciona de 3 a 5 perguntas aleatórias de cada nível CEFR (A1, A2, B1, B2) e as embaralha.
        """
        bank = LEVELING_QUESTIONS_BANK or load_leveling_questions()
        selected_questions = []

        for lvl in ["A1", "A2", "B1", "B2"]:
            pool = bank.get(lvl, [])
            if pool:
                if count_per_level and 1 <= count_per_level <= len(pool):
                    sample_count = count_per_level
                else:
                    sample_count = random.randint(QUESTIONS_PER_LEVEL_MIN, min(QUESTIONS_PER_LEVEL_MAX, len(pool)))
                sampled = random.sample(pool, sample_count)
                selected_questions.extend(sampled)

        # Embaralha todas as perguntas selecionadas em ordem aleatória
        random.shuffle(selected_questions)

        if not selected_questions:
            # Fallback caso os dados não estejam disponíveis
            selected_questions = [
                {"id": "A1_1", "level": "A1", "question": "What's your name and where are you from?", "target": "Basic introduction"},
                {"id": "A2_1", "level": "A2", "question": "What did you do last weekend?", "target": "Past simple tense"},
                {"id": "B1_1", "level": "B1", "question": "What's something you used to do but don't do anymore?", "target": "Used to habit"},
                {"id": "B2_1", "level": "B2", "question": "Do you think people today are more impatient than before? Why?", "target": "Abstract opinion"}
            ]

        now_str = datetime.now(timezone.utc).isoformat()
        conv_id = str(uuid.uuid4())

        # 1. Cria a conversa dedicada no banco
        conv = Conversation.objects.create(
            id=conv_id,
            username=user.username,
            title="🎯 CEFR Leveling Assessment • Teacher Tati",
            model="groq/llama-3.3-70b-versatile",
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
        }

        if not isinstance(user.profile, dict):
            user.profile = {}
        user.profile["active_leveling"] = session_data
        user.save()

        # 2. Mensagem inicial da Teacher Tati com a Questão 1
        first_q = selected_questions[0]
        student_name = user.name or user.username
        
        opening_text = (
            f"🌟 **Welcome to your CEFR English Leveling Challenge, {student_name}!** 🌟\n\n"
            f"I'm Teacher Tati, your personal AI English tutor. Today we will discover your exact English level across the CEFR framework (A1, A2, B1, and B2).\n\n"
            f"I will ask you **{total_q} questions** in random order. Answer naturally in English—feel free to type or use your microphone!\n\n"
            f"✨ **At the end:**\n"
            f"• Your system level will be automatically updated to the level where you performed best.\n"
            f"• You will receive a complete diagnostic report in your email with your score per level, mistakes, and corrections.\n\n"
            f"Let's begin with your first question!\n\n"
            f"---\n"
            f"**Question 1/{total_q}**:\n"
            f"👉 **{first_q['question']}**"
        )

        audio_b64 = AudioService.text_to_speech(opening_text)

        msg = Message.objects.create(
            session_id=conv_id,
            username=user.username,
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
            "is_leveling": True,
            "current_question": 1,
            "total_questions": total_q,
            "question_text": first_q["question"],
        }

    @staticmethod
    def process_leveling_step(user: User, conversation_id: str, user_text: str) -> Dict[str, Any]:
        """
        Processa uma resposta do aluno no teste de nivelamento.
        Avalia gramática/vocabulário com IA, pontua o nível e faz a pergunta seguinte ou conclui o teste.
        """
        # Salva mensagem do usuário
        Message.objects.create(
            session_id=conversation_id,
            username=user.username,
            role="user",
            content=user_text,
        )

        if not isinstance(user.profile, dict) or "active_leveling" not in user.profile:
            return {
                "reply": "No active leveling session found. Starting a regular chat.",
                "audio_b64": "",
                "is_leveling": False,
            }

        session = user.profile["active_leveling"]
        questions = session.get("questions", [])
        curr_idx = session.get("current_index", 0)
        total_q = session.get("total_questions", len(questions))

        if curr_idx >= len(questions):
            # Teste já foi concluído anteriormente
            return {
                "reply": "Your leveling test has already been completed! Great job!",
                "audio_b64": "",
                "is_leveling": False,
            }

        curr_q = questions[curr_idx]
        q_level = curr_q.get("level", "A1")
        q_text = curr_q.get("question", "")
        q_target = curr_q.get("target", "")

        # 1. Avaliação via IA da resposta do aluno
        evaluation = LevelingService._evaluate_answer(
            user_name=user.name or user.username,
            question=q_text,
            question_level=q_level,
            target=q_target,
            student_answer=user_text,
        )

        is_correct = evaluation.get("is_correct", False)
        mistakes = evaluation.get("mistakes", [])
        corrections = evaluation.get("corrections", [])
        feedback = evaluation.get("pedagogical_feedback", "")

        # Atualiza contagem de acertos para o nível avaliado
        if is_correct:
            if q_level in session["scores"]:
                session["scores"][q_level]["correct"] += 1

        # Registra resposta detalhada
        session["answers"].append({
            "index": curr_idx + 1,
            "question_id": curr_q.get("id", f"{q_level}_{curr_idx+1}"),
            "level": q_level,
            "question": q_text,
            "user_answer": user_text,
            "is_correct": is_correct,
            "mistakes": mistakes,
            "corrections": corrections,
            "feedback": feedback,
        })

        next_idx = curr_idx + 1
        session["current_index"] = next_idx

        # 2. Verifica se ainda há mais perguntas
        if next_idx < total_q:
            next_q = questions[next_idx]
            reply_text = (
                f"{feedback}\n\n"
                f"---\n"
                f"**Question {next_idx + 1}/{total_q}**:\n"
                f"👉 **{next_q['question']}**"
            )

            # Salva o estado atualizado no perfil
            user.profile["active_leveling"] = session
            user.save()

            audio_b64 = AudioService.text_to_speech(reply_text)
            msg = Message.objects.create(
                session_id=conversation_id,
                username=user.username,
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
                "is_leveling": True,
                "completed": False,
                "current_question": next_idx + 1,
                "total_questions": total_q,
            }

        else:
            # ── 3. TESTE CONCLUÍDO! ─────────────────────────────────────
            scores = session.get("scores", {})
            old_level = user.level or "A1"

            # Determina o novo nível:
            # "O nível dele no sistema será ajustado para o nível que ele mais acertou as respostas."
            # Critério de desempate: nível CEFR mais avançado entre os que tiveram maior pontuação
            best_level = "A1"
            max_correct = -1
            level_hierarchy = ["A1", "A2", "B1", "B2"]

            for lvl in level_hierarchy:
                c = scores.get(lvl, {}).get("correct", 0)
                if c >= max_correct:
                    max_correct = c
                    best_level = lvl

            # Se errou tudo, mantém A1 como base inicial
            if max_correct == 0 and best_level != "A1":
                best_level = "A1"

            # Atualiza o nível do aluno no banco de dados
            user.level = best_level

            # Marca sessão como finalizada e salva histórico
            now_iso = datetime.now(timezone.utc).isoformat()
            session["completed"] = True
            session["completed_at"] = now_iso
            session["assigned_level"] = best_level
            session["old_level"] = old_level

            if "leveling_history" not in user.profile or not isinstance(user.profile.get("leveling_history"), list):
                user.profile["leveling_history"] = []
            user.profile["leveling_history"].append(session)
            user.profile["active_leveling"] = None
            user.save()

            # Bonificação de XP e Streak
            XPService.award_xp(user, 50, "Completed CEFR Leveling Challenge")
            StreakService.record_activity(user)

            # 4. Geração do relatório em PDF (ReportLab)
            pdf_bytes = LevelingService.generate_pdf_report(
                student_name=user.name or user.username,
                date_str=datetime.now().strftime("%B %d, %Y"),
                old_level=old_level,
                new_level=best_level,
                scores_by_level=scores,
                qa_list=session.get("answers", []),
            )

            # 5. Envio de E-mail em inglês com PDF anexado
            student_email = user.email
            email_sent = False
            if student_email and "@" in student_email:
                try:
                    email_html = LevelingService.build_email_html(
                        student_name=user.name or user.username,
                        new_level=best_level,
                        old_level=old_level,
                        scores=scores,
                        qa_list=session.get("answers", []),
                    )
                    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
                    attachments = [{
                        "name": f"Level_Assessment_Report_{user.username}.pdf",
                        "content": pdf_b64,
                    }]
                    res = BrevoEmailService.send_email_detailed(
                        to_email=student_email,
                        subject="🎯 Your English Level Assessment Results & Report — Teacher Tati",
                        html_content=email_html,
                        recipient_name=user.name or user.username,
                        attachments=attachments,
                    )
                    email_sent = res.get("success", False)
                    logger.info(f"[Leveling] Email sent to {student_email}: {email_sent}")
                except Exception as mail_err:
                    logger.error(f"[Leveling] Failed sending report email: {mail_err}")

            # 6. Mensagem final da Teacher Tati no chat
            email_notice = (
                f"📧 A detailed diagnostic PDF report has been sent to your email (**{student_email}**) with your scores, mistakes, and corrections in English!"
                if student_email
                else "💡 Update your email in your profile to receive diagnostic reports directly in your inbox!"
            )

            final_reply = (
                f"{feedback}\n\n"
                f"---\n"
                f"🎉 **Congratulations, {user.name or user.username}! You have completed your Leveling Assessment!** 🎉\n\n"
                f"📊 **Your Performance by Level:**\n"
                f"• **Level A1**: {scores.get('A1', {}).get('correct', 0)}/{scores.get('A1', {}).get('total', 0)} correct\n"
                f"• **Level A2**: {scores.get('A2', {}).get('correct', 0)}/{scores.get('A2', {}).get('total', 0)} correct\n"
                f"• **Level B1**: {scores.get('B1', {}).get('correct', 0)}/{scores.get('B1', {}).get('total', 0)} correct\n"
                f"• **Level B2**: {scores.get('B2', {}).get('correct', 0)}/{scores.get('B2', {}).get('total', 0)} correct\n\n"
                f"🏆 **Your new CEFR Level is: {best_level}**!\n"
                f"Your profile in Teacher Tati AI has been updated to **{best_level}**.\n\n"
                f"{email_notice}\n\n"
                f"I'm so proud of your dedication! Keep practicing with me every day to reach your next fluency goal! 🚀"
            )

            audio_b64 = AudioService.text_to_speech(final_reply)

            msg = Message.objects.create(
                session_id=conversation_id,
                username=user.username,
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
        """
        prompt = (
            f"You are Teacher Tatiana Duarte (Teacher Tati), evaluating a student's answer in a CEFR English Leveling Assessment.\n"
            f"Question (CEFR Level {question_level}): \"{question}\"\n"
            f"Target Skills / Grammar: {target}\n"
            f"Student's Answer: \"{student_answer}\"\n\n"
            f"Evaluate whether the student's answer demonstrates sufficient communicative ability and grammatical control for CEFR Level {question_level}.\n"
            f"A minor slip should still pass if the meaning is clear and appropriate for {question_level}.\n"
            f"Respond ONLY with a valid JSON object matching this schema:\n"
            f"{{\n"
            f'  "is_correct": true,\n'
            f'  "mistakes": ["List specific grammatical or vocabulary mistakes in English, if any"],\n'
            f'  "corrections": ["Natural and correct English phrasing for the student\'s answer"],\n'
            f'  "pedagogical_feedback": "1-2 warm, encouraging sentences in English from Teacher Tati directly to the student ({user_name}), acknowledging their response and offering a quick helpful tip."\n'
            f"}}"
        )

        keys = get_groq_keys()
        for key in keys:
            try:
                from groq import Groq
                client = Groq(api_key=key)
                res = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                    response_format={"type": "json_object"},
                    max_tokens=400,
                )
                raw_json = res.choices[0].message.content
                data = json.loads(raw_json)
                if isinstance(data, dict):
                    return data
            except Exception as e:
                logger.warning(f"[Leveling AI] Groq key failed: {e}")

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
                return json.loads(raw_text)
            except Exception as e:
                logger.warning(f"[Leveling AI] Gemini fallback failed: {e}")

        # Fallback heurístico seguro caso todas as APIs falhem
        has_text = len(student_answer.strip()) > 3
        return {
            "is_correct": has_text,
            "mistakes": [] if has_text else ["Answer was too short or empty."],
            "corrections": [student_answer] if has_text else ["Please provide a complete sentence."],
            "pedagogical_feedback": "Well done! Thank you for sharing your answer with me." if has_text else "Keep going! Try to express yourself in a complete sentence.",
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
            <title>Leveling Assessment Report</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
                <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px 24px; text-align: center; color: #ffffff;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800;">TEACHER TATI AI</h1>
                    <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">CEFR English Diagnostic Assessment Results</p>
                </div>
                
                <div style="padding: 28px 24px;">
                    <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Hello, {student_name}! 🌟</h2>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                        You have successfully completed your diagnostic leveling assessment with Teacher Tati!
                        Based on your performance and mastery across different skill levels, your system profile has been updated.
                    </p>

                    <div style="background: #f5f3ff; border: 2px solid #7c3aed; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 13px; font-weight: bold; color: #6b21a8; text-transform: uppercase; letter-spacing: 1px;">Your Placed CEFR Level</span>
                        <div style="font-size: 40px; font-weight: 900; color: #7c3aed; margin: 8px 0;">{new_level}</div>
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

                    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 24px; text-align: center;">
                        <p style="margin: 0; font-size: 13px; color: #64748b;">
                            📎 <b>Official PDF Report Attached</b>: We have attached your complete diagnostic report as a PDF to this email for your records.
                        </p>
                    </div>

                    <div style="text-align: center; margin-top: 32px;">
                        <a href="https://tati-ai.vercel.app/chat" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 12px 28px; font-weight: bold; text-decoration: none; border-radius: 10px; font-size: 14px;">
                            Continue Practicing in Chat
                        </a>
                    </div>
                </div>

                <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                    Teacher Tati AI • Expert English Tutoring • All rights reserved
                </div>
            </div>
        </body>
        </html>
        """
