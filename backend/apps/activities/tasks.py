import os
import logging
import httpx
from django.conf import settings
from celery import shared_task
from pdf2image import convert_from_path
from .models import PremiumContent
from .secure_document_service import _RAW_IMAGE_CACHE

logger = logging.getLogger(__name__)


def sync_material_pages(content: PremiumContent, force: bool = False) -> bool:
    """
    Garante que as imagens de um material premium estejam salvas e persistidas no cache local do servidor.
    Extrai todos os links clicáveis (NotebookLM, sites, etc.) e reconverte as páginas automaticamente.
    """
    content_id = str(content.id)
    local_dir = os.path.join(settings.MEDIA_ROOT, "hub_pages", content_id)
    os.makedirs(local_dir, exist_ok=True)

    # 1. Se já tem páginas no disco local e não é forçado, carrega para memória e valida
    if not force:
        existing_pages = [
            f
            for f in os.listdir(local_dir)
            if f.startswith("page_") and f.endswith(".webp")
        ]
        if existing_pages:
            for p in existing_pages:
                full_p = os.path.join(local_dir, p)
                try:
                    with open(full_p, "rb") as f:
                        _RAW_IMAGE_CACHE[f"{content_id}/{p}"] = f.read()
                except Exception:
                    pass
            logger.info(
                f"[HubSync] Material {content.title} ({content_id}) possui {len(existing_pages)} páginas salvas em disco."
            )
            return True

    # 2. Se content_source for uma URL de arquivo (Cloudinary, Drive ou HTTP), baixa e reconverte
    source_url = content.content_source or ""
    if source_url and source_url.startswith("http"):
        try:
            logger.info(
                f"[HubSync] Baixando arquivo fonte para '{content.title}': {source_url}"
            )
            with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                resp = client.get(source_url)
                if resp.status_code == 200:
                    is_pdf = resp.content.startswith(b"%PDF")
                    if is_pdf:
                        temp_input = os.path.join(local_dir, "source_temp.pdf")
                        with open(temp_input, "wb") as f:
                            f.write(resp.content)
                        actual_pdf = temp_input
                    else:
                        temp_input = os.path.join(local_dir, "source_temp.pptx")
                        with open(temp_input, "wb") as f:
                            f.write(resp.content)
                        from .secure_document_service import _convert_to_pdf

                        converted = _convert_to_pdf(temp_input, local_dir)
                        if converted and os.path.exists(converted):
                            actual_pdf = converted
                        else:
                            logger.error(
                                f"[HubSync] Falha na conversão LibreOffice de '{temp_input}' para PDF."
                            )
                            actual_pdf = temp_input

                    # Extrai links clicáveis diretamente do PDF (PyMuPDF)
                    from .secure_document_service import extract_links_from_pdf

                    extracted_links = extract_links_from_pdf(actual_pdf)
                    logger.info(
                        f"[HubSync] Extraídos {len(extracted_links)} links clicáveis de '{content.title}'."
                    )

                    poppler = os.getenv("POPPLER_PATH")
                    pages = convert_from_path(actual_pdf, 200, poppler_path=poppler)
                    storage_paths = []
                    for i, page in enumerate(pages):
                        img_name = f"page_{i + 1}.webp"
                        img_path = os.path.join(local_dir, img_name)
                        page.save(img_path, "WEBP", quality=80)
                        storage_paths.append(f"{content_id}/{img_name}")
                        with open(img_path, "rb") as f:
                            _RAW_IMAGE_CACHE[f"{content_id}/{img_name}"] = f.read()

                    try:
                        if os.path.exists(temp_input):
                            os.remove(temp_input)
                        if actual_pdf != temp_input and os.path.exists(actual_pdf):
                            os.remove(actual_pdf)
                    except OSError:
                        pass

                    # Se encontrou links clicáveis, salva no final do array de páginas
                    if extracted_links:
                        import json

                        storage_paths.append(
                            json.dumps({"external_links": extracted_links})
                        )

                    # Atualiza secure_pages no banco
                    content.processing_status = "ready"
                    content.is_secure = True
                    content.thumbnail_url = f"{content_id}/page_1.webp"
                    try:
                        from django.db import connection
                        import json

                        with connection.cursor() as cursor:
                            cursor.execute(
                                "UPDATE premium_content SET secure_pages = %s, processing_status = 'ready', is_secure = true, thumbnail_url = %s WHERE id = %s",
                                [
                                    json.dumps(storage_paths),
                                    content.thumbnail_url,
                                    content_id,
                                ],
                            )
                    except Exception as db_err:
                        logger.warning(
                            f"[HubSync] Erro ao atualizar DB para {content.title}: {db_err}"
                        )

                    try:
                        from app.shared.services.upstash import upstash_service

                        if (
                            upstash_service._ensure_connected()
                            and upstash_service._redis
                        ):
                            upstash_service._redis.delete("catalog:public_list")
                            upstash_service._redis.delete("hub:active_contents")
                    except Exception:
                        pass

                    logger.info(
                        f"[HubSync] Material '{content.title}' reconvertido com sucesso! {len(storage_paths)} páginas e {len(extracted_links)} links salvos."
                    )
                    return True
        except Exception as e:
            logger.warning(
                f"[HubSync] Erro ao sincronizar a partir do content_source ({source_url}): {e}"
            )

    # 3. Tenta baixar do Supabase caso esteja acessível
    try:
        from .secure_document_service import get_client

        db = get_client()
        raw_pages = getattr(content, "secure_pages", None) or []
        for storage_path in raw_pages:
            if isinstance(storage_path, str) and storage_path.endswith(".webp"):
                filename = os.path.basename(storage_path)
                dest = os.path.join(local_dir, filename)
                if not os.path.exists(dest):
                    data = db.storage.from_("hub-secure-pages").download(storage_path)
                    if data:
                        with open(dest, "wb") as f:
                            f.write(data)
                        _RAW_IMAGE_CACHE[storage_path] = data
        return True
    except Exception as e:
        logger.warning(f"[HubSync] Supabase download falhou para {content.title}: {e}")

    finally:
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

