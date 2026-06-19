import os
import sys
from pathlib import Path

# Garante que a biblioteca huggingface_hub está disponível
try:
    from huggingface_hub import HfApi
except ImportError:
    print("❌ Erro: A biblioteca 'huggingface_hub' não está instalada.")
    print("👉 Instale-a executando: pip install huggingface_hub")
    sys.exit(1)

# Caminho para o arquivo .env
env_path = Path(__file__).parent.parent / '.env'

if not env_path.exists():
    print(f"❌ Erro: Arquivo .env não encontrado em: {env_path}")
    sys.exit(1)

# Obtém o token da Hugging Face
hf_token = os.getenv("HF_TOKEN")
if not hf_token:
    print("🔑 Para enviar as chaves, você precisará do seu Access Token da Hugging Face (com permissão WRITE).")
    print("👉 Gere um em: https://huggingface.co/settings/tokens")
    hf_token = input("Digite o seu Access Token: ").strip()

if not hf_token:
    print("❌ Erro: O token é obrigatório para autenticação.")
    sys.exit(1)

# Identificação do Space
repo_id = input("Digite o ID do Space (Pressione ENTER para usar 'caio007/tati-ai-backend'): ").strip()
if not repo_id:
    repo_id = "caio007/tati-ai-backend"

print(f"\n📂 Lendo variáveis de: {env_path}")
secrets = {}

with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        # Ignora comentários e linhas vazias
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip()
            # Remove aspas caso existam
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            if val:  # Só adiciona se tiver valor configurado
                secrets[key] = val

print(f"✅ Encontradas {len(secrets)} chaves válidas no .env.\n")
print("🚀 Iniciando envio para o Hugging Face Spaces (isso pode levar alguns instantes)...")

api = HfApi(token=hf_token)
success_count = 0

for i, (key, value) in enumerate(secrets.items(), 1):
    # Máscara visual do segredo nos logs de console para segurança
    masked = value[:4] + "..." + value[-4:] if len(value) > 8 else "********"
    print(f"⚡ [{i}/{len(secrets)}] Enviando {key} ({masked})... ", end="", flush=True)
    try:
        api.add_space_secret(repo_id=repo_id, key=key, value=value)
        print("✅ OK")
        success_count += 1
    except Exception as e:
        print(f"❌ ERRO: {e}")

print(f"\n🎉 Concluído! {success_count} de {len(secrets)} variáveis de ambiente foram salvas como Secrets com sucesso no Space '{repo_id}'!")
