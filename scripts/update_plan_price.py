import logging
from services.database import get_client
import os
import sys

# Adiciona o path do backend para importar os services
sys.path.append(os.path.join(os.getcwd(), 'backend'))


def update_plan_price():
    db = get_client()
    logging.info("Atualizando preço do Plano Full para R$ 5,00...")
    try:
        res = db.table('plans').update(
            {'price': 5.00}).eq('id', 'full').execute()
        if res.data:
            logging.info(
                "✅ Preço atualizado com sucesso no banco de dados!")
        else:
            logging.info(
                "⚠️ Plano 'full' não encontrado na tabela 'plans'.")

        # Também verifica se o plano existe, se não, cria
        plan_exists = db.table('plans').select(
            '*').eq('id', 'full').execute().data
        if not plan_exists:
            logging.info("Criando plano 'full'...")
            db.table('plans').insert({
                'id': 'full',
                'name': 'Plano Full',
                'description': 'Acesso ilimitado a todas as funcionalidades',
                'price': 5.00,
                'is_active': True
            }).execute()
            logging.info("✅ Plano 'full' criado com sucesso!")

    except Exception as e:
        logging.info(f"❌ Erro ao atualizar plano: {e}")


if __name__ == "__main__":
    update_plan_price()
