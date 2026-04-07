from __future__ import annotations
import os
from dataclasses import dataclass
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
from dotenv import load_dotenv

load_dotenv()

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CHROMA_PATH = os.path.join(_BASE_DIR, "data", "chroma_db")


# Busca RAG no ChromaDB usando embeddings HuggingFace.

_embeddings = HuggingFaceInferenceAPIEmbeddings(
    api_key=os.getenv("HUGGING_FACE_KEY", ""),
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)
_vectorstore = Chroma(persist_directory=_CHROMA_PATH, embedding_function=_embeddings)


@dataclass
class RAGResult:
    contexto: str
    fontes: str


def obter_contexto_rag(pergunta: str) -> RAGResult:
    """Busca no ChromaDB e retorna contexto + fontes formatados."""
    try:
        docs = _vectorstore.as_retriever(search_kwargs={"k": 3}).invoke(pergunta)
        if not docs:
            return RAGResult(
                contexto="Nenhum trecho encontrado na biblioteca para esta pergunta.",
                fontes="",
            )

        contexto = "\n".join(
            f"\n--- Trecho {i + 1} ---\n{doc.page_content}"
            for i, doc in enumerate(docs)
        )
        fontes_set = {
            f"📄 {doc.metadata.get('title', doc.metadata.get('source', 'Desconhecido'))} "
            f"(Pág: {doc.metadata.get('page', 'N/A')})"
            for doc in docs
        }
        return RAGResult(contexto=contexto, fontes="\n".join(fontes_set))

    except Exception as exc:
        print(f"⚠️ Erro silencioso no RAG: {exc}")
        return RAGResult(contexto="", fontes="")