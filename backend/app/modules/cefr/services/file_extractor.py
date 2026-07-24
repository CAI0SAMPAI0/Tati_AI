import io

import docx
import pypdf
from app.core.database import get_client


class FileExtractorService:
    @staticmethod
    def extract_text_from_pdf(bucket_name: str, file_path: str) -> str:
        """Downloads the PDF from Supabase Storage and extracts the full text."""
        client = get_client()
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
    def extract_text_from_docx(bucket_name: str, file_path: str) -> str:
        """Downloads the DOCX from Supabase Storage and extracts the full text."""
        client = get_client()
        res = client.storage.from_(bucket_name).download(file_path)

        doc = docx.Document(io.BytesIO(res))
        text = ""
        for para in doc.paragraphs:
            if para.text:
                text += para.text + "\n"

        return text

    @staticmethod
    def extract_text_from_txt(bucket_name: str, file_path: str) -> str:
        """Downloads the TXT from Supabase Storage and extracts the full text."""
        client = get_client()
        res = client.storage.from_(bucket_name).download(file_path)

        try:
            return res.decode("utf-8")
        except UnicodeDecodeError:
            return res.decode("latin-1")

    @staticmethod
    def extract_text(bucket_name: str, file_path: str, file_type: str) -> str:
        """Extracts text depending on the file format type."""
        ftype = file_type.lower().strip(".")
        if ftype == "pdf":
            return FileExtractorService.extract_text_from_pdf(bucket_name, file_path)
        elif ftype == "docx":
            return FileExtractorService.extract_text_from_docx(bucket_name, file_path)
        elif ftype in ("txt", "text"):
            return FileExtractorService.extract_text_from_txt(bucket_name, file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_type}")

    @staticmethod
    def chunk_text(text: str, max_words: int = 400, overlap: int = 50) -> list[str]:
        """
        Splits the text into smaller word-based chunks.
        Adds overlap to preserve semantic context across divisions.
        """
        words = text.split()
        chunks = []

        if not words:
            return chunks

        i = 0
        while i < len(words):
            # Take max_words
            chunk_words = words[i : i + max_words]
            chunk_text = " ".join(chunk_words)
            chunks.append(chunk_text)

            # Move forward by (max_words - overlap)
            i += max_words - overlap

        return chunks

    @staticmethod
    def process_file(bucket_name: str, file_path: str, file_type: str) -> list[str]:
        """Full pipeline: downloads, extracts, and chunks the file."""
        text = FileExtractorService.extract_text(bucket_name, file_path, file_type)
        chunks = FileExtractorService.chunk_text(text)
        return chunks
