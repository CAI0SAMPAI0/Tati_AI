import os
import re
import tempfile
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Image
)
from reportlab.platypus.flowables import KeepTogether

# ── Cores da Teacher Tati ─────────────────────────────────────────────────────
PRIMARY   = colors.HexColor('#7828C8')   # roxo
PRIMARY_L = colors.HexColor('#9D50E0')
DARK      = colors.HexColor('#1a1a2e')
MUTED     = colors.HexColor('#6b7280')
WHITE     = colors.white
BG_LIGHT  = colors.HexColor('#f5f0ff')

# ── Caminhos ──────────────────────────────────────────────────────────────────
_BASE_DIR  = Path(__file__).parent.parent
_LOGO_PATH = _BASE_DIR.parent / 'frontend' / 'assets' / 'images' / 'tati_logo.jpg'


def _make_styles():
    base = getSampleStyleSheet()

    def ps(name, **kw):
        return ParagraphStyle(name, parent=base['Normal'], **kw)

    return {
        'h1': ps('H1', fontSize=20, textColor=PRIMARY, spaceAfter=6,
                 spaceBefore=10, fontName='Helvetica-Bold', leading=24),
        'h2': ps('H2', fontSize=15, textColor=PRIMARY_L, spaceAfter=4,
                 spaceBefore=8, fontName='Helvetica-Bold', leading=18),
        'h3': ps('H3', fontSize=12, textColor=DARK, spaceAfter=3,
                 spaceBefore=6, fontName='Helvetica-Bold', leading=15),
        'body': ps('Body', fontSize=11, textColor=DARK, spaceAfter=4,
                   leading=16, fontName='Helvetica'),
        'bullet': ps('Bullet', fontSize=11, textColor=DARK, spaceAfter=3,
                     leading=15, leftIndent=12, fontName='Helvetica',
                     bulletIndent=0),
        'subbullet': ps('SubBullet', fontSize=11, textColor=DARK, spaceAfter=3,
                        leading=15, leftIndent=24, fontName='Helvetica',
                        bulletIndent=12),
        'numbered': ps('Numbered', fontSize=11, textColor=DARK, spaceAfter=3,
                       leading=15, leftIndent=16, fontName='Helvetica'),
    }


def _clean(text: str) -> str:
    """Remove/substitui caracteres problemáticos para o PDF."""
    subs = {
        '\u2018': "'", '\u2019': "'",
        '\u201c': '"', '\u201d': '"',
        '\u2013': '-', '\u2014': '--',
        '\u2022': '-', '\u2026': '...',
    }
    for k, v in subs.items():
        text = text.replace(k, v)
    # Remove markdown bold/italic e converte para tags HTML do ReportLab
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    
    # Remove apenas caracteres que REALMENTE quebram o ReportLab (fora do Latin-1 básico)
    # Mas preserva acentuação (á, é, í, ó, ú, ç, etc)
    # Emojis e caracteres asiáticos/árabes ainda serão removidos para evitar erros de fonte.
    return text.strip()


def _header_footer(canvas, doc):
    """Desenha header e footer em cada página."""
    canvas.saveState()
    w, h = A4

    # ── Header ────────────────────────────────────────────────────────────────
    # Logo (se existir)
    if _LOGO_PATH.exists():
        logo_h = 14 * mm
        logo_w = logo_h  # quadrado
        canvas.drawImage(
            str(_LOGO_PATH),
            doc.leftMargin,
            h - doc.topMargin + 4 * mm,
            width=logo_w, height=logo_h,
            preserveAspectRatio=True, mask='auto'
        )
        title_x = doc.leftMargin + logo_w + 4 * mm
    else:
        title_x = doc.leftMargin

    canvas.setFont('Helvetica-Bold', 13)
    canvas.setFillColor(PRIMARY)
    canvas.drawString(title_x, h - doc.topMargin + 8 * mm, 'STUDY REPORT - Teacher Tati')

    # Linha separadora do header
    canvas.setStrokeColor(PRIMARY)
    canvas.setLineWidth(1)
    canvas.line(doc.leftMargin, h - doc.topMargin + 2 * mm,
                w - doc.rightMargin, h - doc.topMargin + 2 * mm)

    # ── Footer ────────────────────────────────────────────────────────────────
    canvas.setStrokeColor(MUTED)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, doc.bottomMargin - 4 * mm,
                w - doc.rightMargin, doc.bottomMargin - 4 * mm)

    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    date_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    canvas.drawString(doc.leftMargin,
                      doc.bottomMargin - 9 * mm,
                      f'Page {doc.page} - Generated on {date_str} - Teacher Tati AI')

    canvas.restoreState()


def generate_report_pdf(content_markdown: str, filename: str = 'report.pdf') -> str:
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

        # ── Títulos ───────────────────────────────────────────────────────────
        if line.startswith('# '):
            text = _clean(line[2:])
            story.append(Spacer(1, 4 * mm))
            story.append(Paragraph(text, styles['h1']))
            story.append(HRFlowable(width='100%', thickness=1,
                                    color=PRIMARY_L, spaceAfter=3))
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

        # ── Linha em branco ───────────────────────────────────────────────────
        if line.strip() == '':
            story.append(Spacer(1, 2 * mm))
            continue

        # ── Sub-lista com tab: "\t+ texto" ou "  + texto" ─────────────────────
        if re.match(r'^[\t ]{1,}\+\s', line):
            text = _clean(re.sub(r'^[\t ]+\+\s*', '', line))
            story.append(Paragraph(f'&#8227; {text}', styles['subbullet']))
            continue

        # ── Lista com - * + ───────────────────────────────────────────────────
        if re.match(r'^[-*+]\s', line):
            text = _clean(line[2:])
            story.append(Paragraph(f'&#8226; {text}', styles['bullet']))
            continue

        # ── Lista numerada ────────────────────────────────────────────────────
        m = re.match(r'^(\d+)\.\s(.*)', line)
        if m:
            text = _clean(m.group(2))
            story.append(Paragraph(f'<b>{m.group(1)}.</b> {text}', styles['numbered']))
            continue

        # ── Texto normal ──────────────────────────────────────────────────────
        text = _clean(line)
        if text:
            story.append(Paragraph(text, styles['body']))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return output_path