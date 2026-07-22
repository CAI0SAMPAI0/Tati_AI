import logging
import os
from typing import List, Dict, Any
from functools import lru_cache
from app.core.database import get_client
from langchain_huggingface import HuggingFaceEndpointEmbeddings, HuggingFaceEmbeddings

logger = logging.getLogger(__name__)

EMBEDDINGS_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'


@lru_cache(maxsize=1)
def _local_embeddings_model():
    return HuggingFaceEmbeddings(model_name=EMBEDDINGS_MODEL)


@lru_cache(maxsize=1)
def _remote_embeddings_model():
    return HuggingFaceEndpointEmbeddings(
        model=EMBEDDINGS_MODEL,
        huggingfacehub_api_token=os.getenv('HUGGING_FACE_KEY', ''),
    )


class EmbeddingsService:
    @staticmethod
    def get_embeddings_model():
        """Returns the embeddings model.

        Uses the LOCAL sentence-transformers model by default (reliable, no
        network/auth dependency). The remote HF Inference endpoint is only
        used when HUGGING_FACE_PREFER_REMOTE='true' is set, with automatic
        fallback to local on any failure.
        """
        prefer_remote = os.getenv('HUGGING_FACE_PREFER_REMOTE', '').lower() == 'true'
        if prefer_remote:
            logger.info("[EmbeddingsService] Using remote HF endpoint (prefer_remote=true).")
            return _remote_embeddings_model()
        return _local_embeddings_model()

    @staticmethod
    def _embed_documents_safe(texts: List[str]) -> List[List[float]]:
        """Embeds documents with fallback to local model on remote failure."""
        try:
            return EmbeddingsService.get_embeddings_model().embed_documents(texts)
        except Exception as e:
            logger.error(
                "[EmbeddingsService] Primary embeddings failed (%s). "
                "Falling back to local embeddings model.", e
            )
            return _local_embeddings_model().embed_documents(texts)

    @staticmethod
    def _embed_query_safe(query: str) -> List[float]:
        """Embeds query with fallback to local model on remote failure."""
        try:
            return EmbeddingsService.get_embeddings_model().embed_query(query)
        except Exception as e:
            logger.error(
                "[EmbeddingsService] Primary embeddings failed (%s). "
                "Falling back to local embeddings model.", e
            )
            return _local_embeddings_model().embed_query(query)

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

        logging.info(f"Generating embeddings for {len(chunks)} chunks of file {source_file}...")

        # Generates vectors using the HuggingFace endpoint (with local fallback on auth failure)
        vectors = EmbeddingsService._embed_documents_safe(chunks)

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

        query_embedding = EmbeddingsService._embed_query_safe(query)

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
