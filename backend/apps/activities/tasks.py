import os
import re
import json
import shutil
import logging
import tempfile
import threading
import time
import httpx
from django.conf import settings
from celery import shared_task
from pdf2image import convert_from_path
from .models import PremiumContent
from .secure_document_service import _RAW_IMAGE_CACHE

logger = logging.getLogger(__name__)

# Um único sync por material: requisições simultâneas das páginas aguardam o sync em andamento
# em vez de dispararem várias conversões LibreOffice sobre o mesmo arquivo.
_SYNC_LOCKS: dict[str, threading.Lock] = {}
_SYNC_LOCKS_GUARD = threading.Lock()
# Evita martelar o LibreOffice quando um material acabou de falhar (as N páginas em espera
# recebem a falha imediatamente e o frontend re-tenta depois).
_LAST_SYNC_FAILURE: dict[str, float] = {}
SYNC_FAILURE_COOLDOWN = 45.0
SYNC_WAIT_TIMEOUT = 240.0

_PAGE_RE = re.compile(r"^page_(\d+)\.webp$")


def _get_sync_lock(content_id: str) -> threading.Lock:
    with _SYNC_LOCKS_GUARD:
        lock = _SYNC_LOCKS.get(content_id)
        if lock is None:
            lock = threading.Lock()
            _SYNC_LOCKS[content_id] = lock
        return lock


def is_sync_running(content_id: str) -> bool:
    lock = _SYNC_LOCKS.get(str(content_id))
    return bool(lock and lock.locked())


def _list_local_pages(local_dir: str) -> list[str]:
    """Lista page_N.webp (não vazias) ordenadas pelo número da página."""
    try:
        files = []
        for f in os.listdir(local_dir):
            m = _PAGE_RE.match(f)
            if m and os.path.getsize(os.path.join(local_dir, f)) > 0:
                files.append((int(m.group(1)), f))
        return [f for _, f in sorted(files)]
    except OSError:
        return []


def _load_pages_into_cache(content_id: str, local_dir: str, pages: list[str]) -> None:
    for p in pages:
        try:
            with open(os.path.join(local_dir, p), "rb") as f:
                _RAW_IMAGE_CACHE[f"{content_id}/{p}"] = f.read()
        except OSError:
            pass


def _invalidate_catalog_cache() -> None:
    try:
        from app.shared.services.upstash import upstash_service

        if upstash_service._ensure_connected() and upstash_service._redis:
            upstash_service._redis.delete("catalog:public_list")
            upstash_service._redis.delete("hub:active_contents")
    except Exception:
        pass


