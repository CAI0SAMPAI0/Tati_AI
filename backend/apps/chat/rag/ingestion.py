import os
import re
import logging
from typing import List, Optional
from .models import DocumentChunk
from .chunking import SmartChunker

logger = logging.getLogger(__name__)

# Diretórios e pastas proibidas para proteção estrita de privacidade
FORBIDDEN_KEYWORDS = ["PESSOAIS", "pessoais", "Personal", "personal", "privado", "private"]


class DocumentIngestion:
    """
    Pipeline de Ingestão e Normalização de Documentos para o RAG da Teacher Tatiana.
    Suporta:
    - PDFs (via PyMuPDF / fitz ou fallback textual).
    - Apresentações PowerPoint (.pptx).
    - Documentos Markdown (.md) e Texto plano (.txt).
    - Conector para a pasta do Google Drive da Tatiana.
    
    REGRA DE SEGURANÇA E PRIVACIDADE INVIOLÁVEL:
    Nunca acessa ou ingere pastas com o nome 'PESSOAIS'.
    """

    def __init__(self, chunker: Optional[SmartChunker] = None, vector_store: Optional[Any] = None):
        self.chunker = chunker or SmartChunker()
        self.vector_store = vector_store

    @staticmethod
    def is_forbidden_path(path_or_name: str) -> bool:
        """Verifica se o caminho ou nome de pasta contém termos proibidos como 'PESSOAIS'."""
        upper = path_or_name.upper()
        return any(f.upper() in upper for f in FORBIDDEN_KEYWORDS)

    def extract_from_pdf(self, file_path: str, title: Optional[str] = None) -> List[DocumentChunk]:
        """Extrai texto e metadados de arquivo PDF página a página."""
        if self.is_forbidden_path(file_path):
            logger.warning(f"[RAG Ingestion] Arquivo ignorado por regra de privacidade: {file_path}")
            return []

        doc_title = title or os.path.splitext(os.path.basename(file_path))[0]
        chunks: List[DocumentChunk] = []

        try:
            import fitz  # PyMuPDF

            with fitz.open(file_path) as doc:
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    text = page.get_text("text").strip()
                    if len(text) > 40:
                        page_chunks = self.chunker.split_text(
                            text=text,
                            source=file_path,
                            title=doc_title,
                            doc_type="pdf",
                            page=page_num + 1,
                        )
                        chunks.extend(page_chunks)
            logger.info(f"[RAG Ingestion] PDF '{doc_title}' processado: {len(chunks)} chunks gerados.")
        except Exception as e:
            logger.warning(f"[RAG Ingestion] PyMuPDF falhou para '{file_path}': {e}. Tentando pypdf...")
            try:
                from pypdf import PdfReader

                reader = PdfReader(file_path)
                for idx, page in enumerate(reader.pages):
                    text = (page.extract_text() or "").strip()
                    if len(text) > 40:
                        chunks.extend(
                            self.chunker.split_text(
                                text=text,
                                source=file_path,
                                title=doc_title,
                                doc_type="pdf",
                                page=idx + 1,
                            )
                        )
            except Exception as e2:
                logger.error(f"[RAG Ingestion] Erro ao extrair PDF {file_path}: {e2}")

        return chunks

    def extract_from_markdown_or_txt(self, file_path: str, title: Optional[str] = None) -> List[DocumentChunk]:
        """Extrai texto de arquivos Markdown e texto plano."""
        if self.is_forbidden_path(file_path):
            return []

        doc_title = title or os.path.splitext(os.path.basename(file_path))[0]
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            return self.chunker.split_text(
                text=content,
                source=file_path,
                title=doc_title,
                doc_type="markdown" if file_path.endswith(".md") else "txt",
                page=1,
            )
        except Exception as e:
            logger.error(f"[RAG Ingestion] Erro ao ler arquivo de texto {file_path}: {e}")
            return []

    def extract_from_pptx(self, file_path: str, title: Optional[str] = None) -> List[DocumentChunk]:
        """Extrai texto de apresentações PowerPoint (.pptx)."""
        if self.is_forbidden_path(file_path):
            return []

        doc_title = title or os.path.splitext(os.path.basename(file_path))[0]
        chunks: List[DocumentChunk] = []

        try:
            from pptx import Presentation

            prs = Presentation(file_path)
            for idx, slide in enumerate(prs.slides):
                slide_texts = []
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_texts.append(shape.text.strip())
                full_slide = "\n".join(slide_texts)
                if len(full_slide) > 20:
                    chunks.extend(
                        self.chunker.split_text(
                            text=full_slide,
                            source=file_path,
                            title=doc_title,
                            doc_type="pptx",
                            page=idx + 1,
                        )
                    )
            logger.info(f"[RAG Ingestion] PPTX '{doc_title}' processado: {len(chunks)} chunks gerados.")
        except ImportError:
            logger.warning("[RAG Ingestion] python-pptx não instalado. Pulando extração de slides.")
        except Exception as e:
            logger.error(f"[RAG Ingestion] Erro ao processar PPTX {file_path}: {e}")

        return chunks

    def ingest_file(self, file_path: str, title: Optional[str] = None) -> List[DocumentChunk]:
        """Ingere um único arquivo (PDF, MD, TXT, PPTX) e opcionalmente adiciona ao vector_store."""
        if self.is_forbidden_path(file_path) or not os.path.exists(file_path):
            return []

        ext = os.path.splitext(file_path)[1].lower()
        chunks: List[DocumentChunk] = []
        if ext == ".pdf":
            chunks = self.extract_from_pdf(file_path, title=title)
        elif ext in (".md", ".txt"):
            chunks = self.extract_from_markdown_or_txt(file_path, title=title)
        elif ext in (".pptx", ".ppt"):
            chunks = self.extract_from_pptx(file_path, title=title)

        if self.vector_store and chunks:
            self.vector_store.add_chunks(chunks)

        return chunks

    def ingest_directory(self, directory_path: str) -> List[DocumentChunk]:
        """
        Varre recursivamente um diretório de arquivos e gera chunks normalizados.
        Garante que nenhuma pasta ou subpasta com nome 'PESSOAIS' seja processada.
        """
        if not os.path.exists(directory_path):
            logger.warning(f"[RAG Ingestion] Diretório não encontrado: {directory_path}")
            return []

        all_chunks: List[DocumentChunk] = []

        for root, dirs, files in os.walk(directory_path):
            # Filtro estrito: remove pastas 'PESSOAIS' da varredura em tempo de execução
            dirs[:] = [d for d in dirs if not self.is_forbidden_path(d)]

            for file in files:
                file_path = os.path.join(root, file)
                if self.is_forbidden_path(file_path):
                    continue

                ext = os.path.splitext(file)[1].lower()
                if ext == ".pdf":
                    all_chunks.extend(self.extract_from_pdf(file_path))
                elif ext in (".md", ".txt"):
                    all_chunks.extend(self.extract_from_markdown_or_txt(file_path))
                elif ext in (".pptx", ".ppt"):
                    all_chunks.extend(self.extract_from_pptx(file_path))

        if self.vector_store and all_chunks:
            self.vector_store.add_chunks(all_chunks)

        logger.info(
            f"[RAG Ingestion] Ingestão concluída para {directory_path}: total de {len(all_chunks)} chunks gerados."
        )
        return all_chunks

