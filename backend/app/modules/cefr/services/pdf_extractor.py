import io
import pypdf
from typing import List
from app.core.database import get_client


class PDFExtractorService:
    @staticmethod
    def extract_text_from_pdf(bucket_name: str, file_path: str) -> str:
        """Baixa o PDF do Supabase Storage e extrai o texto completo."""
        client = get_client()

        # Download the file bytes from Supabase
        res = client.storage.from_(bucket_name).download(file_path)

        # Parse PDF using pypdf
        pdf_file = io.BytesIO(res)
        reader = pypdf.PdfReader(pdf_file)

        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

        return text

    @staticmethod
    def chunk_text(
            text: str,
            max_words: int = 400,
            overlap: int = 50) -> List[str]:
        """
        Divide o texto em chunks menores baseados em palavras.
        Adicionamos um overlap para não perder o contexto entre as divisões.
        """
        words = text.split()
        chunks = []

        if not words:
            return chunks

        i = 0
        while i < len(words):
            # Take max_words
            chunk_words = words[i:i + max_words]
            chunk_text = " ".join(chunk_words)
            chunks.append(chunk_text)

            # Move forward by (max_words - overlap)
            i += (max_words - overlap)

        return chunks

    @staticmethod
    def process_pdf(bucket_name: str, file_path: str) -> List[str]:
        """Fluxo completo: baixa, extrai e divide em chunks."""
        text = PDFExtractorService.extract_text_from_pdf(
            bucket_name, file_path)
        chunks = PDFExtractorService.chunk_text(text)
        return chunks
