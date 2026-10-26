import logging
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from django.db import connection
from django.utils import timezone as django_timezone

from .models import ActivitySubmission, ScrapedActivityContent

logger = logging.getLogger(__name__)

# Categorias estritamente permitidas nos exames trimestrais (Grammar até Reading)
ALLOWED_EXAM_CATEGORIES = {"grammar", "vocabulary", "listening", "reading"}

# Tipos/categorias explicitamente proibidos nos exames (Music, Flashcards, Simulations, Games, News, etc.)
FORBIDDEN_ACTIVITY_TYPES = {
    "musics",
    "music",
    "lingoclip",
    "flashcards",
    "flashcard",
    "simulations",
    "simulation",
    "games",
    "game",
    "wordwall",
    "news",
    "podcast",
    "podcasts",
    "trimestral_exam",
}

_TABLE_READY = False
_TABLE_LOCK = threading.Lock()
_SCRAPE_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pw_activity_scraper")
_URL_LOCKS: Dict[str, threading.Lock] = {}
_URL_LOCKS_GUARD = threading.Lock()


def ensure_scraped_activity_table() -> None:
    """Garante de forma idempotente que a tabela scraped_activity_contents exista no PostgreSQL."""
    global _TABLE_READY
    if _TABLE_READY:
        return
    with _TABLE_LOCK:
        if _TABLE_READY:
            return
        try:
            with connection.cursor() as cur:
                if connection.vendor == "sqlite":
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS scraped_activity_contents (
                            id VARCHAR(36) PRIMARY KEY,
                            url VARCHAR(1000) UNIQUE NOT NULL,
                            slug VARCHAR(255) DEFAULT '',
                            title VARCHAR(500) DEFAULT '',
                            category VARCHAR(50) NOT NULL,
                            level VARCHAR(20) NOT NULL DEFAULT 'A1',
                            reading_text TEXT DEFAULT '',
                            audio_text TEXT DEFAULT '',
                            questions TEXT DEFAULT '[]',
                            raw_content TEXT DEFAULT '',
                            scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    )
                else:
                    cur.execute(
                        """
                        CREATE TABLE IF NOT EXISTS scraped_activity_contents (
                            id UUID PRIMARY KEY,
                            url VARCHAR(1000) UNIQUE NOT NULL,
                            slug VARCHAR(255) DEFAULT '',
                            title VARCHAR(500) DEFAULT '',
                            category VARCHAR(50) NOT NULL,
                            level VARCHAR(20) NOT NULL DEFAULT 'A1',
                            reading_text TEXT DEFAULT '',
                            audio_text TEXT DEFAULT '',
                            questions JSONB DEFAULT '[]'::jsonb,
                            raw_content TEXT DEFAULT '',
                            scraped_at TIMESTAMPTZ DEFAULT NOW(),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        );
                        CREATE INDEX IF NOT EXISTS idx_scraped_activity_cat_lvl
                            ON scraped_activity_contents (category, level);
                        CREATE INDEX IF NOT EXISTS idx_scraped_activity_slug
                            ON scraped_activity_contents (slug);
                        """
                    )
            _TABLE_READY = True
        except Exception as e:
            logger.warning(f"[ActivityPlaywrightScraper] Erro ao garantir tabela scraped_activity_contents: {e}")


def _get_url_lock(url: str) -> threading.Lock:
    with _URL_LOCKS_GUARD:
        if url not in _URL_LOCKS:
            _URL_LOCKS[url] = threading.Lock()
        return _URL_LOCKS[url]


