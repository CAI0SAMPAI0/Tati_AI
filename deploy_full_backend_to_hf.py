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

files_to_sync = [
    "app/urls.py",
    "app/api.py",
    "apps/authentication/api.py",
    "apps/authentication/services.py",
    "apps/authentication/security.py",
    "apps/notifications/api.py",
    "apps/notifications/services.py",
    "apps/notifications/schemas.py",
    "apps/notifications/models.py",
    "apps/notifications/apps.py",
]

for rel_path in files_to_sync:
    local_path = backend_root / rel_path
    if local_path.exists():
        print(f"Uploading {rel_path} to HF Space...")
        api.upload_file(
            path_or_fileobj=str(local_path),
            path_in_repo=rel_path.replace("\\", "/"),
            repo_id=repo_id,
            repo_type=repo_type,
            commit_message=f"Update {rel_path} with google oauth auto-redirect and notification scheduler",
        )
        print(f"Uploaded {rel_path} successfully!")

# Restart space to apply changes immediately
try:
    print("Reiniciando o Space da Hugging Face para aplicar as alterações...")
    api.restart_space(repo_id=repo_id)
    print("Space reiniciado com sucesso!")
except Exception as e:
    print("Restart notice:", e)

print("\nDeploy completo no Hugging Face!")

