import os
import sys

# Adiciona o path do backend para importar os services
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from services.database import get_client

def run_migration():
    db = get_client()
    print("Tentando adicionar a coluna 'file_url' à tabela 'modules'...")
    try:
        # Nota: O cliente do Supabase Python não tem um método direto para executar SQL arbitrário
        # a menos que usemos uma RPC ou algo do tipo.
        # Geralmente, SQL migrations são feitas no dashboard do Supabase ou via CLI.
        # Como não temos CLI aqui, vamos tentar usar o service_key para ver se conseguimos.
        
        # Se não conseguirmos via SQL, vamos ao menos logar que tentamos.
        print("Aviso: Migrações SQL via SDK Python são limitadas. Por favor, execute o seguinte SQL no Dashboard do Supabase:")
        print("ALTER TABLE modules ADD COLUMN IF NOT EXISTS file_url TEXT;")
        
    except Exception as e:
        print(f"Erro ao tentar migrar: {e}")

if __name__ == "__main__":
    run_migration()
