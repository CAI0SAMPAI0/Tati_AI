import os
import json
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from langchain_google_community import GoogleDriveLoader

load_dotenv()

def autenticar_google():
    """Garante que o token.json exista antes de rodar o RAG"""
    scopes = ["https://www.googleapis.com/auth/drive.readonly"]
    creds = None
    
    # 1. Tenta carregar o token existente
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", scopes)
    
    # 2. Se não tem token ou expirou, faz o login manual
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Montando o dict das credenciais do .env
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
        
        # 3. Salva o token para a próxima vez
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    
    return creds

def sincronizar_drive():
    print("🔑 Iniciando autenticação...")
    autenticar_google() # Isso abre o navegador!
    
    print("☁️ Conectando ao Google Drive via LangChain...")
    try:
        loader = GoogleDriveLoader(
            folder_id=os.getenv("GOOGLE_DRIVE_FOLDER_ID"),
            token_path="token.json",    
            file_types=["pdf", "document", "presentation", "sheet"], 
            recursive=True
        )
        
        documentos = loader.load()
        print(f"✅ Sucesso! {len(documentos)} arquivos encontrados em todas as estruturas de pastas.")
        return documentos
    except Exception as e:
        print(f"❌ Erro no LangChain: {e}")
        return []

if __name__ == "__main__":
    docs = sincronizar_drive()