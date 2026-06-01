import logging
from typing import Dict, Any
from .pdf_extractor import PDFExtractorService
from .embeddings import EmbeddingsService


class CEFRService:
    @staticmethod
    def process_and_index_pdf(bucket_name: str,
                              file_path: str,
                              level: str,
                              metadata: Dict[str,
                                             Any] = None) -> int:
        """
        Orquestra o pipeline completo:
        1. Baixa o PDF do Supabase e extrai o texto.
        2. Divide em chunks.
        3. Gera embeddings e salva no pgvector.

        Retorna a quantidade de chunks salvos com sucesso.
        """
        logging.info(
            f"[{level}] Iniciando processamento do arquivo {file_path}...")

        # 1. Extração e divisão
        chunks = PDFExtractorService.process_pdf(bucket_name, file_path)
        logging.info(
            f"[{level}] Arquivo {file_path} extraído e dividido em {len(chunks)} chunks.")

        if not chunks:
            logging.info(
                f"[{level}] Nenhum texto extraído do arquivo {file_path}.")
            return 0

        # 2. Embeddings e Indexação
        saved_count = EmbeddingsService.generate_and_save_embeddings(
            chunks=chunks,
            level=level,
            source_file=file_path,
            file_metadata=metadata
        )

        logging.info(
            f"[{level}] Processamento concluído. {saved_count} chunks indexados no banco de dados.")
        return saved_count
