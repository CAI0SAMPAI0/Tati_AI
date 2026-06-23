import os
import re
import tempfile
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

# ── Cores da Teacher Tati ─────────────────────────────────────────────
PRIMARY = colors.HexColor('#7828C8')  # roxo
PRIMARY_L = colors.HexColor('#9D50E0')
DARK = colors.HexColor('#1a1a2e')
MUTED = colors.HexColor('#6b7280')
WHITE = colors.white
BG_LIGHT = colors.HexColor('#f5f0ff')

# ── Caminhos ──────────────────────────────────────────────────────────
_BASE_DIR = Path(__file__).parent.parent
_LOGO_CANDIDATES = [
    Path(__file__).parent.parent.parent.parent /
    'assets' / 'images' / 'tati_logo.jpg',
    Path(__file__).parent.parent.parent.parent.parent /
    'frontend' / 'public' / 'images' / 'tati_logo.jpg',
]
_LOGO_PATH = next((p for p in _LOGO_CANDIDATES if p.exists()), None)


def _make_styles():
    base = getSampleStyleSheet()

    def ps(name, **kw):
        return ParagraphStyle(name, parent=base['Normal'], **kw)

    return {
        'h1': ps(
            'H1',
            fontSize=20,
            textColor=PRIMARY,
            spaceAfter=6,
            spaceBefore=10,
            fontName='Helvetica-Bold',
            leading=24,
        ),
        'h2': ps(
            'H2',
            fontSize=15,
            textColor=PRIMARY_L,
            spaceAfter=4,
            spaceBefore=8,
            fontName='Helvetica-Bold',
            leading=18,
        ),
        'h3': ps(
            'H3',
            fontSize=12,
            textColor=DARK,
            spaceAfter=3,
            spaceBefore=6,
            fontName='Helvetica-Bold',
            leading=15,
        ),
        'body': ps(
            'Body',
            fontSize=11,
            textColor=DARK,
            spaceAfter=4,
            leading=16,
            fontName='Helvetica',
        ),
        'bullet': ps(
            'Bullet',
            fontSize=11,
            textColor=DARK,
            spaceAfter=3,
            leading=15,
            leftIndent=12,
            fontName='Helvetica',
            bulletIndent=0,
        ),
        'subbullet': ps(
            'SubBullet',
            fontSize=11,
            textColor=DARK,
            spaceAfter=3,
            leading=15,
            leftIndent=24,
            fontName='Helvetica',
            bulletIndent=12,
        ),
        'numbered': ps(
            'Numbered',
            fontSize=11,
            textColor=DARK,
            spaceAfter=3,
            leading=15,
            leftIndent=16,
            fontName='Helvetica',
        ),
    }


def _clean(text: str) -> str:
    """Remove/substitui caracteres problemáticos para o PDF."""
    subs = {
        '\u2018': "'",
        '\u2019': "'",
        '\u201c': '"',
        '\u201d': '"',
        '\u2013': '-',
        '\u2014': '--',
        '\u2022': '-',
        '\u2026': '...',
    }
    for k, v in subs.items():
        text = text.replace(k, v)
    # Remove markdown bold/italic e converte para tags HTML do ReportLab
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)

    # Remove apenas caracteres que REALMENTE quebram o ReportLab (fora do Latin-1 básico)
    # Mas preserva acentuação (á, é, í, ó, ú, ç, etc)
    # Emojis e caracteres asiáticos/árabes ainda serão removidos para
    # evitar erros de fonte.
    return text.strip()


def _header_footer(canvas, doc):
    """Desenha header e footer em cada página."""
    canvas.saveState()
    w, h = A4

    # ── Header ────────────────────────────────────────────────────────
    # Logo (se existir)
    if _LOGO_PATH:
        logo_h = 14 * mm
        logo_w = logo_h  # quadrado
        canvas.drawImage(
            str(_LOGO_PATH),
            doc.leftMargin,
            h - doc.topMargin + 4 * mm,
            width=logo_w,
            height=logo_h,
            preserveAspectRatio=True,
            mask='auto',
        )
        title_x = doc.leftMargin + logo_w + 4 * mm
    else:
        title_x = doc.leftMargin

    canvas.setFont('Helvetica-Bold', 13)
    canvas.setFillColor(PRIMARY)
    canvas.drawString(
        title_x,
        h - doc.topMargin + 8 * mm,
        'STUDY REPORT - Teacher Tati')

    # Linha separadora do header
    canvas.setStrokeColor(PRIMARY)
    canvas.setLineWidth(1)
    canvas.line(
        doc.leftMargin,
        h - doc.topMargin + 2 * mm,
        w - doc.rightMargin,
        h - doc.topMargin + 2 * mm,
    )

    # ── Footer ────────────────────────────────────────────────────────
    canvas.setStrokeColor(MUTED)
    canvas.setLineWidth(0.5)
    canvas.line(
        doc.leftMargin,
        doc.bottomMargin - 4 * mm,
        w - doc.rightMargin,
        doc.bottomMargin - 4 * mm,
    )

    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    date_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    canvas.drawString(
        doc.leftMargin,
        doc.bottomMargin - 9 * mm,
        f'Page {doc.page} - Generated on {date_str} - Teacher Tati AI',
    )

    canvas.restoreState()