def _sync_from_source(content: PremiumContent, content_id: str, local_dir: str) -> bool:
    """
    Baixa o arquivo fonte (Cloudinary/Drive/HTTP), converte para PDF se necessário e gera as
    páginas WEBP. Todo o trabalho ocorre em diretório temporário isolado; somente páginas
    válidas são publicadas em `local_dir` (nunca deixa o material em estado parcial/quebrado).
    """
    source_url = content.content_source or ""
    if not source_url.startswith("http"):
        return False

    from .secure_document_service import (
        _convert_to_pdf,
        detect_document_extension,
        extract_links_from_pdf,
    )

    work_dir = tempfile.mkdtemp(prefix="hubsync_")
    try:
        logger.info(f"[HubSync] Baixando arquivo fonte para '{content.title}': {source_url}")
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            resp = client.get(source_url)
        if resp.status_code != 200 or not resp.content:
            logger.warning(
                f"[HubSync] Download do arquivo fonte de '{content.title}' falhou (HTTP {resp.status_code})."
            )
            return False

        ext = detect_document_extension(resp.content, source_url)
        temp_input = os.path.join(work_dir, f"source{ext}")
        with open(temp_input, "wb") as f:
            f.write(resp.content)

        if ext == ".pdf":
            actual_pdf = temp_input
        else:
            actual_pdf = _convert_to_pdf(temp_input, work_dir)
            if not actual_pdf or not os.path.exists(actual_pdf):
                logger.error(
                    f"[HubSync] Falha na conversão LibreOffice de '{content.title}' ({ext}) para PDF."
                )
                return False

        # Extrai links clicáveis diretamente do PDF (PyMuPDF)
        extracted_links = extract_links_from_pdf(actual_pdf)
        logger.info(
            f"[HubSync] Extraídos {len(extracted_links)} links clicáveis de '{content.title}'."
        )

        poppler = os.getenv("POPPLER_PATH")
        pages = convert_from_path(actual_pdf, 200, poppler_path=poppler)
        if not pages:
            logger.error(f"[HubSync] PDF de '{content.title}' não gerou nenhuma página.")
            return False

        pages_dir = os.path.join(work_dir, "pages")
        os.makedirs(pages_dir, exist_ok=True)
        new_files: list[str] = []
        for i, page in enumerate(pages):
            img_name = f"page_{i + 1}.webp"
            page.save(os.path.join(pages_dir, img_name), "WEBP", quality=80)
            new_files.append(img_name)
        del pages

        # Publica as páginas novas (substituição atômica arquivo a arquivo)
        os.makedirs(local_dir, exist_ok=True)
        for old in _list_local_pages(local_dir):
            if old not in new_files:
                try:
                    os.remove(os.path.join(local_dir, old))
                except OSError:
                    pass
                _RAW_IMAGE_CACHE.pop(f"{content_id}/{old}", None)

        storage_paths = []
        for img_name in new_files:
            dest = os.path.join(local_dir, img_name)
            os.replace(os.path.join(pages_dir, img_name), dest)
            storage_paths.append(f"{content_id}/{img_name}")
            with open(dest, "rb") as f:
                _RAW_IMAGE_CACHE[f"{content_id}/{img_name}"] = f.read()

        # Se encontrou links clicáveis, salva no final do array de páginas
        if extracted_links:
            storage_paths.append(json.dumps({"external_links": extracted_links}))

        # Atualiza secure_pages no banco
        content.processing_status = "ready"
        content.is_secure = True
        content.thumbnail_url = f"{content_id}/page_1.webp"
        try:
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE premium_content SET secure_pages = %s, processing_status = 'ready', is_secure = true, thumbnail_url = %s WHERE id = %s",
                    [json.dumps(storage_paths), content.thumbnail_url, content_id],
                )
        except Exception as db_err:
            logger.warning(f"[HubSync] Erro ao atualizar DB para {content.title}: {db_err}")

        _invalidate_catalog_cache()

        logger.info(
            f"[HubSync] Material '{content.title}' reconvertido com sucesso! "
            f"{len(new_files)} páginas e {len(extracted_links)} links salvos."
        )
        return True
    except Exception as e:
        logger.warning(
            f"[HubSync] Erro ao sincronizar a partir do content_source ({source_url}): {e}"
        )
        return False
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def _sync_from_supabase(content: PremiumContent, content_id: str, local_dir: str) -> bool:
    """Restaura páginas já geradas do Supabase Storage (quando acessível)."""
    from .secure_document_service import safe_download_supabase_storage

    raw_pages = getattr(content, "secure_pages", None) or []
    if isinstance(raw_pages, str):
        try:
            raw_pages = json.loads(raw_pages)
        except Exception:
            raw_pages = []

    for storage_path in raw_pages:
        if not (isinstance(storage_path, str) and storage_path.endswith(".webp")):
            continue
        filename = os.path.basename(storage_path)
        dest = os.path.join(local_dir, filename)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            continue
        data = safe_download_supabase_storage(
            bucket="hub-secure-pages", path=storage_path, is_private=True, timeout=12.0
        )
        if not data:
            # Supabase indisponível (402/404/...): não adianta tentar as demais páginas
            break
        with open(dest, "wb") as f:
            f.write(data)
        _RAW_IMAGE_CACHE[storage_path] = data

    return bool(_list_local_pages(local_dir))


