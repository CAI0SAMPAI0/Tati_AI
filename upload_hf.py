import os

from huggingface_hub import HfApi

token = os.environ.get("HF_TOKEN")
if not token:
    raise SystemExit("Set HF_TOKEN env var")

api = HfApi(token=token)
user = api.whoami()
print("Logged in as:", user.get("name"))

for path_in_repo, local_path in [
    ("app/modules/auth/routes/auth.py", "backend/app/modules/auth/routes/auth.py"),
    (
        "app/modules/auth/services/auth_service.py",
        "backend/app/modules/auth/services/auth_service.py",
    ),
    ("Dockerfile", "backend/Dockerfile.api"),
    ("requirements.txt", "backend/requirements.txt"),
]:
    with open(local_path, "rb") as f:
        content = f.read()
    api.upload_file(
        path_or_fileobj=content,
        path_in_repo=path_in_repo,
        repo_id="caio007/tati-ai-backend",
        repo_type="space",
        commit_message=f"upload {path_in_repo}",
    )
    print(f"Uploaded {path_in_repo}")
print("Done")
