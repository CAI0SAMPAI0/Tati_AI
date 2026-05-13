import os
import sys

# Adiciona o path do backend para importar os services
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from services.database import get_client

def update_plan_price():
    db = get_client()
    print("Atualizando preço do Plano Full para R$ 5,00...")
    try:
        res = db.table('plans').update({'price': 5.00}).eq('id', 'full').execute()
        if res.data:
            print("✅ Preço atualizado com sucesso no banco de dados!")
        else:
            print("⚠️ Plano 'full' não encontrado na tabela 'plans'.")
            
        # Também verifica se o plano existe, se não, cria
        plan_exists = db.table('plans').select('*').eq('id', 'full').execute().data
        if not plan_exists:
            print("Criando plano 'full'...")
            db.table('plans').insert({
                'id': 'full',
                'name': 'Plano Full',
                'description': 'Acesso ilimitado a todas as funcionalidades',
                'price': 5.00,
                'is_active': True
            }).execute()
            print("✅ Plano 'full' criado com sucesso!")
            
    except Exception as e:
        print(f"❌ Erro ao atualizar plano: {e}")

if __name__ == "__main__":
    update_plan_price()
