import logging
"""
services/premium_service.py
Serviço para gerenciamento de conteúdos premium e controle de acesso.
"""

from typing import List, Dict, Any, Optional
import uuid
import os
from fastapi import UploadFile, HTTPException
from fastapi import Depends
from app.core.exceptions import PremiumAccessDeniedError, ContentNotFoundError, BusinessLogicError
from app.core.dependencies.db import get_db
from fastapi.concurrency import run_in_threadpool
from app.shared.services.secure_document_service import (
    SecureDocumentService,
    public_preview_url,
    VALID_CATEGORIES,
)


class PremiumService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db
        self.bucket = "module-files"
        self.secure_service = SecureDocumentService()

    async def list_content_for_student(
            self, username: str) -> List[Dict[str, Any]]:
        """Lista conteúdos premium com status de compra para o aluno."""
        def _fetch():
            # Busca todos os conteúdos ativos
            contents = self.db.table('premium_content').select(
                '*').eq('is_active', True).execute().data or []

            # Busca compras confirmadas do usuário
            purchases = self.db.table('premium_purchases').select('content_id').eq(
                'username', username).eq('status', 'confirmed').execute().data or []
            purchased_ids = {p['content_id'] for p in purchases}

            for item in contents:
                item['is_purchased'] = item['id'] in purchased_ids
                # Remove o link direto na vitrine para segurança
                if not item['is_purchased'] and item['price'] > 0:
                    item['content_source'] = None

            return contents

        return await run_in_threadpool(_fetch)

    async def get_content_access(
            self,
            content_id: str,
            username: str) -> str:
        """Verifica acesso e retorna uma Signed URL se autorizado."""
        def _check():
            # Busca o conteúdo
            content = self.db.table('premium_content').select(
                '*').eq('id', content_id).single().execute().data
            if not content:
                raise ContentNotFoundError(
                    detail="Conteúdo não encontrado")

            purchase = self.db.table('premium_purchases').select('*').eq(
                'username', username).eq(
                'content_id', content_id).eq(
                'status', 'confirmed').execute().data
            from app.modules.payments.services.subscription_manager import SPECIAL_USERS
            user_row = self.db.table('users').select('role').eq(
                'username', username).limit(1).execute().data
            role = user_row[0]['role'] if user_row else None
            is_special = username in SPECIAL_USERS or role == 'admin'
            authorized = len(purchase) > 0 or is_special

            if not authorized:
                raise PremiumAccessDeniedError(
                    detail="Acesso negado. Compra necessária.")

            if content['type'] == 'link':
                return content['content_source']

            if content.get('is_secure') and content.get('processing_status') in (
                    'ready', 'skipped') and content.get('secure_pages'):
                pages = content['secure_pages']
                secure_urls = []
                for p in pages:
                    res = self.db.storage.from_(
                        'hub-secure-pages').create_signed_url(p, 1800)
                    secure_urls.append(res['signedURL'])

                return {
                    "type": "secure_images",
                    "pages": secure_urls,
                    "total_pages": len(secure_urls),
                    "is_secure_viewer": True,
                    "title": content.get('title'),
                }

            # Caso contrário, fluxo antigo (Signed URL do arquivo
            # original)
            file_path = content['content_source']
            try:
                # Expira em 15 minutos (900 segundos)
                res = self.db.storage.from_(
                    self.bucket).create_signed_url(file_path, 900)
                return res['signedURL']
            except Exception as e:
                logging.info(
                    f"[PremiumService] Erro ao gerar Signed URL: {e}")
                raise HTTPException(
                    status_code=500,
                    detail="Erro ao gerar link de acesso.")

        return await run_in_threadpool(_check)

    # ── Admin Methods ─────────────────────────────────────────────────

    async def list_all_admin(self) -> List[Dict[str, Any]]:
        """Lista todos os conteúdos para o admin."""
        def _fetch():
            return self.db.table('premium_content').select(
                '*').order('created_at', desc=True).execute().data or []
        return await run_in_threadpool(_fetch)

    def _validate_create_payload(
            self, data: Dict[str, Any]) -> Dict[str, Any]:
        price = float(data.get('price') or 0)
        if price <= 0:
            raise BusinessLogicError(
                detail='Preço deve ser maior que zero.')

        category = (data.get('category') or 'other').lower()
        if category not in VALID_CATEGORIES:
            raise BusinessLogicError(
                detail=f'Categoria inválida. Use: {
                    ", ".join(
                        sorted(VALID_CATEGORIES))}')

        data['category'] = category
        data['price'] = price
        data.setdefault('processing_status', 'pending')
        return data

    async def create_content(
            self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Cria conteúdo premium e dispara processamento seguro para arquivos PDF."""
        data = self._validate_create_payload(dict(data))

        def _insert():
            res = self.db.table(
                'premium_content').insert(data).execute()
            return res.data[0]

        content = await run_in_threadpool(_insert)

        source = content.get('content_source')
        content_type = content.get('type')

        if content_type in ('file', 'pdf') and source and not str(
                source).startswith('http'):
            import asyncio
            asyncio.create_task(
                self._trigger_secure_processing(content))

        return content

    async def _trigger_secure_processing(
            self, content: Dict[str, Any]) -> None:
        """Baixa PDF do storage e processa em thread pool."""
        content_id = content['id']
        source = content['content_source']
        temp_path = os.path.join('temp', str(source).replace('/', '_'))

        def _run():
            try:
                logging.info(
                    f'[PremiumService] Processamento seguro: {content_id}')
                file_data = self.db.storage.from_(
                    self.bucket).download(source)
                os.makedirs(os.path.dirname(temp_path)
                            or 'temp', exist_ok=True)
                with open(temp_path, 'wb') as f:
                    f.write(file_data)

                result = self.secure_service.secure_process_document(
                    local_path=temp_path,
                    filename=os.path.basename(str(source)),
                    content_id=content_id,
                )
                if not result.get('success'):
                    logging.info(
                        f'[PremiumService] Falha: {
                            result.get("error")}')
            except Exception as e:
                logging.info(
                    f'[PremiumService] Falha no processamento: {e}')
                self.secure_service._set_processing_status(
                    content_id, 'failed', str(e))
            finally:
                try:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                except OSError:
                    pass

        await run_in_threadpool(_run)

    async def update_content(
            self, content_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Atualiza um conteúdo existente e processa o arquivo caso ele seja alterado."""
        payload = dict(data)
        if 'category' in payload and payload['category']:
            cat = str(payload['category']).lower()
            if cat not in VALID_CATEGORIES:
                raise BusinessLogicError(
                    detail=f'Categoria inválida. Use: {
                        ", ".join(
                            sorted(VALID_CATEGORIES))}')
            payload['category'] = cat
        # Valida price legado apenas se enviado E se não houver
        # price_students/price_buyers
        has_new_prices = payload.get(
            'price_students') or payload.get('price_buyers')
        if 'price' in payload and not has_new_prices and float(
                payload.get('price') or 0) <= 0:
            raise BusinessLogicError(
                detail='Preço deve ser maior que zero.')

        source_changed = (
            'content_source' in payload
            and payload['content_source']
            and not str(payload['content_source']).startswith('http')
        )

        if source_changed:
            payload['processing_status'] = 'pending'

        def _update():
            res = self.db.table('premium_content').update(
                payload).eq('id', content_id).execute()
            return res.data[0]

        content = await run_in_threadpool(_update)

        if source_changed and content.get('type') in ('file', 'pdf'):
            import asyncio
            asyncio.create_task(
                self._trigger_secure_processing(content))

        return content

    async def delete_content(self, content_id: str) -> bool:
        """
        Exclui um conteúdo premium fisicamente do banco de dados.
        Remove também todas as compras e itens de pedido relacionados para evitar violação de chaves estrangeiras.
        """
        def _delete():
            # 1. Remove compras vinculadas
            self.db.table('premium_purchases').delete().eq(
                'content_id', content_id).execute()

            # 2. Remove itens de pedidos vinculados
            self.db.table('order_items').delete().eq(
                'content_id', content_id).execute()

            # 3. Remove o conteúdo fisicamente
            self.db.table('premium_content').delete().eq(
                'id', content_id).execute()
            return True
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

    def _normalize_public_item(
            self, item: Dict[str, Any]) -> Dict[str, Any]:
        if not item:
            return item
        raw_cat = item.get('category')
        item['category'] = (
            str(raw_cat).lower() if raw_cat else 'other')
        if item['category'] not in VALID_CATEGORIES:
            item['category'] = 'other'
        item.setdefault('is_featured', False)
        preview_path = item.get('preview_path')
        if preview_path:
            item['preview_url'] = public_preview_url(preview_path)
        elif item.get('thumbnail_url'):
            item['preview_url'] = item['thumbnail_url']
        for key in (
            'preview_path',
            'emoji',
            'secure_pages',
            'content_source',
                'original_drive_id'):
            item.pop(key, None)
        return item

    async def list_public_catalog(self) -> List[Dict[str, Any]]:
        """Lista todo o conteúdo premium disponível para compra (não requer login)."""
        def _fetch():
            rows = (
                self.db.table('premium_content')
                .select('*')
                .eq('is_active', True)
                .order('created_at', desc=True)
                .execute()
                .data
                or []
            )
            # Mantém itens que tenham qualquer preço definido (students,
            # buyers ou legado)
            rows = [r for r in rows if float(r.get('price_students') or r.get(
                'price_buyers') or r.get('price') or 0) > 0]
            return [self._normalize_public_item(row) for row in rows]

        return await run_in_threadpool(_fetch)

    async def get_public_item(
            self, item_id: str) -> Optional[Dict[str, Any]]:
        """Busca um item específico para o catálogo público."""
        def _fetch():
            # Inclui price_students e price_buyers para resolução
            # correta no frontend
            fields = (
                "id, title, description, price, price_students, price_buyers, "
                "type, thumbnail_url, preview_path, "
                "category, is_featured, processing_status, created_at")
            try:
                item = (
                    self.db.table('premium_content')
                    .select(fields)
                    .eq('id', item_id)
                    .eq('is_active', True)
                    .single()
                    .execute()
                    .data
                )
            except Exception:
                basic_fields = (
                    "id, title, description, price, price_students, price_buyers, "
                    "type, thumbnail_url, created_at")
                item = (
                    self.db.table('premium_content')
                    .select(basic_fields)
                    .eq('id', item_id)
                    .eq('is_active', True)
                    .single()
                    .execute()
                    .data
                )
            if not item:
                return None
            # Descarta itens sem nenhum preço definido
            has_price = float(item.get('price_students') or item.get(
                'price_buyers') or item.get('price') or 0) > 0
            if not has_price:
                return None
            return self._normalize_public_item(item)

        return await run_in_threadpool(_fetch)

    async def list_user_orders(
            self, username: str) -> List[Dict[str, Any]]:
        """Lista pedidos do hub-site para o usuário autenticado."""
        def _fetch():
            orders = (
                self.db.table('orders')
                .select('id, status, total_amount, payment_method, created_at')
                .eq('username', username)
                .order('created_at', desc=True)
                .execute()
                .data
                or []
            )
            result = []
            for order in orders:
                items = (
                    self.db.table('order_items')
                    .select('content_id, price')
                    .eq('order_id', order['id'])
                    .execute()
                    .data
                    or []
                )
                enriched = []
                for item in items:
                    content_res = (
                        self.db.table('premium_content')
                        .select('title')
                        .eq('id', item['content_id'])
                        .limit(1)
                        .execute()
                    )
                    content = (content_res.data or [None])[0]
                    enriched.append({
                        'content_id': item['content_id'],
                        'price': item['price'],
                        'title': (content or {}).get('title', 'Material'),
                    })
                result.append({**order, 'items': enriched})
            return result

        return await run_in_threadpool(_fetch)
