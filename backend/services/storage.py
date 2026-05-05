import base64
import uuid
from services.database import get_client


def upload_audio_to_storage(audio_b64: str, username: str) -> str:
    """
    Sobe áudio em base64 para o Supabase Storage e retorna a URL pública.
    Isso economiza MUITO Egress no banco de dados.
    """
    if not audio_b64:
        return ''

    try:
        db = get_client()
        # Decodifica base64 para bytes
        if 'base64,' in audio_b64:
            audio_b64 = audio_b64.split('base64,')[1]

        file_bytes = base64.b64decode(audio_b64)

        # Gera nome único para o arquivo
        file_name = f'{username}/{uuid.uuid4()}.webm'

        # Sobe para o bucket 'audio_messages'
        storage = db.storage.from_('audio_messages')
        storage.upload(
            path=file_name, file=file_bytes, file_options={'content-type': 'audio/webm'}
        )

        # Pega a URL pública
        url = storage.get_public_url(file_name)
        return url
    except Exception as e:
        print(f'[Storage] Erro ao subir áudio: {e}')
        return ''