def sync_material_pages(
    content: PremiumContent,
    force: bool = False,
    wait_timeout: float = SYNC_WAIT_TIMEOUT,
) -> bool:
    """
    Garante que as imagens de um material premium estejam salvas e persistidas no cache local do servidor.
    Extrai todos os links clicáveis (NotebookLM, sites, etc.) e reconverte as páginas automaticamente.

    Retorna True somente se, ao final, existirem páginas reais em disco.
    Chamadas concorrentes para o mesmo material aguardam o sync em andamento (lock por material).
    """
    content_id = str(content.id)
    local_dir = os.path.join(settings.MEDIA_ROOT, "hub_pages", content_id)
    os.makedirs(local_dir, exist_ok=True)

    def _pages_ready() -> bool:
        existing = _list_local_pages(local_dir)
        if existing:
            _load_pages_into_cache(content_id, local_dir, existing)
            logger.info(
                f"[HubSync] Material {content.title} ({content_id}) possui {len(existing)} páginas salvas em disco."
            )
            return True
        return False

    def _in_cooldown() -> bool:
        last_fail = _LAST_SYNC_FAILURE.get(content_id)
        return bool(last_fail and (time.time() - last_fail) < SYNC_FAILURE_COOLDOWN)

    # 1. Se já tem páginas no disco local e não é forçado, carrega para memória e valida
    if not force and _pages_ready():
        return True
    if not force and _in_cooldown():
        logger.info(
            f"[HubSync] Sync de '{content.title}' falhou recentemente; aguardando cooldown antes de nova tentativa."
        )
        return False

    lock = _get_sync_lock(content_id)
    if not lock.acquire(timeout=wait_timeout):
        logger.warning(
            f"[HubSync] Timeout aguardando sync em andamento de '{content.title}' ({content_id})."
        )
        return bool(_list_local_pages(local_dir))

    try:
        # Outra thread pode ter concluído (ou falhado) enquanto aguardávamos o lock
        if not force:
            if _pages_ready():
                return True
            if _in_cooldown():
                return False

        # 2. Reconverte a partir do arquivo fonte (Cloudinary, Drive ou HTTP)
        if _sync_from_source(content, content_id, local_dir):
            _LAST_SYNC_FAILURE.pop(content_id, None)
            return True

        # 3. Tenta baixar do Supabase caso esteja acessível
        try:
            if _sync_from_supabase(content, content_id, local_dir):
                _LAST_SYNC_FAILURE.pop(content_id, None)
                return True
        except Exception as e:
            logger.warning(f"[HubSync] Supabase download falhou para {content.title}: {e}")

        # Páginas antigas ainda válidas em disco (ex.: sync forçado que falhou)
        if _list_local_pages(local_dir):
            return True

        _LAST_SYNC_FAILURE[content_id] = time.time()
        logger.error(
            f"[HubSync] Não foi possível gerar as páginas de '{content.title}' ({content_id})."
        )
        return False
    finally:
        lock.release()
        try:
            from django.db import close_old_connections

            close_old_connections()
        except Exception:
            pass


@shared_task(name="apps.activities.tasks.sync_hub_materials_task")
def sync_hub_materials_task():
    """
    Tarefa periódica que verifica e sincroniza todos os materiais premium do Hub.
    """
    try:
        logger.info("[HubSync] Iniciando sincronização periódica dos materiais do Hub...")
        materials = PremiumContent.objects.filter(is_active=True)
        count = 0
        for m in materials:
            if sync_material_pages(m):
                count += 1
        logger.info(
            f"[HubSync] Sincronização concluída: {count}/{materials.count()} materiais persistidos localmente."
        )
        return {"total": materials.count(), "synced": count}
    finally:
        try:
            from django.db import close_old_connections
            close_old_connections()
        except Exception:
            pass


@shared_task(name="apps.activities.tasks.run_cefr_schedules_task")
def run_cefr_schedules_task():
    """
    Tarefa periódica que checa e executa os agendamentos ativos de geração de materiais CEFR.
    """
    try:
        from .generator import CEFRGeneratorService
        logger.info("[CEFR Scheduler] Executando verificação periódica de agendamentos...")
        res = CEFRGeneratorService.check_and_run_schedules(force=False)
        return res
    except Exception as e:
        logger.error(f"[CEFR Scheduler] Erro ao executar agendamentos CEFR: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
    finally:
        try:
            from django.db import close_old_connections
            close_old_connections()
        except Exception:
            pass

