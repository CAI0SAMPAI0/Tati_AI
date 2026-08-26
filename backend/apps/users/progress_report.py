import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.chat.models import Message
from apps.users.models import UserError
from django.contrib.auth import get_user_model

User = get_user_model()


class ProgressReportGenerator:
    @classmethod
    def generate_student_report(cls, username: str, lang: str = "en-US") -> str:
        """
        Gera um PDF elegante com o progresso semanal do aluno (ReportLab).
        """
        user = User.objects.filter(username=username).first()
        if not user:
            user = User(username=username, name=username, level="A1")

        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        msgs_count = Message.objects.filter(username=username, role='user', created_at__gte=seven_days_ago).count()
        errors = list(UserError.objects.filter(username=username, created_at__gte=seven_days_ago)[:5])

        report_dir = Path(settings.BASE_DIR) / "assets" / "reports"
        os.makedirs(report_dir, exist_ok=True)
        pdf_path = str(report_dir / f"report_{username}_{datetime.now().strftime('%Y%m%d')}.pdf")

        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40,
        )
        styles = getSampleStyleSheet()
        story = []

        BRAND_PURPLE = colors.HexColor("#6C63FF")
        BRAND_BG = colors.HexColor("#F8F7FF")
        TEXT_DARK = colors.HexColor("#1A1A2E")
        TEXT_MUTED = colors.HexColor("#6B7280")

        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            textColor=BRAND_PURPLE,
            fontSize=24,
            fontName="Helvetica-Bold",
            spaceAfter=5,
        )
        period_style = ParagraphStyle(
            "PeriodStyle",
            parent=styles["Normal"],
            textColor=TEXT_MUTED,
            fontSize=10,
            spaceAfter=25,
        )
        section_style = ParagraphStyle(
            "SectionStyle",
            parent=styles["Heading2"],
            textColor=TEXT_DARK,
            fontSize=15,
            fontName="Helvetica-Bold",
            spaceBefore=15,
            spaceAfter=10,
        )
        card_style = ParagraphStyle(
            "CardStyle", parent=styles["Normal"], fontSize=10, leading=14
        )

        story.append(Paragraph("Weekly Evolution Report", title_style))
        story.append(Paragraph(f"Student: <b>{user.name or username}</b> | Level: <b>{user.level or 'A1'}</b>", card_style))
        story.append(Paragraph(f"Generated on {datetime.now().strftime('%d/%m/%Y')} | Teacher Tati AI", period_style))

        # Stats Table
        stats_data = [
            [
                Paragraph(f"<b>{msgs_count}</b><br/><font color='#6B7280' size='8'>Messages Sent</font>", card_style),
                Paragraph(f"<b>{len(errors)}</b><br/><font color='#6B7280' size='8'>Errors Captured</font>", card_style),
                Paragraph(f"<b>{user.total_xp} XP</b><br/><font color='#6B7280' size='8'>Total Experience</font>", card_style),
            ]
        ]
        st = Table(stats_data, colWidths=[160, 160, 160])
        st.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BRAND_BG),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
        ]))
        story.append(st)
        story.append(Spacer(1, 20))

        # Learning tips & highlights
        story.append(Paragraph("Pedagogical Insights", section_style))
        story.append(Paragraph("• Regular conversation with Teacher Tati improves vocabulary retention and phonetic fluency.", card_style))
        story.append(Paragraph("• Complete daily quizzes and review Friday flashcards to strengthen weak memory points.", card_style))
        story.append(Spacer(1, 15))

        if errors:
            story.append(Paragraph("Recent Corrections", section_style))
            for err in errors:
                story.append(Paragraph(f"• <i>{err.detected_error or 'Usage error'}</i> → <b>{err.correction or 'Practice suggestion'}</b>", card_style))

        doc.build(story)
        return pdf_path
