import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, Image as RLImage

from apps.chat.models import Message
from apps.activities.models import ActivitySubmission
from django.contrib.auth import get_user_model

User = get_user_model()


class ProgressReportGenerator:
    @classmethod
    def generate_student_report(cls, username: str, lang: str = "en-US") -> str:
        """
        Gera um PDF elegante com logo da Tatiana, métricas semanais e mensais de atividades,
        sem a seção de erros capturados (ReportLab).
        """
        user = User.objects.filter(username=username).first()
        if not user:
            user = User(username=username, name=username, level="A1")

        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        # Chat messages in last 7 days
        msgs_count = Message.objects.filter(
            username=username, role="user", created_at__gte=seven_days_ago
        ).count()

        # Activities completed in last 30 days
        all_completed_30d = list(
            ActivitySubmission.objects.filter(
                username=username, created_at__gte=thirty_days_ago
            )
            .exclude(status="pending")
            .order_by("-created_at")
        )
        completed_7d = [
            s for s in all_completed_30d if s.created_at and s.created_at >= seven_days_ago
        ]

        total_weekly_activities = len(completed_7d)
        total_monthly_activities = len(all_completed_30d)

        # Count activities by category (filter/breakdown)
        category_counts_weekly: dict[str, int] = {}
        for s in completed_7d:
            cat = (s.activity_type or "general").capitalize()
            category_counts_weekly[cat] = category_counts_weekly.get(cat, 0) + 1

        category_counts_monthly: dict[str, int] = {}
        for s in all_completed_30d:
            cat = (s.activity_type or "general").capitalize()
            category_counts_monthly[cat] = category_counts_monthly.get(cat, 0) + 1

        report_dir = Path(settings.BASE_DIR) / "assets" / "reports"
        os.makedirs(report_dir, exist_ok=True)
        pdf_path = str(
            report_dir / f"report_{username}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        )

        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )
        styles = getSampleStyleSheet()
        story = []

        BRAND_PURPLE = colors.HexColor("#6C63FF")
        BRAND_BG = colors.HexColor("#F8F7FF")
        TEXT_DARK = colors.HexColor("#1A1A2E")
        TEXT_MUTED = colors.HexColor("#6B7280")
        BORDER_LIGHT = colors.HexColor("#E2E8F0")

        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            textColor=BRAND_PURPLE,
            fontSize=22,
            fontName="Helvetica-Bold",
            spaceAfter=4,
            leading=26,
        )
        period_style = ParagraphStyle(
            "PeriodStyle",
            parent=styles["Normal"],
            textColor=TEXT_MUTED,
            fontSize=9,
            spaceAfter=15,
            leading=12,
        )
        section_style = ParagraphStyle(
            "SectionStyle",
            parent=styles["Heading2"],
            textColor=TEXT_DARK,
            fontSize=13,
            fontName="Helvetica-Bold",
            spaceBefore=12,
            spaceAfter=6,
            leading=16,
        )
        card_style = ParagraphStyle(
            "CardStyle", parent=styles["Normal"], fontSize=9, leading=13
        )
        center_card_style = ParagraphStyle(
            "CenterCardStyle", parent=styles["Normal"], fontSize=9, leading=13, alignment=1
        )
        header_table_text = ParagraphStyle(
            "HeaderTableText", parent=styles["Normal"], fontSize=9, leading=14, textColor=TEXT_DARK
        )

        # 1. Header with Tatiana's Logo on the top-right
        logo_path = Path(settings.BASE_DIR) / "assets" / "images" / "tati_logo.jpg"
        if not logo_path.exists():
            logo_path = Path(settings.BASE_DIR).parent / "frontend" / "public" / "images" / "tati_logo.jpg"

        logo_element = Paragraph("", card_style)
        if logo_path.exists():
            try:
                logo_element = RLImage(str(logo_path), width=65, height=65)
            except Exception:
                pass

        header_info = [
            Paragraph("Learning Evolution Report", title_style),
            Paragraph(
                f"Student: <b>{user.name or username}</b> &nbsp;|&nbsp; Level: <b>{user.level or 'A1'}</b>",
                header_table_text,
            ),
            Paragraph(
                f"Generated on {datetime.now().strftime('%b %d, %Y')} &nbsp;|&nbsp; Teacher Tatiana Duarte",
                period_style,
            ),
        ]

        header_table = Table([[header_info, logo_element]], colWidths=[430, 90])
        header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        story.append(header_table)
        story.append(Spacer(1, 10))

        # 2. Main KPI Stats Table (Weekly & Monthly activities sum, Messages, Total XP)
        stats_data = [
            [
                Paragraph(
                    f"<font size='16' color='#6C63FF'><b>{total_weekly_activities}</b></font><br/><font color='#6B7280' size='8'>Weekly Activities</font>",
                    center_card_style,
                ),
                Paragraph(
                    f"<font size='16' color='#16A34A'><b>{total_monthly_activities}</b></font><br/><font color='#6B7280' size='8'>Monthly Activities</font>",
                    center_card_style,
                ),
                Paragraph(
                    f"<font size='16' color='#EAB308'><b>{msgs_count}</b></font><br/><font color='#6B7280' size='8'>Messages (7d)</font>",
                    center_card_style,
                ),
                Paragraph(
                    f"<font size='16' color='#3B82F6'><b>{getattr(user, 'total_xp', 0)} XP</b></font><br/><font color='#6B7280' size='8'>Total Experience</font>",
                    center_card_style,
                ),
            ]
        ]
        st = Table(stats_data, colWidths=[130, 130, 130, 130])
        st.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), BRAND_BG),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("LINEBEFORE", (1, 0), (-1, 0), 1, BORDER_LIGHT),
                ]
            )
        )
        story.append(st)
        story.append(Spacer(1, 15))

        # 3. Category Breakdown (Filter/Distribution of activities)
        story.append(Paragraph("Activities Summary by Category", section_style))
        all_categories = sorted(
            list(set(list(category_counts_weekly.keys()) + list(category_counts_monthly.keys())))
        )
        if all_categories:
            breakdown_data = [
                [
                    Paragraph("<b>Category</b>", card_style),
                    Paragraph("<b>Weekly Done</b>", center_card_style),
                    Paragraph("<b>Monthly Done</b>", center_card_style),
                ]
            ]
            for cat in all_categories:
                w_count = category_counts_weekly.get(cat, 0)
                m_count = category_counts_monthly.get(cat, 0)
                breakdown_data.append(
                    [
                        Paragraph(f"<b>{cat}</b>", card_style),
                        Paragraph(f"{w_count}", center_card_style),
                        Paragraph(f"{m_count}", center_card_style),
                    ]
                )
            
            # Add Total row
            breakdown_data.append(
                [
                    Paragraph("<b>Total Completed</b>", card_style),
                    Paragraph(f"<b>{total_weekly_activities}</b>", center_card_style),
                    Paragraph(f"<b>{total_monthly_activities}</b>", center_card_style),
                ]
            )

            bt = Table(breakdown_data, colWidths=[220, 150, 150])
            bt.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BG),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("LINEBELOW", (0, 0), (-1, 0), 1, BORDER_LIGHT),
                        ("LINEBELOW", (0, -1), (-1, -1), 1.5, BRAND_PURPLE),
                        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
                    ]
                )
            )
            story.append(bt)
        else:
            story.append(
                Paragraph(
                    "<i>No activities recorded in the last 30 days. Complete exercises to see your breakdown!</i>",
                    card_style,
                )
            )

        story.append(Spacer(1, 15))

        # 4. Completed Activities List (Quais foram as atividades)
        story.append(Paragraph("Recent Completed Activities", section_style))
        if all_completed_30d:
            act_list_data = [
                [
                    Paragraph("<b>Date</b>", card_style),
                    Paragraph("<b>Category</b>", card_style),
                    Paragraph("<b>Activity Title</b>", card_style),
                    Paragraph("<b>Score</b>", center_card_style),
                ]
            ]
            for act in all_completed_30d[:12]:
                date_str = (
                    act.created_at.strftime("%b %d") if act.created_at else "-"
                )
                cat_str = (act.activity_type or "General").capitalize()
                meta = act.metadata if isinstance(act.metadata, dict) else {}
                title = meta.get("title") or act.activity_type or "Exercise"
                if len(title) > 36:
                    title = title[:33] + "..."
                score_str = f"{act.score}%" if act.score is not None else "Done"

                act_list_data.append(
                    [
                        Paragraph(f"<font size='8' color='#6B7280'>{date_str}</font>", card_style),
                        Paragraph(f"<font size='8' color='#6C63FF'><b>{cat_str}</b></font>", card_style),
                        Paragraph(f"<font size='8'>{title}</font>", card_style),
                        Paragraph(f"<font size='8' color='#16A34A'><b>{score_str}</b></font>", center_card_style),
                    ]
                )

            act_table = Table(act_list_data, colWidths=[65, 105, 290, 60])
            act_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BG),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
                    ]
                )
            )
            story.append(act_table)
        else:
            story.append(
                Paragraph(
                    "<i>Practice vocabulary, grammar, and simulations to log your learning milestones.</i>",
                    card_style,
                )
            )

        story.append(Spacer(1, 15))

        # 5. Teacher Tatiana's Pedagogical Guidance (Encouraging feedback, NO errors captured)
        story.append(Paragraph("Teacher Tatiana's Pedagogical Guidance", section_style))
        story.append(
            Paragraph(
                "• <b>Consistent Practice:</b> Daily practice with Teacher Tati reinforces memory connections and phonetic fluency.",
                card_style,
            )
        )
        story.append(
            Paragraph(
                "• <b>Active Recall:</b> Review your weekly flashcards and review exercises to solidify newly acquired vocabulary.",
                card_style,
            )
        )
        story.append(
            Paragraph(
                "• <b>Interactive Simulations:</b> Engage in real-world scenarios to build conversational confidence.",
                card_style,
            )
        )

        doc.build(story)
        return pdf_path
