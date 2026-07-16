import logging
import os
from typing import List, Dict, Any
from app.core.database import get_client
from langchain_huggingface import HuggingFaceEndpointEmbeddings


class EmbeddingsService:
    @staticmethod
    def get_embeddings_model():
        """Initializes and returns the HuggingFace embeddings model."""
        return HuggingFaceEndpointEmbeddings(
            model='sentence-transformers/all-MiniLM-L6-v2',
            huggingfacehub_api_token=os.getenv('HUGGING_FACE_KEY', ''),
        )

    @staticmethod
    def generate_and_save_embeddings(
            chunks: List[str], level: str, source_file: str, file_metadata: Dict[str, Any] = None) -> int:
        """
        Generates embeddings for chunks and saves them in the cefr_documents table (pgvector).
        Returns the number of successfully saved chunks.
        """
        if not chunks:
            return 0

        client = get_client()
        embeddings_model = EmbeddingsService.get_embeddings_model()

        logging.info(f"Generating embeddings for {len(chunks)} chunks of file {source_file}...")

        # Generates vectors using the HuggingFace endpoint
        vectors = embeddings_model.embed_documents(chunks)

        logging.info(f"Saving {len(vectors)} vectors to Supabase (cefr_documents)...")
        saved_count = 0

        for i, chunk in enumerate(chunks):
            data = {
                "content": chunk,
                "embedding": vectors[i],
                "level": level,
                "source_file": source_file,
                "metadata": file_metadata or {}
            }

            try:
                res = client.table('cefr_documents').insert(data).execute()
                if res.data:
                    saved_count += 1
            except Exception as e:
                logging.error(f"[EmbeddingsService] Error saving chunk {i} of file {source_file}: {e}")

        return saved_count

    @staticmethod
    def search_similar_documents(
            query: str, level: str = None, top_k: int = 3, reference_ids: List[str] = None) -> List[Dict[str, Any]]:
        """
        Searches similar chunks to a query using the match_cefr_documents RPC function.
        Supports level filtering and reference files filtering.
        """
        client = get_client()
        embeddings_model = EmbeddingsService.get_embeddings_model()

        query_embedding = embeddings_model.embed_query(query)

        # Parameters for the Supabase RPC function making similarity search
        params = {
            "query_embedding": query_embedding,
            "match_threshold": 0.5,
            "match_count": top_k
        }

        if level:
            params["filter_level"] = level

        if reference_ids:
            try:
                res = client.table("cefr_references").select("storage_url").in_("id", reference_ids).execute()
                if res.data:
                    source_files = []
                    for row in res.data:
                        url = row["storage_url"]
                        prefix = "public/cefr-materials/"
                        if prefix in url:
                            path = url.split(prefix)[-1]
                        else:
                            path = url
                        source_files.append(path)
                    
                    if source_files:
                        params["filter_source_files"] = source_files
            except Exception as ref_err:
                logging.error(f"[EmbeddingsService] Error fetching reference paths: {ref_err}")

        try:
            res = client.rpc('match_cefr_documents', params).execute()
            return res.data
        except Exception as e:
            logging.error(f"[EmbeddingsService] Error searching similarity: {e}")
            return []
