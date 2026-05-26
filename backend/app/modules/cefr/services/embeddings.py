import os
from typing import List, Dict, Any
from app.core.database import get_client
from langchain_huggingface import HuggingFaceEndpointEmbeddings

class EmbeddingsService:
    @staticmethod
    def get_embeddings_model():
        """Inicializa e retorna o modelo de embeddings do HuggingFace."""
        return HuggingFaceEndpointEmbeddings(
            model='sentence-transformers/all-MiniLM-L6-v2',
            huggingfacehub_api_token=os.getenv('HUGGING_FACE_KEY', ''),
        )
        
    @staticmethod
    def generate_and_save_embeddings(chunks: List[str], level: str, source_file: str, file_metadata: Dict[str, Any] = None) -> int:
        """
        Gera embeddings para os chunks e salva na tabela cefr_documents no Supabase (pgvector).
        Retorna o número de chunks salvos com sucesso.
        """
        if not chunks:
            return 0
            
        client = get_client()
        embeddings_model = EmbeddingsService.get_embeddings_model()
        
        print(f"Gerando embeddings para {len(chunks)} chunks do arquivo {source_file}...")
        
        # Gera os vetores usando o endpoint do HuggingFace
        # O langchain_huggingface cuida do batching se necessário, mas para chunks pequenos geralmente é tranquilo
        vectors = embeddings_model.embed_documents(chunks)
        
        print(f"Salvando {len(vectors)} vetores no Supabase (cefr_documents)...")
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
                print(f"[EmbeddingsService] Erro ao salvar chunk {i} do arquivo {source_file}: {e}")
                
        return saved_count

    @staticmethod
    def search_similar_documents(query: str, level: str = None, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Busca chunks similares a uma query usando a function do Supabase (precisa ser criada se ainda não existir).
        Como alternativa via client, podemos buscar usando a função match_cefr_documents que podemos criar no SQL.
        """
        client = get_client()
        embeddings_model = EmbeddingsService.get_embeddings_model()
        
        query_embedding = embeddings_model.embed_query(query)
        
        # Parâmetros para a função RPC do Supabase que faz a busca por similaridade
        params = {
            "query_embedding": query_embedding,
            "match_threshold": 0.5,
            "match_count": top_k
        }
        
        if level:
            params["filter_level"] = level
            
        try:
            # Assumindo que criaremos uma função `match_cefr_documents` no Supabase
            res = client.rpc('match_cefr_documents', params).execute()
            return res.data
        except Exception as e:
            print(f"[EmbeddingsService] Erro ao buscar similaridade: {e}")
            return []
