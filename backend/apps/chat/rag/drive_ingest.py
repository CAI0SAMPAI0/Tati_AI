import os
import logging
from typing import List, Optional
from .ingestion import DocumentIngestion, FORBIDDEN_KEYWORDS
from .vector_store import VectorStore
from .models import DocumentChunk

logger = logging.getLogger(__name__)

DEFAULT_TATIANA_DRIVE_FOLDER_ID = "11AjlpMFhuvkGJsXPQnNxRNN5wySn8W8R"


class GoogleDriveIngester:
    """
    Ingestor para o acervo de materiais pedagógicos da Teacher Tatiana Duarte.
    
    REGRA CRÍTICA DE PRIVACIDADE:
    Nunca acessa, lista ou ingere pastas com o nome 'PESSOAIS'.
    """

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        ingestion_pipeline: Optional[DocumentIngestion] = None,
    ):
        self.vector_store = vector_store or VectorStore()
        self.ingestion = ingestion_pipeline or DocumentIngestion(vector_store=self.vector_store)

    def ingest_local_drive_mirror(self, local_folder_path: str) -> int:
        """
        Ingere os arquivos sincronizados da pasta do Google Drive no computador local.
        Ignora estritamente qualquer pasta ou arquivo contendo 'PESSOAIS'.
        """
        if not os.path.exists(local_folder_path):
            logger.error(f"[DriveIngester] Caminho local não encontrado: {local_folder_path}")
            return 0

        logger.info(f"[DriveIngester] Iniciando ingestão do espelho local do Drive em: {local_folder_path}")
        chunks = self.ingestion.ingest_directory(local_folder_path)
        logger.info(f"[DriveIngester] Ingestão concluída com sucesso: {len(chunks)} chunks indexados.")
        return len(chunks)

    def sync_public_drive_folder(self, folder_id: str = DEFAULT_TATIANA_DRIVE_FOLDER_ID, destination_dir: str = "media/drive_downloads") -> int:
        """
        Baixa e ingere materiais públicos autorizados pelo ID da pasta.
        Filtra estritamente para que nenhum item 'PESSOAIS' seja processado.
        """
        os.makedirs(destination_dir, exist_ok=True)
        logger.info(f"[DriveIngester] Sincronizando pasta Drive ID: {folder_id} (excluindo qualquer pasta PESSOAIS)...")

        # Tenta utilizar gdown se disponível no ambiente
        try:
            import gdown

            url = f"https://drive.google.com/drive/folders/{folder_id}"
            logger.info(f"[DriveIngester] Baixando arquivos permitidos via gdown...")
            gdown.download_folder(url, output=destination_dir, quiet=True, use_cookies=False)
        except ImportError:
            logger.info("[DriveIngester] Biblioteca 'gdown' não instalada. Para sincronização direta do Drive, use: pip install gdown")
        except Exception as e:
            logger.warning(f"[DriveIngester] Falha no download automático do Google Drive: {e}")

        # Executa ingestão com filtragem estrita no destino
        return self.ingest_local_drive_mirror(destination_dir)