def generate_report_pdf(
        content_markdown: str,
        filename: str = 'report.pdf') -> str:
    """
    Gera um PDF formatado a partir de Markdown.
    Suporta: # H1, ## H2, ### H3, listas - * +, sub-listas com tab+, numeradas.
    """
    output_path = os.path.join(tempfile.gettempdir(), filename)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=24 * mm,
        bottomMargin=20 * mm,
    )

    styles = _make_styles()
    story = []

    lines = content_markdown.split('\n')
    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        i += 1

        # ── Títulos ───────────────────────────────────────────────────
        if line.startswith('# '):
            text = _clean(line[2:])
            story.append(Spacer(1, 4 * mm))
            story.append(Paragraph(text, styles['h1']))
            story.append(
                HRFlowable(width='100%', thickness=1,
                           color=PRIMARY_L, spaceAfter=3)
            )
            continue

        if line.startswith('## '):
            text = _clean(line[3:])
            story.append(Spacer(1, 3 * mm))
            story.append(Paragraph(text, styles['h2']))
            continue

        if line.startswith('### '):
            text = _clean(line[4:])
            story.append(Spacer(1, 2 * mm))
            story.append(Paragraph(text, styles['h3']))
            continue

        # ── Linha em branco ───────────────────────────────────────────
        if line.strip() == '':
            story.append(Spacer(1, 2 * mm))
            continue

        # ── Sub-lista com tab: "\t+ texto" ou "  + texto" ─────────────
        if re.match(r'^[\t ]{1,}\+\s', line):
            text = _clean(re.sub(r'^[\t ]+\+\s*', '', line))
            story.append(
                Paragraph(
                    f'&#8227; {text}',
                    styles['subbullet']))
            continue

        # ── Lista com - * + ───────────────────────────────────────────
        if re.match(r'^[-*+]\s', line):
            text = _clean(line[2:])
            story.append(Paragraph(f'&#8226; {text}', styles['bullet']))
            continue

        # ── Lista numerada ────────────────────────────────────────────
        m = re.match(r'^(\d+)\.\s(.*)', line)
        if m:
            text = _clean(m.group(2))
            story.append(
                Paragraph(
                    f'<b>{
                        m.group(1)}.</b> {text}',
                    styles['numbered']))
            continue

        # ── Texto normal ──────────────────────────────────────────────
        text = _clean(line)
        if text:
            story.append(Paragraph(text, styles['body']))

    doc.build(
        story,
        onFirstPage=_header_footer,
        onLaterPages=_header_footer)
    return output_path


def generate_certificate_pdf(student_name: str, level: str, date_str: str) -> str:
    """
    Gera um PDF de certificado de conclusão de nível CEFR no formato paisagem (landscape).
    """
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.platypus import Table, TableStyle
    import tempfile

    output_path = os.path.join(tempfile.gettempdir(), f"certificate_{student_name.replace(' ', '_')}_{level}.pdf")

    # Landscape A4 is 842.27 x 595.27
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=30 * mm,
        rightMargin=30 * mm,
        topMargin=25 * mm,
        bottomMargin=25 * mm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CertTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=32,
        leading=38,
        textColor=PRIMARY,
        alignment=1,
        spaceAfter=15 * mm
    )
    subtitle_style = ParagraphStyle(
        'CertSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        leading=18,
        textColor=DARK,
        alignment=1,
        spaceAfter=10 * mm
    )
    name_style = ParagraphStyle(
        'CertName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=PRIMARY_L,
        alignment=1,
        spaceAfter=10 * mm
    )
    body_style = ParagraphStyle(
        'CertBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=14,
        leading=20,
        textColor=DARK,
        alignment=1,
        spaceAfter=15 * mm
    )
    date_style = ParagraphStyle(
        'CertDate',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=12,
        leading=16,
        textColor=MUTED,
        alignment=1,
        spaceAfter=20 * mm
    )

    story = []

    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("CERTIFICATE OF ACHIEVEMENT", title_style))
    story.append(Paragraph("This is to certify that", subtitle_style))
    story.append(Paragraph(student_name, name_style))
    story.append(Paragraph(f"has successfully completed the English language course and achieved the CEFR level of", subtitle_style))
    story.append(Paragraph(f"<b>{level}</b>", name_style))
    story.append(Paragraph("under the guidance of Teacher Tatiana and the Tati AI learning platform.", body_style))
    story.append(Paragraph(f"Granted on {date_str}", date_style))

    sig_style_1 = ParagraphStyle(
        'CertSig1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=DARK,
        alignment=1
    )
    sig_style_2 = ParagraphStyle(
        'CertSig2',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=12,
        textColor=MUTED,
        alignment=1
    )

    sig_data = [
        [
            Paragraph("_______________________________", sig_style_2),
            Paragraph("_______________________________", sig_style_2)
        ],
        [
            Paragraph("<b>Tatiana</b>", sig_style_1),
            Paragraph("<b>Tati AI Platform</b>", sig_style_1)
        ],
        [
            Paragraph("Lead Teacher & Mentor", sig_style_2),
            Paragraph("Academic Director", sig_style_2)
        ]
    ]

    sig_table = Table(sig_data, colWidths=[90 * mm, 90 * mm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))

    story.append(sig_table)

    def draw_background(canvas, doc):
        canvas.saveState()
        w, h = landscape(A4)

        # Outer border
        canvas.setStrokeColor(PRIMARY)
        canvas.setLineWidth(4)
        canvas.rect(10 * mm, 10 * mm, w - 20 * mm, h - 20 * mm)

        # Inner thin border
        canvas.setStrokeColor(PRIMARY_L)
        canvas.setLineWidth(1)
        canvas.rect(12 * mm, 12 * mm, w - 24 * mm, h - 24 * mm)

        # Watermark/Logo
        if _LOGO_PATH:
            logo_size = 20 * mm
            canvas.drawImage(
                str(_LOGO_PATH),
                w - 35 * mm,
                h - 35 * mm,
                width=logo_size,
                height=logo_size,
                preserveAspectRatio=True,
                mask='auto'
            )

        canvas.restoreState()

    doc.build(story, onFirstPage=draw_background)
    return output_path
