import os
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

# Configuração de caminhos blindada para rodar via Uvicorn
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # Aponta para /backend
CHROMA_PATH = os.path.join(BASE_DIR, "data", "chroma_db")

embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vectorstore = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings_model)

def obter_contexto_rag(pergunta: str):
    """
    Busca no ChromaDB e retorna um dicionário com os trechos e as fontes.
    """
    try:
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        docs_encontrados = retriever.invoke(pergunta)
        
        contexto_formatado = ""
        fontes_usadas = set()
        
        if docs_encontrados:
            for i, doc in enumerate(docs_encontrados):
                contexto_formatado += f"\n--- Trecho {i+1} ---\n{doc.page_content}\n"
                nome_arquivo = doc.metadata.get('title', doc.metadata.get('source', 'Arquivo Desconhecido'))
                pagina = doc.metadata.get('page', 'N/A')
                fontes_usadas.add(f"📄 {nome_arquivo} (Pág: {pagina})")
        else:
            contexto_formatado = "Nenhum trecho específico encontrado nos PDFs da biblioteca para esta pergunta."
            
        lista_fontes = "\n".join(fontes_usadas) if fontes_usadas else ""
        
        # Devolvemos um Dicionário, é impossível dar erro de unpack!
        return {
            "contexto": contexto_formatado,
            "fontes": lista_fontes
        }
    except Exception as e:
        print(f"⚠️ Erro silencioso no RAG: {e}")
        return {"contexto": "", "fontes": ""}