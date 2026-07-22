from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CHROMA_PATH = os.path.join(_BASE_DIR, 'data', 'chroma_db')

# Lazy — nenhuma variável inicializada aqui
_embeddings = None
_vectorstore = None
_chroma_available: bool | None = None


def _get_vectorstore():
    """Inicializa ChromaDB e embeddings apenas quando necessário."""
    global _embeddings, _vectorstore, _chroma_available

    if _chroma_available is False:
        return None

    if _vectorstore is not None:
        return _vectorstore

    # Verifica se o diretório do Chroma existe antes de tentar carregar
    if not os.path.isdir(_CHROMA_PATH):
        _chroma_available = False
        return None

    try:
        from langchain_chroma import Chroma
        from langchain_huggingface import HuggingFaceEmbeddings

        _embeddings = HuggingFaceEmbeddings(
            model_name='sentence-transformers/all-MiniLM-L6-v2',
        )
        _vectorstore = Chroma(
            persist_directory=_CHROMA_PATH,
            embedding_function=_embeddings)
        _chroma_available = True
        return _vectorstore
    except Exception as exc:
        logging.info(f'[RAG] Falha ao inicializar vectorstore: {exc}')
        _chroma_available = False
        return None


@dataclass
class RAGResult:
    contexto: str
    fontes: str


def obter_contexto_rag(pergunta: str) -> RAGResult:
    """Busca no ChromaDB e retorna contexto + fontes formatados."""
    try:
        vs = _get_vectorstore()
        if vs is None:
            return RAGResult(
                contexto='A biblioteca de conhecimento não está disponível no momento.',
                fontes='',
            )
        docs = vs.as_retriever(search_kwargs={'k': 3}).invoke(pergunta)
        if not docs:
            return RAGResult(
                contexto='Nenhum trecho encontrado na biblioteca para esta pergunta.',
                fontes='',
            )

        contexto = '\n'.join(
            f'\n--- Trecho {i + 1} ---\n{doc.page_content}'
            for i, doc in enumerate(docs)
        )
        fontes_set = {
            f'📄 {
                doc.metadata.get(
                    "title",
                    doc.metadata.get(
                        "source",
                        "Desconhecido"))} ' f'(Pág: {
                    doc.metadata.get(
                        "page",
                        "N/A")})' for doc in docs}
        return RAGResult(
            contexto=contexto,
            fontes='\n'.join(fontes_set))

    except Exception as exc:
        return RAGResult(contexto='', fontes='')
