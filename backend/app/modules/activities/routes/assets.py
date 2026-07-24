import logging

from app.core.dependencies.auth import get_current_user
from app.core.exceptions import BusinessLogicError
from app.modules.chat.services.llm import generate_image
from app.shared.services.cloudinary_service import (
    upload_image_file,
    upload_image_from_url,
)
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

router = APIRouter()


@router.post("/ai-image")
@router.post("/admin/generate-flashcard-image")
async def flashcard_ai_image(data: dict):
    prompt = data.get("prompt")
    if not prompt:
        raise BusinessLogicError(detail="Prompt é obrigatório")

    image_url = await generate_image(prompt)
    if not image_url:
        raise HTTPException(status_code=500, detail="Falha ao gerar imagem")

    logging.info("[Assets] AI image result URL:", image_url)

    try:
        permanent_url = await run_in_threadpool(upload_image_from_url, image_url)
        if not permanent_url:
            raise HTTPException(
                status_code=500, detail="Falha ao salvar imagem no Cloudinary"
            )
        return {"url": permanent_url}
    except Exception as e:
        logging.info(f"[Assets] AI image error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar imagem: {e!s}")


@router.post("/upload-image")
async def flashcard_upload_image(
    file: UploadFile = File(...), user: dict = Depends(get_current_user)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise BusinessLogicError(detail="Arquivo deve ser uma imagem")

    try:
        logging.info(f"[Assets] Iniciando upload de arquivo: {
                file.filename} ({
                file.content_type})")
        content = await file.read()
        if len(content) == 0:
            raise BusinessLogicError(detail="Arquivo está vazio")

        url = await run_in_threadpool(upload_image_file, content, file.filename)
        if not url:
            logging.info("[Assets] Cloudinary retornou URL vazia para o upload.")
            raise HTTPException(
                status_code=500, detail="Falha ao processar imagem no servidor de mídia"
            )

        logging.info(f"[Assets] Upload concluído com sucesso: {url}")
        return {"url": url}
    except Exception as e:
        logging.info(f"[Assets] Erro crítico no upload: {e!s}")
        raise HTTPException(status_code=500, detail=f"Erro interno no upload: {e!s}")


@router.post("/upload-image-from-url")
async def flashcard_upload_image_from_url(
    data: dict, user: dict = Depends(get_current_user)
):
    image_url = data.get("url")
    if not image_url:
        raise BusinessLogicError(detail="URL é obrigatória")

    try:
        permanent_url = await run_in_threadpool(upload_image_from_url, image_url)
        if not permanent_url:
            raise HTTPException(status_code=500, detail="Falha ao salvar imagem da URL")
        return {"url": permanent_url}
    except Exception as e:
        logging.info(f"[Assets] URL upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar URL: {e!s}")
