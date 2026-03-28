# lógica rag para alimentar a IA
import os
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

# caminho de onde o banco de dados de vetores será armazenado
CROMA_PATH = "./chroma_db"
DRIVE_PATH = "./data/apostilas" # -> EXEMPLO: "./drive" -> pasta onde estão os PDFs
embeddings_model=HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

async def ingest_documents():
    # Carrega os documentos PDF
    print("Carregando documentos PDF...")
    loader = PyPDFDirectoryLoader(DRIVE_PATH)
    documents = loader.load()

    # Dividir os documentos em pedaços menores
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50, length_function=len)
    chunks = text_splitter.create_documents([doc.page_content for doc in documents])

    # Criar o banco de dados de vetores usando Chroma
    print(f'Salvando {len(chunks)} chunks no banco de dados de vetores...')
    vectorstore = Chroma.from_documents(chunks, embeddings_model, persist_directory=CROMA_PATH)
    vectorstore.persist()
    print("✅ Ingestão concluída com sucesso!")
    return len(chunks)

async def search_context(query: str, k: int = 3):
    """Função para buscar o contexto relevante usando o banco de dados de vetores."""
    vectorstore = Chroma(persist_directory=CROMA_PATH, embedding_function=embeddings_model)
    results = vectorstore.similarity_search(query, k=k)
    contexto = "\n\n".join([result.page_content for result in results])
    return contexto

def teste_leitura():
    """Função de teste para verificar se os documentos foram ingeridos corretamente."""
    vectorstore = Chroma(persist_directory=CROMA_PATH, embedding_function=embeddings_model)
    count = vectorstore._collection.count()
    loader = PyPDFDirectoryLoader(DRIVE_PATH)
    documentos = loader.load()
    print(f"Total de chunks no banco de dados: {count}")
    
    if len(documentos) == 0:
        print("Nenhum documento encontrado. Verifique o caminho e os arquivos PDF.")

    print('\nFatiando os primeiros 5 chunks para verificação:')
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50, length_function=len)
    
    chunks = text_splitter.split_documents(documentos)
    if chunks:
        print(chunks[0].page_content)
        
if __name__ == "__main__":
    teste_leitura()