class ActivityPlaywrightScraper:
    """
    Serviço responsável por:
    1. Verificar quais atividades (estritamente Grammar, Vocabulary, Listening e Reading)
       o aluno já concluiu no nível CEFR atual dele (excluindo Music, Flashcards, Simulations, Games e News).
    2. Extrair via Playwright as questões reais, opções/lacunas, respostas corretas, explicações,
       textos de Reading e scripts/contexto de Listening diretamente da atividade e persistir no PostgreSQL.
    3. Fornecer essa base estruturada para a IA gerar o exame trimestral do aluno e para exibição no Dashboard.
    """

    @staticmethod
    def normalize_url(url: str) -> str:
        if not url:
            return ""
        cleaned = str(url).strip()
        if cleaned.startswith("http") and "test-english.com" in cleaned and "?" in cleaned:
            cleaned = cleaned.split("?", 1)[0]
        if cleaned.startswith("http") and "test-english.com" in cleaned and not cleaned.endswith("/"):
            cleaned += "/"
        return cleaned

    @classmethod
    def classify_category(cls, activity_type: str, metadata: Dict[str, Any], url: str) -> Optional[str]:
        """
        Retorna 'grammar', 'vocabulary', 'listening' ou 'reading' se a atividade pertencer
        ao escopo permitido para exames. Caso seja Music, Flashcards, Simulations, Games, News, etc.,
        retorna None.
        """
        act_type_low = str(activity_type or "").strip().lower()
        meta_cat_low = str((metadata or {}).get("category") or "").strip().lower()
        url_low = str(url or "").strip().lower()

        if act_type_low in FORBIDDEN_ACTIVITY_TYPES or meta_cat_low in FORBIDDEN_ACTIVITY_TYPES:
            return None

        if any(
            bad in url_low
            for bad in ("wordwall.net", "lingoclip.com", "lyricstraining.com", "youtube.com", "youtu.be", "spotify.com")
        ):
            return None

        # Mapeamento pela URL do Test-English (fonte mais confiável)
        if "/grammar-points/" in url_low:
            return "grammar"
        if "/vocabulary/" in url_low:
            return "vocabulary"
        if "/listening/" in url_low:
            return "listening"
        if "/reading/" in url_low:
            return "reading"

        # Mapeamento por metadata.category ou activity_type
        for candidate in (meta_cat_low, act_type_low):
            if candidate in ("grammar",):
                return "grammar"
            if candidate in ("vocabulary", "vocab"):
                return "vocabulary"
            if candidate in ("listening", "listenings"):
                return "listening"
            if candidate in ("reading", "readings"):
                return "reading"

        return None

    @classmethod
    def extract_activity_levels(cls, metadata: Dict[str, Any], url: str, title: str = "") -> List[str]:
        """
        Identifica a quais níveis CEFR a atividade pertence (ex: ['A1'], ['B1', 'B2'] para /b1-b2/).
        """
        url_low = str(url or "").strip().lower()
        # 1. Segmento explícito na URL do Test-English
        m = re.search(r"/(a1|a2|b1-b2|b1|b2|c1|c2)/", url_low)
        if m:
            seg = m.group(1).upper()
            if seg == "B1-B2":
                return ["B1", "B2"]
            return [seg]

        # 2. Campo explícito no metadata
        meta_lvl = str((metadata or {}).get("level") or (metadata or {}).get("cefr_level") or "").strip().upper()
        if meta_lvl in ("B1+", "B1-B2"):
            return ["B1", "B2"]
        if meta_lvl in ("A1", "A2", "B1", "B2", "C1", "C2"):
            return [meta_lvl]

        # 3. Sufixo no título (ex: "... – A2 English Vocabulary", "... – B1+ English Reading")
        title_str = str(title or (metadata or {}).get("title") or "")
        tm = re.search(r"\b(A1|A2|B1\+|B1-B2|B1|B2|C1|C2)\b", title_str, flags=re.IGNORECASE)
        if tm:
            tok = tm.group(1).upper()
            if tok in ("B1+", "B1-B2"):
                return ["B1", "B2"]
            return [tok]

        return []

    @classmethod
    def level_matches_student(cls, activity_levels: List[str], student_level: str) -> bool:
        """Verifica se o nível da atividade corresponde ao nível atual em que o aluno está."""
        target = (student_level or "A1").strip().upper()
        if not activity_levels:
            return False
        if target in activity_levels:
            return True
        # No Test-English não há URLs separadas de C2 (usam C1 para proficiência avançada)
        if target == "C2" and "C1" in activity_levels:
            return True
        return False

    @classmethod
    def get_student_completed_exam_activities(
        cls,
        username: str,
        level: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lista todas as atividades concluídas pelo aluno (status='completed', score > 0)
        estritamente de Grammar, Vocabulary, Listening e Reading, filtradas pelo nível atual do aluno.
        Anexa os dados já extraídos via Playwright salvos em `scraped_activity_contents`.
        """
        ensure_scraped_activity_table()
        if not username:
            return []

        target_level = (level or "").strip().upper() or None
        subs = list(
            ActivitySubmission.objects.filter(
                username__iexact=username,
                status="completed",
                score__gt=0,
            ).order_by("-created_at")
        )

        # Mapa de URLs no catálogo local para enriquecer título/nível se faltar na submission
        catalog_by_url: Dict[str, Dict[str, str]] = {}
        try:
            from .services import ExternalContentService
            check_lvls = [target_level] if target_level else ["A1", "A2", "B1", "B2", "C1"]
            if target_level == "C2" and "C1" not in check_lvls:
                check_lvls.append("C1")
            for lv in check_lvls:
                if not lv:
                    continue
                for cat in ("grammar", "vocabulary", "listening", "reading"):
                    for it in ExternalContentService.get_test_english_content(lv, cat).get("items", []):
                        u_norm = cls.normalize_url(it.get("url", ""))
                        if u_norm:
                            catalog_by_url[u_norm] = {
                                "title": it.get("title", ""),
                                "category": cat,
                                "level": lv,
                                "slug": it.get("slug", ""),
                            }
                    for it in ExternalContentService.get_liveworksheets_content(lv, cat).get("items", []):
                        u_norm = cls.normalize_url(it.get("url", ""))
                        if u_norm:
                            catalog_by_url[u_norm] = {
                                "title": it.get("title", ""),
                                "category": cat,
                                "level": lv,
                                "slug": it.get("slug", ""),
                            }
        except Exception as e:
            logger.debug(f"[ActivityPlaywrightScraper] Aviso ao carregar catálogo auxiliar: {e}")

        seen_keys = set()
        matched_items: List[Dict[str, Any]] = []

        for s in subs:
            meta = s.metadata if isinstance(s.metadata, dict) else {}
            raw_url = meta.get("url") or meta.get("activity_id") or meta.get("id") or ""
            url = cls.normalize_url(raw_url) if str(raw_url).startswith("http") else ""

            cat_info = catalog_by_url.get(url, {})
            category = cls.classify_category(s.activity_type, meta, url) or cat_info.get("category")
            if category not in ALLOWED_EXAM_CATEGORIES:
                continue

            title = str(meta.get("title") or cat_info.get("title") or meta.get("slug") or url).strip()
            slug = str(meta.get("slug") or cat_info.get("slug") or "").strip()
            if not slug and url:
                slug = urlparse(url).path.strip("/").split("/")[-1]

            act_levels = cls.extract_activity_levels(meta, url, title)
            if not act_levels and cat_info.get("level"):
                act_levels = [cat_info["level"].upper()]

            if target_level:
                # Se a atividade tem nível identificável, exige compatibilidade com o nível atual do aluno
                if act_levels and not cls.level_matches_student(act_levels, target_level):
                    continue
                # Se não tem URL/nível explícito (ex: tópico manual sem URL), ignora se não for do nível
                if not act_levels and not url:
                    continue

            dedup_key = url or f"{category}:{slug or title.lower()}"
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            matched_items.append({
                "submission_id": str(s.id),
                "url": url,
                "slug": slug,
                "title": title,
                "category": category,
                "level": target_level or (act_levels[0] if act_levels else "A1"),
                "activity_levels": act_levels,
                "score": s.score,
                "completed_at": s.created_at.isoformat() if s.created_at else None,
                "is_student_completed": True,
            })

        # Anexa registros já salvos em scraped_activity_contents
        urls = [it["url"] for it in matched_items if it.get("url")]
        scraped_map: Dict[str, ScrapedActivityContent] = {}
        if urls:
            try:
                for row in ScrapedActivityContent.objects.filter(url__in=urls):
                    scraped_map[row.url] = row
            except Exception as e:
                logger.warning(f"[ActivityPlaywrightScraper] Erro ao consultar atividades extraídas: {e}")

        for it in matched_items:
            row = scraped_map.get(it["url"]) if it.get("url") else None
            if row:
                it["scraped"] = True
                it["scraped_id"] = str(row.id)
                it["questions_count"] = len(row.questions or [])
                it["questions"] = row.questions or []
                it["reading_text"] = row.reading_text or ""
                it["audio_text"] = row.audio_text or ""
                it["raw_content"] = row.raw_content or ""
                it["scraped_at"] = row.scraped_at.isoformat() if row.scraped_at else None
            else:
                it["scraped"] = False
                it["scraped_id"] = None
                it["questions_count"] = 0
                it["questions"] = []
                it["reading_text"] = ""
                it["audio_text"] = ""
                it["raw_content"] = ""
                it["scraped_at"] = None

        return matched_items

    @classmethod
    def _playwright_scrape_worker(
        cls,
        url: str,
        category: str,
        level: str,
        fallback_title: str = "",
    ) -> Dict[str, Any]:
        """
        Executa o Chromium via Playwright Sync API em thread isolada (seguro mesmo dentro de event loop ASGI).
        Extrai questões, opções, respostas corretas, explicações, textos de Reading e scripts de Listening.
        """
        from playwright.sync_api import sync_playwright

        result: Dict[str, Any] = {
            "title": fallback_title,
            "reading_text": "",
            "audio_text": "",
            "questions": [],
            "raw_content": "",
        }

        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
            try:
                ctx = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                    ),
                    viewport={"width": 1366, "height": 768},
                    locale="en-US",
                )
                ctx.add_init_script(
                    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined}); "
                    "window.chrome = {runtime: {}};"
                )
                page = ctx.new_page()
                page.on("dialog", lambda d: d.accept())

                page.goto(url, wait_until="domcontentloaded", timeout=35000)
                page.wait_for_timeout(2800)

                if "Just a moment" in (page.title() or ""):
                    page.wait_for_timeout(5500)

                # 1. Coleta dados antes do envio (título, opções de <select>, texto de Reading, intro de Listening, regras)
                pre_data = page.evaluate(
                    """(cat) => {
                        const docTitle = (document.querySelector('h1')?.textContent || document.title || '')
                            .replace(/\\s*-\\s*Test-English.*$/i, '')
                            .trim();

                        // Captura opções de dropdown por questão antes do submit
                        const qContainers = Array.from(document.querySelectorAll('.watupro-choices-columns, [id^="div-question-"]'));
                        const selectOptionsByIdx = qContainers.map(qEl => {
                            const opts = [];
                            qEl.querySelectorAll('select').forEach(sel => {
                                Array.from(sel.options).forEach(o => {
                                    const t = (o.textContent || '').trim();
                                    if (t && !opts.includes(t)) opts.push(t);
                                });
                            });
                            return opts;
                        });

                        // Extrai texto principal antes do quiz (#tabli1-cont sem #watupro_quiz)
                        let preQuizText = '';
                        const tab1 = document.querySelector('#tabli1-cont') || document.querySelector('.entry-content');
                        if (tab1) {
                            const clone = tab1.cloneNode(true);
                            clone.querySelectorAll(
                                '#watupro_quiz, form, script, style, .watupro_buttons, .su-button, a[href*="listening"], a[href*="reading"], a[href*="grammar"], a[href*="vocabulary"]'
                            ).forEach(n => n.remove());
                            preQuizText = (clone.innerText || clone.textContent || '')
                                .replace(/See the full list of.*$/gim, '')
                                .replace(/Questions\\s*$/gim, '')
                                .replace(/Please wait\\.\\.\\./gi, '')
                                .replace(/\\n{3,}/g, '\\n\\n')
                                .trim();
                        }

                        // Extrai aba 2 (Explanation / Transcription se disponível)
                        let tab2Text = '';
                        const tab2 = document.querySelector('#tabli2-cont') || document.querySelector('.su-spoiler-content') || document.querySelector('.transcription');
                        if (tab2) {
                            const rawT2 = (tab2.textContent || '').replace(/\\s+/g, ' ').trim();
                            if (rawT2 && !/Register for more Content/i.test(rawT2) && !/Upgrade to PRO/i.test(rawT2)) {
                                tab2Text = rawT2.slice(0, 3500);
                            }
                        }

                        return { docTitle, selectOptionsByIdx, preQuizText, tab2Text };
                    }""",
                    category,
                )

                if pre_data.get("docTitle"):
                    result["title"] = pre_data["docTitle"]

                pre_quiz_text = (pre_data.get("preQuizText") or "").strip()
                tab2_text = (pre_data.get("tab2Text") or "").strip()
                select_opts_by_idx = pre_data.get("selectOptionsByIdx") or []

                if category == "reading":
                    result["reading_text"] = pre_quiz_text[:4000]
                elif category == "listening":
                    result["audio_text"] = (tab2_text or pre_quiz_text)[:4000]
                else:
                    result["raw_content"] = (tab2_text or pre_quiz_text)[:3000]

                # 2. Preenche respostas dummy e clica em Check Answers no WatuPRO para revelar gabaritos e explicações
                has_submit = page.evaluate(
                    """() => {
                        document.querySelectorAll('select').forEach(s => {
                            if (s.options.length > 1) s.selectedIndex = 1;
                        });
                        const seenRadio = {};
                        document.querySelectorAll('input[type="radio"]').forEach(r => {
                            if (!seenRadio[r.name]) {
                                r.checked = true;
                                seenRadio[r.name] = true;
                            }
                        });
                        document.querySelectorAll('input[type="text"], textarea').forEach(inp => {
                            if (!inp.value) inp.value = 'x';
                        });
                        const btn = document.querySelector('#action-button') ||
                            Array.from(document.querySelectorAll('input[type="button"], button')).find(
                                b => /check answers|submit|finish/i.test(b.value || b.innerText || '')
                            );
                        if (btn) {
                            btn.click();
                            return true;
                        }
                        return false;
                    }"""
                )

                if has_submit:
                    try:
                        page.wait_for_selector(".show-question", timeout=6500)
                    except Exception:
                        page.wait_for_timeout(3500)

                # 3. Extrai todas as questões corrigidas (.show-question)
                post_questions = page.evaluate(
                    """() => {
                        const items = [];
                        const showEls = Array.from(document.querySelectorAll('.show-question'));
                        showEls.forEach((sq, idx) => {
                            // 3.1 Enunciado com lacunas limpas
                            let qText = '';
                            const qContent = sq.querySelector('.show-question-content');
                            if (qContent) {
                                const cClone = qContent.cloneNode(true);
                                cClone.querySelectorAll('.watupro_num, img, .watupro-screen-reader').forEach(n => n.remove());
                                cClone.querySelectorAll('.user-answer').forEach(ua => {
                                    const blank = document.createTextNode(' _______ ');
                                    ua.replaceWith(blank);
                                });
                                qText = (cClone.textContent || '').replace(/\\s+/g, ' ').trim();
                            }

                            // 3.2 Alternativas de múltipla escolha (se houver)
                            const mcOptions = [];
                            let mcCorrect = '';
                            sq.querySelectorAll('.show-question-choices li.answer').forEach(li => {
                                const ansSpan = li.querySelector('span.answer') || li;
                                const cloneSpan = ansSpan.cloneNode(true);
                                cloneSpan.querySelectorAll('.watupro-screen-reader').forEach(n => n.remove());
                                let optTxt = (cloneSpan.textContent || '').replace(/\\s+/g, ' ').trim();
                                optTxt = optTxt.replace(/^[A-D]\\.\\s*/i, '').trim();
                                if (optTxt) {
                                    mcOptions.push(optTxt);
                                    if (li.classList.contains('correct-answer')) {
                                        mcCorrect = optTxt;
                                    }
                                }
                            });

                            // 3.3 Feedback / Resposta correta de lacuna + explicação
                            let correctAns = mcCorrect;
                            let explanation = '';
                            const fb = sq.querySelector('.watupro-main-feedback');
                            if (fb) {
                                const rawFb = (fb.innerText || fb.textContent || '').replace(/\\s+/g, ' ').trim();
                                const m = rawFb.match(/Correct answers?:\\s*([^‣\\n]+)(?:‣(.*))?$/i);
                                if (m) {
                                    if (!correctAns) {
                                        correctAns = m[1].trim();
                                    }
                                    explanation = (m[2] || '').replace(/‣/g, ' ').replace(/\\s+/g, ' ').trim();
                                } else {
                                    explanation = rawFb.replace(/‣/g, ' ').replace(/\\s+/g, ' ').trim();
                                }
                            }

                            if (qText) {
                                items.push({
                                    number: idx + 1,
                                    question: qText,
                                    options: mcOptions,
                                    correct_answer: correctAns,
                                    explanation: explanation,
                                });
                            }
                        });
                        return items;
                    }"""
                )

                cleaned_questions: List[Dict[str, Any]] = []
                spoken_facts: List[str] = []

                for i, q in enumerate(post_questions or []):
                    opts = q.get("options") or []
                    if not opts and i < len(select_opts_by_idx) and select_opts_by_idx[i]:
                        opts = select_opts_by_idx[i][:6]
                    expl = str(q.get("explanation") or "").strip()
                    if expl:
                        spoken_facts.append(expl)
                    cleaned_questions.append({
                        "number": q.get("number", i + 1),
                        "question": str(q.get("question") or "").strip(),
                        "options": opts,
                        "correct_answer": str(q.get("correct_answer") or "").strip(),
                        "explanation": expl,
                    })

                result["questions"] = cleaned_questions

                # Para Listening: se o site ocultou o transcript completo, enriquece audio_text com os detalhes falados reais extraídos do gabarito
                if category == "listening" and spoken_facts:
                    joined_facts = " | ".join(spoken_facts[:8])
                    if result["audio_text"]:
                        result["audio_text"] = f"{result['audio_text']}\nKey spoken details from audio: {joined_facts}"[:4000]
                    else:
                        result["audio_text"] = f"Spoken details from listening exercise: {joined_facts}"[:4000]

            finally:
                browser.close()

        return result

    @classmethod
    def scrape_and_save_activity(
        cls,
        url: str,
        category: str,
        level: str,
        title: str = "",
        slug: str = "",
        force_refresh: bool = False,
    ) -> Optional[ScrapedActivityContent]:
        """
        Verifica se a URL já foi extraída no banco PostgreSQL; se não (ou se force_refresh=True),
        aciona o Playwright em thread dedicada, extrai questões, respostas corretas e textos, e salva no banco.
        """
        ensure_scraped_activity_table()
        norm_url = cls.normalize_url(url)
        if not norm_url or category not in ALLOWED_EXAM_CATEGORIES:
            return None

        url_lock = _get_url_lock(norm_url)
        with url_lock:
            existing = ScrapedActivityContent.objects.filter(url=norm_url).first()
            if existing and (existing.questions or existing.reading_text or existing.audio_text) and not force_refresh:
                return existing

            if not slug:
                slug = urlparse(norm_url).path.strip("/").split("/")[-1]

            logger.info(f"[ActivityPlaywrightScraper] Extraindo via Playwright [{level}][{category}]: {norm_url}")
            try:
                future = _SCRAPE_EXECUTOR.submit(
                    cls._playwright_scrape_worker,
                    norm_url,
                    category,
                    level,
                    title,
                )
                scraped_data = future.result(timeout=65)
            except Exception as e:
                logger.warning(f"[ActivityPlaywrightScraper] Falha ao extrair {norm_url} via Playwright: {e}")
                return existing

            now = django_timezone.now()
            final_title = (title or scraped_data.get("title") or slug).strip()[:500]
            questions = scraped_data.get("questions") or []
            reading_text = (scraped_data.get("reading_text") or "").strip()
            audio_text = (scraped_data.get("audio_text") or "").strip()
            raw_content = (scraped_data.get("raw_content") or "").strip()

            try:
                if existing:
                    existing.slug = slug[:255]
                    existing.title = final_title
                    existing.category = category
                    existing.level = level.upper()
                    existing.reading_text = reading_text
                    existing.audio_text = audio_text
                    existing.questions = questions
                    existing.raw_content = raw_content
                    existing.updated_at = now
                    existing.save()
                    return existing
                else:
                    created = ScrapedActivityContent.objects.create(
                        id=uuid.uuid4(),
                        url=norm_url,
                        slug=slug[:255],
                        title=final_title,
                        category=category,
                        level=level.upper(),
                        reading_text=reading_text,
                        audio_text=audio_text,
                        questions=questions,
                        raw_content=raw_content,
                        scraped_at=now,
                        updated_at=now,
                    )
                    return created
            except Exception as db_err:
                logger.warning(f"[ActivityPlaywrightScraper] Erro ao salvar atividade extraída no banco: {db_err}")
                return existing

    @classmethod
    def sync_student_activities(
        cls,
        username: str,
        level: str,
        max_to_scrape: int = 6,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Verifica as atividades concluídas pelo aluno no nível atual (Grammar até Reading)
        e executa o Playwright para salvar no banco todas as que ainda não foram extraídas (até max_to_scrape por chamada).
        """
        lvl = (level or "A1").strip().upper()
        completed_items = cls.get_student_completed_exam_activities(username=username, level=lvl)

        newly_scraped = 0
        for item in completed_items:
            if not item.get("url"):
                continue
            if not item.get("scraped") or force_refresh:
                if newly_scraped >= max_to_scrape:
                    break
                row = cls.scrape_and_save_activity(
                    url=item["url"],
                    category=item["category"],
                    level=lvl,
                    title=item.get("title", ""),
                    slug=item.get("slug", ""),
                    force_refresh=force_refresh,
                )
                if row and (row.questions or row.reading_text or row.audio_text):
                    newly_scraped += 1

        # Recarrega com dados atualizados do banco
        refreshed = cls.get_student_completed_exam_activities(username=username, level=lvl)
        by_category = {cat: [] for cat in ("grammar", "vocabulary", "listening", "reading")}
        for it in refreshed:
            cat = it.get("category")
            if cat in by_category:
                by_category[cat].append(it)

        return {
            "username": username,
            "level": lvl,
            "total_completed": len(refreshed),
            "total_scraped": sum(1 for it in refreshed if it.get("scraped")),
            "newly_scraped": newly_scraped,
            "counts_by_category": {cat: len(items) for cat, items in by_category.items()},
            "activities": refreshed,
            "by_category": by_category,
        }

    @classmethod
    def build_exam_prompt_foundation(
        cls,
        username: Optional[str],
        level: str,
        scrape_missing: bool = True,
    ) -> Dict[str, Any]:
        """
        Constrói a base pedagógica real para o gerador de exames da IA:
        1. Prioriza estritamente as atividades que o aluno JÁ FEZ no NÍVEL ATUAL dele
           (somente Grammar, Vocabulary, Listening e Reading).
        2. Faz a verificação via Playwright das atividades concluídas ainda não extraídas e salva no banco.
        3. Formata exemplos reais de questões, respostas corretas, textos de Reading e scripts de Listening
           para que a IA crie o exame seguindo exatamente o padrão e nível dessas atividades.
        4. Jamais inclui Music, Flashcards, Simulations, Games ou News.
        """
        ensure_scraped_activity_table()
        lvl = (level or "A1").strip().upper()

        student_activities: List[Dict[str, Any]] = []
        if username:
            if scrape_missing:
                sync_res = cls.sync_student_activities(username=username, level=lvl, max_to_scrape=5)
                student_activities = sync_res["activities"]
            else:
                student_activities = cls.get_student_completed_exam_activities(username=username, level=lvl)

        by_cat: Dict[str, List[Dict[str, Any]]] = {
            "grammar": [],
            "vocabulary": [],
            "listening": [],
            "reading": [],
        }
        for act in student_activities:
            c = act.get("category")
            if c in by_cat:
                by_cat[c].append(act)

        # Se faltar alguma modalidade que o aluno ainda não concluiu no nível,
        # usa apenas atividades já salvas em scraped_activity_contents ou catálogo de Grammar..Reading do mesmo nível
        # (NUNCA Music, Flashcards, Simulations, Games ou News)
        fallback_titles_by_cat: Dict[str, List[str]] = {c: [] for c in by_cat}
        try:
            from .services import ExternalContentService
            from .grammar_data import GrammarService

            for cat in ("grammar", "vocabulary", "listening", "reading"):
                if not by_cat[cat]:
                    # Verifica se já há atividade extraída desse nível/categoria no banco
                    db_cached = list(
                        ScrapedActivityContent.objects.filter(category=cat, level__iexact=lvl)[:2]
                    )
                    if not db_cached and scrape_missing:
                        # Extrai 1 atividade de referência do nível via Playwright para garantir base real no banco
                        cat_items = ExternalContentService.get_test_english_content(lvl, cat).get("items", [])
                        if not cat_items and lvl == "C2":
                            cat_items = ExternalContentService.get_test_english_content("C1", cat).get("items", [])
                        if cat_items:
                            sample_it = cat_items[0]
                            scraped_row = cls.scrape_and_save_activity(
                                url=sample_it.get("url", ""),
                                category=cat,
                                level=lvl,
                                title=sample_it.get("title", ""),
                                slug=sample_it.get("slug", ""),
                            )
                            if scraped_row:
                                db_cached = [scraped_row]

                    for row in db_cached:
                        by_cat[cat].append({
                            "url": row.url,
                            "slug": row.slug,
                            "title": row.title,
                            "category": row.category,
                            "level": row.level,
                            "scraped": True,
                            "questions": row.questions or [],
                            "reading_text": row.reading_text or "",
                            "audio_text": row.audio_text or "",
                            "raw_content": row.raw_content or "",
                            "is_student_completed": False,
                        })

                    # Títulos do catálogo estritamente para Grammar..Reading do nível
                    te_items = ExternalContentService.get_test_english_content(lvl, cat).get("items", [])
                    for it in te_items[:5]:
                        if it.get("title"):
                            fallback_titles_by_cat[cat].append(it["title"])

            if not by_cat["grammar"] and not fallback_titles_by_cat["grammar"]:
                for t in GrammarService.get_grammar(level=lvl).get("topics", [])[:5]:
                    if t.get("title"):
                        fallback_titles_by_cat["grammar"].append(t["title"])
        except Exception as e:
            logger.debug(f"[ActivityPlaywrightScraper] Aviso ao complementar sílabo do nível {lvl}: {e}")

        # Monta o bloco estruturado em inglês para o prompt da IA
        lines: List[str] = []
        if username and student_activities:
            lines.append(
                f"STUDENT COMPLETED ACTIVITIES AT CURRENT LEVEL {lvl} "
                f"(Verified via Playwright & stored in database — ONLY Grammar, Vocabulary, Listening, and Reading; "
                f"Music, Flashcards, Simulations, Games, and News are strictly excluded):"
            )
        else:
            lines.append(
                f"LEVEL {lvl} VERIFIED ACTIVITIES IN DATABASE "
                f"(Strictly Grammar, Vocabulary, Listening, and Reading):"
            )

        titles_by_cat: Dict[str, List[str]] = {c: [] for c in by_cat}

        for cat in ("grammar", "vocabulary", "listening", "reading"):
            cat_acts = by_cat[cat]
            if not cat_acts:
                if fallback_titles_by_cat[cat]:
                    titles_by_cat[cat].extend(fallback_titles_by_cat[cat][:4])
                    lines.append(f"\n[{cat.upper()} - Level {lvl} Syllabus Topics]: {', '.join(fallback_titles_by_cat[cat][:4])}")
                continue

            lines.append(f"\n### {cat.upper()} BASE ACTIVITIES (Level {lvl}):")
            for act in cat_acts[:3]:
                origin_tag = "COMPLETED BY STUDENT" if act.get("is_student_completed") else f"LEVEL {lvl} REFERENCE"
                act_title = act.get("title") or act.get("slug") or cat
                titles_by_cat[cat].append(act_title)
                lines.append(f"- Activity ({origin_tag}): \"{act_title}\"")

                if cat == "reading" and act.get("reading_text"):
                    snippet = act["reading_text"].replace("\n", " ").strip()[:650]
                    lines.append(f"  Base Reading Text Excerpt: \"{snippet}\"")
                elif cat == "listening" and act.get("audio_text"):
                    snippet = act["audio_text"].replace("\n", " ").strip()[:650]
                    lines.append(f"  Base Listening Script/Audio Details: \"{snippet}\"")
                elif act.get("raw_content"):
                    snippet = act["raw_content"].replace("\n", " ").strip()[:350]
                    lines.append(f"  Lesson Notes: \"{snippet}\"")

                qs = act.get("questions") or []
                if qs:
                    lines.append("  Sample Verified Questions & Correct Answers from this activity:")
                    for sq in qs[:4]:
                        q_str = sq.get("question", "")
                        ans_str = sq.get("correct_answer", "")
                        opts_str = f" | Options: {sq['options']}" if sq.get("options") else ""
                        expl_str = f" | Rule/Note: {sq['explanation']}" if sq.get("explanation") else ""
                        lines.append(f"    * Q: {q_str}{opts_str} -> Correct Answer: {ans_str}{expl_str}")

        return {
            "prompt_context": "\n".join(lines),
            "titles_by_category": titles_by_cat,
            "student_completed_count": len(student_activities),
            "student_activities": student_activities,
        }
