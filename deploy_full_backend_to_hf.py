import os
from pathlib import Path
from dotenv import load_dotenv
from huggingface_hub import HfApi

env_path = Path(r"c:\Users\CAIO\Projetos\Tati_AI\.env")
load_dotenv(dotenv_path=env_path)

token = os.getenv("HF_TOKEN") or os.getenv("tati-deploy") or os.getenv("HUGGING_FACE_HUB_TOKEN")
if not token:
    raise SystemExit("HF_TOKEN missing in .env")

api = HfApi(token=token)
user = api.whoami()
print("Autenticado no Hugging Face como:", user.get("name"))

repo_id = "caio007/tati-ai-backend"
repo_type = "space"

backend_root = Path(r"c:\Users\CAIO\Projetos\Tati_AI\backend")

print(f"Enviando todos os arquivos do backend da Tati AI para o Space {repo_id}...")
api.upload_folder(
    folder_path=str(backend_root),
    repo_id=repo_id,
    repo_type=repo_type,
    delete_patterns="*",
    ignore_patterns=["*.sqlite3", "**/__pycache__/**", "**/*.pyc", ".env*", ".venv*"],
    commit_message="Fechamento de competições mensais e envio do Top 3 para Admin",
)
print("Arquivos sincronizados com sucesso!")

# Restart space to apply changes immediately
try:
    print("Reiniciando o Space da Hugging Face para aplicar as alterações...")
    api.restart_space(repo_id=repo_id)
    print("Space reiniciado com sucesso!")
except Exception as e:
    print("Restart notice:", e)

print("\nDeploy completo no Hugging Face!")

