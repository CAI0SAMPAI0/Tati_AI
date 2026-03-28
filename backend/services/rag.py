# RAG - Recuperação de Informação + Geração de Resposta
import os
import json
from dotenv import load_dotenv
from langchain_community.document_loaders import GoogleDriveLoader

load_dotenv()

def obter_loader_seguro():
    # 1. Monta o dicionário das credenciais em memória (RAM)
    creds_dict = {
        "installed": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "project_id": os.getenv("GOOGLE_PROJECT_ID"),
            "auth_uri": os.getenv("GOOGLE_AUTH_URI"),
            "token_uri": os.getenv("GOOGLE_TOKEN_URI"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris": ["http://localhost"]
        }
    }

    # 2. Cria o arquivo temporário necessário para a biblioteca
    temp_path = "credentials_temp.json"
    with open(temp_path, "w") as f:
        json.dump(creds_dict, f)

    try:
        # 3. Inicializa o loader usando o arquivo temporário
        loader = GoogleDriveLoader(
            folder_id=os.getenv("GOOGLE_DRIVE_FOLDER_ID"),
            credentials_path=temp_path,
            token_path="token.json", # Este arquivo guarda o login da sua conta
            file_types=["pdf"]
        )
        return loader
    finally:
        # 4. DELETA o arquivo de credenciais assim que o loader carregar
        # Isso garante que a senha (client_secret) suma do seu PC
        if os.path.exists(temp_path):
            os.remove(temp_path)

# Para usar:
loader = obter_loader_seguro()
documentos = loader.load()