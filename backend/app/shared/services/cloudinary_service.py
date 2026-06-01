import logging
import cloudinary
import cloudinary.uploader
from app.core.config import settings

# Configura o Cloudinary com as chaves do .env
if settings.cloudinary_cloud_name:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


def upload_profile_image(file_bytes: bytes, username: str) -> str:
    """
    Faz upload de uma imagem para o Cloudinary e retorna a URL segura.
    Substitui a imagem antiga se o username for o mesmo (public_id).
    """
    try:
        if not settings.cloudinary_cloud_name:
            logging.info('[Cloudinary] Configuração ausente!')
            return ''

        result = cloudinary.uploader.upload(
            file_bytes,
            public_id=f'tati_ai/profiles/{username}',
            overwrite=True,
            folder='tati_ai/profiles',
            transformation=[
                {'width': 400, 'height': 400, 'crop': 'fill', 'gravity': 'face'}
            ],
        )
        return result.get('secure_url', '')
    except Exception as e:
        logging.info(f'[Cloudinary] Erro no upload: {e}')
        return ''


def upload_audio_to_cloudinary(
    file_bytes: bytes, conversation_id: str, message_id: str
) -> str:
    """
    Faz upload de áudio para o Cloudinary e retorna a URL segura.
    """
    try:
        if not settings.cloudinary_cloud_name:
            logging.info('[Cloudinary] Configuração ausente!')
            return ''

        result = cloudinary.uploader.upload(
            file_bytes,
            public_id=f'tati_ai/audio/{conversation_id}/{message_id}',
            resource_type='video',  # Cloudinary usa 'video' para áudio
            folder='tati_ai/audio',
            overwrite=True,
        )
        return result.get('secure_url', '')
    except Exception as e:
        logging.info(f'[Cloudinary] Erro no upload de áudio: {e}')
        return ''


def upload_image_from_url(
        url: str,
        folder: str = 'tati_ai/flashcards') -> str:
    """
    Faz upload de uma imagem a partir de uma URL para o Cloudinary.
    """
    try:
        if not settings.cloudinary_cloud_name:
            logging.info('[Cloudinary] Configuração ausente!')
            return url  # Fallback para a URL original

        result = cloudinary.uploader.upload(
            url,
            folder=folder,
            overwrite=True,
        )
        return result.get('secure_url', '')
    except Exception as e:
        logging.info(f'[Cloudinary] Erro no upload por URL: {e}')
        return url


def upload_image_file(
        file_bytes: bytes,
        filename: str,
        folder: str = 'tati_ai/flashcards') -> str:
    """
    Faz upload de uma imagem (bytes) para o Cloudinary.
    """
    try:
        if not settings.cloudinary_cloud_name:
            logging.info('[Cloudinary] Configuração ausente!')
            return ''

        result = cloudinary.uploader.upload(
            file_bytes,
            folder=folder,
            overwrite=True,
            resource_type='image'
        )
        return result.get('secure_url', '')
    except Exception as e:
        logging.info(f'[Cloudinary] Erro no upload de arquivo: {e}')
        return ''
