import os
import logging
import httpx
from django.conf import settings
from celery import shared_task
from pdf2image import convert_from_path
from .models import PremiumContent
from .secure_document_service import _RAW_IMAGE_CACHE

logger = logging.getLogger(__name__)


def sync_material_pages(content: PremiumContent) -> bool:
    """
    Garante que as imagens de um material premium estejam salvas e persistidas no cache local do servidor.
    Se o Supabase falhar (ex: 402 Payment Required), baixa a partir do content_source (Cloudinary/Drive)
    e reconverte as páginas automaticamente para que nunca sumam do Hub.
    """
    content_id = str(content.id)
    local_dir = os.path.join(settings.MEDIA_ROOT, "hub_pages", content_id)
    os.makedirs(local_dir, exist_ok=True)

    # 1. Se já tem páginas no disco local, carrega para memória e valida
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
            with httpx.Client(timeout=45.0, follow_redirects=True) as client:
                resp = client.get(source_url)
                if resp.status_code == 200:
                    ext = (
                        os.path.splitext(source_url.split("?")[0])[1].lower() or ".pdf"
                    )
                    temp_input = os.path.join(local_dir, f"source_temp{ext}")
                    with open(temp_input, "wb") as f:
                        f.write(resp.content)

                    actual_pdf = temp_input
                    if not ext.endswith(".pdf"):
                        from .secure_document_service import _convert_to_pdf

                        converted = _convert_to_pdf(temp_input, local_dir)
                        if converted and os.path.exists(converted):
                            actual_pdf = converted

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

                    # Atualiza secure_pages no banco
                    content.processing_status = "ready"
                    content.is_secure = True
                    try:
                        from django.db import connection
                        import json

                        with connection.cursor() as cursor:
                            cursor.execute(
                                "UPDATE premium_content SET secure_pages = %s, processing_status = 'ready', is_secure = true WHERE id = %s",
                                [json.dumps(storage_paths), content_id],
                            )
                    except Exception as db_err:
                        logger.warning(
                            f"[HubSync] Erro ao atualizar DB para {content.title}: {db_err}"
                        )

                    logger.info(
                        f"[HubSync] Material '{content.title}' reconvertido com sucesso! {len(storage_paths)} páginas salvas em disco."
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

    return False


@shared_task(name="apps.activities.tasks.sync_hub_materials_task")
def sync_hub_materials_task():
    """
    Tarefa periódica que verifica e sincroniza todos os materiais premium do Hub.
    """
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
