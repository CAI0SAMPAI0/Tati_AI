import logging
import re
from typing import Dict, Any, Optional
from .file_extractor import FileExtractorService
from .embeddings import EmbeddingsService


class CEFRService:
    @staticmethod
    async def classify_cefr_level(text: str) -> str:
        """
        Classifies the CEFR level (A1, A2, B1, B2, C1, C2) of a text using LLM.
        """
        if not text or not text.strip():
            return 'A1'

        words = text.split()
        sample = " ".join(words[:1500])

        prompt = f"""
        You are an expert English language assessor. Analyze the following English educational material and determine its CEFR level (A1, A2, B1, B2, C1, or C2).
        
        Guidelines:
        - A1: Very basic vocabulary and structures.
        - A2: Simple sentences and routine communication.
        - B1: Intermediate vocabulary, simple debates/explanations.
        - B2: Complex sentences, active arguments, idiomatic expressions.
        - C1: Sophisticated vocabulary, long texts, nuanced meaning.
        - C2: Fully fluent/mastery.

        Analyze this text sample:
        ---
        {sample}
        ---

        Return a JSON object with:
        1. "cefr_level": The classified level, which must be exactly one of: "A1", "A2", "B1", "B2", "C1", "C2".
        2. "explanation": A brief explanation in English.

        Return ONLY valid JSON.
        """
        try:
            from app.modules.chat.services.llm import groq_chat_json
            data = await groq_chat_json(
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=200,
                temperature=0.1,
                model='llama-3.1-8b-instant'
            )
            level = data.get('cefr_level', 'A1').upper().strip()
            if level in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']:
                return level
            return 'A1'
        except Exception as e:
            logging.error(f"[CEFR Classifier] Error classifying text: {e}")
            return 'A1'

    @staticmethod
    async def process_and_index_file(
        bucket_name: str,
        file_path: str,
        file_type: str,
        level: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> tuple[int, str]:
        """
        Orchestrates the full pipeline:
        1. Downloads the file from Supabase and extracts text (PDF/DOCX/TXT).
        2. If level is not provided, classifies using filename or LLM.
        3. Splits the text into chunks.
        4. Generates embeddings and saves to pgvector.

        Returns (chunks_indexed, cefr_level).
        """
        logging.info(f"Starting file processing for {file_path} (type: {file_type})...")

        # 1. Full text extraction
        try:
            text = FileExtractorService.extract_text(bucket_name, file_path, file_type)
        except Exception as e:
            logging.error(f"Error extracting text from {file_path}: {e}")
            raise e

        # 2. Level classification if not provided
        final_level = level
        if not final_level:
            # Try to extract from the filename
            filename = metadata.get("original_name", "") if metadata else file_path
            match = re.search(r'(?i)\b(a1|a2|b1|b2|c1|c2)\b', filename)
            if match:
                final_level = match.group(1).upper()
            else:
                match = re.search(r'(?i)(?:^|[_.\-\s])(a1|a2|b1|b2|c1|c2)(?:$|[_.\-\s])', filename)
                if match:
                    final_level = match.group(1).upper()

            # If still not found, run LLM classification
            if not final_level:
                final_level = await CEFRService.classify_cefr_level(text)

        # 3. Text chunking
        chunks = FileExtractorService.chunk_text(text)
        logging.info(f"[{final_level}] File {file_path} extracted and divided into {len(chunks)} chunks.")

        if not chunks:
            logging.info(f"[{final_level}] No text extracted from file {file_path}.")
            return 0, final_level

        # 4. Embeddings generation and indexing
        saved_count = EmbeddingsService.generate_and_save_embeddings(
            chunks=chunks,
            level=final_level,
            source_file=file_path,
            file_metadata=metadata
        )

        logging.info(f"[{final_level}] Processing complete. {saved_count} chunks indexed in the database.")
        return saved_count, final_level
