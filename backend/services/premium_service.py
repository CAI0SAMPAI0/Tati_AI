"""
services/premium_service.py
Serviço para gerenciamento de conteúdos premium e controle de acesso.
"""

from typing import List, Dict, Any, Optional
import uuid
from fastapi import HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from services.database import get_client

class PremiumService:
    def __init__(self):
        self.db = get_client()
        self.bucket = "module-files"

    async def list_content_for_student(self, username: str) -> List[Dict[str, Any]]:
        """Lista conteúdos premium com status de compra para o aluno."""
        def _fetch():
            # Busca todos os conteúdos ativos
            contents = self.db.table('premium_content').select('*').eq('is_active', True).execute().data or []
            
            # Busca compras confirmadas do usuário
            purchases = self.db.table('premium_purchases').select('content_id').eq('username', username).eq('status', 'confirmed').execute().data or []
            purchased_ids = {p['content_id'] for p in purchases}
            
            for item in contents:
                item['is_purchased'] = item['id'] in purchased_ids
                # Remove o link direto na vitrine para segurança
                if not item['is_purchased'] and item['price'] > 0:
                    item['content_source'] = None
            
            return contents

        return await run_in_threadpool(_fetch)

    async def get_content_access(self, content_id: str, username: str) -> str:
        """Verifica acesso e retorna uma Signed URL se autorizado."""
        def _check():
            # Busca o conteúdo
            content = self.db.table('premium_content').select('*').eq('id', content_id).single().execute().data
            if not content:
                raise HTTPException(status_code=404, detail="Conteúdo não encontrado")
            
            # Se for gratuito ou o usuário comprou
            if content['price'] == 0:
                authorized = True
            else:
                purchase = self.db.table('premium_purchases').select('*').eq('username', username).eq('content_id', content_id).eq('status', 'confirmed').execute().data
                authorized = len(purchase) > 0
            
            if not authorized:
                raise HTTPException(status_code=403, detail="Acesso negado. Compra necessária.")
            
            # Se for um link externo, retorna o link
            if content['type'] == 'link':
                return content['content_source']
            
            # Se for um arquivo no storage, gera Signed URL
            # O content_source deve ser o path no bucket
            file_path = content['content_source']
            try:
                # Expira em 15 minutos (900 segundos)
                res = self.db.storage.from_(self.bucket).create_signed_url(file_path, 900)
                return res['signedURL']
            except Exception as e:
                print(f"[PremiumService] Erro ao gerar Signed URL: {e}")
                raise HTTPException(status_code=500, detail="Erro ao gerar link de acesso.")

        return await run_in_threadpool(_check)

    # ── Admin Methods ─────────────────────────────────────────────────────────

    async def list_all_admin(self) -> List[Dict[str, Any]]:
        """Lista todos os conteúdos para o admin."""
        def _fetch():
            return self.db.table('premium_content').select('*').order('created_at', desc=True).execute().data or []
        return await run_in_threadpool(_fetch)

    async def create_content(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Cria um novo conteúdo premium."""
        def _insert():
            res = self.db.table('premium_content').insert(data).execute()
            return res.data[0]
        return await run_in_threadpool(_insert)

    async def update_content(self, content_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Atualiza um conteúdo existente."""
        def _update():
            res = self.db.table('premium_content').update(data).eq('id', content_id).execute()
            return res.data[0]
        return await run_in_threadpool(_update)

    async def delete_content(self, content_id: str) -> bool:
        """
        Tenta excluir um conteúdo. 
        Se houver compras vinculadas, faz um 'Soft Delete' (desativa) para manter integridade.
        """
        def _delete():
            try:
                # Tenta deletar fisicamente
                self.db.table('premium_content').delete().eq('id', content_id).execute()
                return True
            except Exception as e:
                # Se der erro de FK (compras existentes), apenas desativa e oculta
                if '23503' in str(e) or 'foreign key' in str(e).lower():
                    self.db.table('premium_content').update({'is_active': False}).eq('id', content_id).execute()
                    return True
                raise e
        return await run_in_threadpool(_delete)

    async def upload_file(self, file: UploadFile) -> str:
        """Faz upload de arquivo para o bucket premium e retorna o path."""
        file_extension = file.filename.split('.')[-1]
        file_path = f"{uuid.uuid4()}.{file_extension}"
        contents = await file.read()
        
        def _upload():
            self.db.storage.from_(self.bucket).upload(
                path=file_path,
                file=contents,
                file_options={
                    "content-type": file.content_type,
                    "x-upsert": "true"
                }
            )
            return file_path
        
        return await run_in_threadpool(_upload)
