import os
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from langchain_google_community import GoogleDriveLoader

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

load_dotenv()

# --- CAMINHOS ---
PASTA_RAIZ = os.getcwd()
CHROMA_PATH = os.path.join(PASTA_RAIZ, "backend", "data", "chroma_db")

def autenticar_google():
    """Garante que o token.json exista antes de rodar o RAG"""
    scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    creds = None
    
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", scopes)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            creds_data = {
                "installed": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID_DRIVE"),
                    "project_id": os.getenv("GOOGLE_PROJECT_ID"),
                    "auth_uri": os.getenv("GOOGLE_AUTH_URI"),
                    "token_uri": os.getenv("GOOGLE_TOKEN_URI"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "redirect_uris": ["http://localhost"]
                }
            }
            flow = InstalledAppFlow.from_client_config(creds_data, scopes)
            creds = flow.run_local_server(port=0)
        
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    
    return creds

def sincronizar_drive():
    print("🔑 Iniciando autenticação...")
    autenticar_google() 
    
    print(f"☁️ Conectando à pasta do Google Drive: {os.getenv('GOOGLE_DRIVE_FOLDER_ID')}...")
    try:
        # Puxa SOMENTE PDFs da pasta específica
        loader = GoogleDriveLoader(
            folder_id=os.getenv("GOOGLE_DRIVE_FOLDER_ID"),
            token_path="token.json",    
            recursive=True
        )
        
        documentos = loader.load()
        if not documentos:
            print("⚠️ Nenhum PDF encontrado nessa pasta do Drive.")
            return []
            
        print(f"✅ Sucesso! Lidas {len(documentos)} páginas/documentos do Drive.")
        return documentos
    except Exception as e:
        print(f"❌ Erro no LangChain: {e}")
        return []

def salvar_no_banco(documentos):
    if not documentos:
        return

    print("✂️ Cortando os textos em pedaços menores...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    pedacos = text_splitter.split_documents(documentos)
    print(f"✅ O texto foi dividido em {len(pedacos)} pedaços.")

    print(f"🧠 Criando o banco de dados em: {CHROMA_PATH}...")
    embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    Chroma.from_documents(
        documents=pedacos,
        embedding=embeddings_model,
        persist_directory=CHROMA_PATH
    )
    print("🎉 BANCO DE DADOS CRIADO COM SUCESSO! A Tati já pode ler os PDFs da nuvem.")

if __name__ == "__main__":
    docs = sincronizar_drive()
    salvar_no_banco(docs)