import logging
from services.database import get_client
import os
import sys

# Adiciona o path do backend para importar os services
sys.path.append(os.path.join(os.getcwd(), 'backend'))


def run_migration():
    db = get_client()
    logging.info(
        "Tentando adicionar a coluna 'file_url' à tabela 'modules'...")
    try:
        # Nota: O cliente do Supabase Python não tem um método direto para executar SQL arbitrário
        # a menos que usemos uma RPC ou algo do tipo.
        # Geralmente, SQL migrations são feitas no dashboard do Supabase ou via CLI.
        # Como não temos CLI aqui, vamos tentar usar o service_key para
        # ver se conseguimos.

        # Se não conseguirmos via SQL, vamos ao menos logar que
        # tentamos.
        logging.info(
            "Aviso: Migrações SQL via SDK Python são limitadas. Por favor, execute o seguinte SQL no Dashboard do Supabase:")
        logging.info(
            "ALTER TABLE modules ADD COLUMN IF NOT EXISTS file_url TEXT;")

    except Exception as e:
        logging.info(f"Erro ao tentar migrar: {e}")


if __name__ == "__main__":
    run_migration()
