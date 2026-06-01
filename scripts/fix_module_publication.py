import logging

from services.database import get_client


def fix_module_publication():
    db = get_client()
    module_id = '00000000-0000-0000-0000-000000000001'

    logging.info(f"Verificando status do módulo {module_id}...")
    res = db.table('modules').select(
        'is_published').eq('id', module_id).execute()

    if not res.data:
        logging.info("Módulo não encontrado no banco de dados.")
        return

    is_published = res.data[0].get('is_published')
    logging.info(f"Status atual de publicação: {is_published}")

    if not is_published:
        logging.info("Publicando módulo...")
        db.table('modules').update({'is_published': True}).eq(
            'id', module_id).execute()
        logging.info("Módulo publicado com sucesso!")
    else:
        logging.info("Módulo já está publicado.")


if __name__ == '__main__':
    fix_module_publication()
