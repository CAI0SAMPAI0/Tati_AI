"""
routers/activities/hub.py
Gerencia o Hub de conteúdos premium (Kiwify style).
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from app.core.database import get_client
from app.core.dependencies.auth import get_current_user
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()

class PremiumContent(BaseModel):
    id: str
    title: str
    description: Optional[str]
    price: float
    type: str
    content_source: Optional[str]
    thumbnail_url: Optional[str]
    emoji: Optional[str]
    is_active: bool
    has_access: bool = False

@router.get("/", response_model=List[PremiumContent])
async def list_premium_content(user: dict = Depends(get_current_user)):
    """Lista todos os conteúdos premium disponíveis e indica se o usuário já comprou."""
    db = get_client()
    username = user.get('username')

    # 1. Busca conteúdos ativos
    contents_res = db.table('premium_content').select('*').eq('is_active', True).execute()
    contents = contents_res.data or []

    # 2. Busca compras do usuário
    purchases_res = db.table('premium_purchases').select('id, content_id, asaas_payment_id, status').eq('username', username).execute()
    
    # 2.1 Verifica em tempo real os pagamentos pendentes no Asaas
    purchased_ids = set()
    from app.modules.payments.services.asaas import get_payment
    import asyncio
    
    tasks = []
    for p in purchases_res.data or []:
        if p['status'] == 'confirmed':
            purchased_ids.add(p['content_id'])
        elif p['status'] == 'pending' and p.get('asaas_payment_id'):
            # Adiciona tarefa para verificar o status no Asaas
            async def _check_payment(purch=p):
                try:
                    payment_data = await get_payment(purch['asaas_payment_id'])
                    if payment_data and payment_data.get('status') in ['RECEIVED', 'CONFIRMED']:
                        # Atualiza no banco
                        db.table('premium_purchases').update({'status': 'confirmed'}).eq('id', purch['id']).execute()
                        purchased_ids.add(purch['content_id'])
                except Exception as e:
                    print(f"[Hub] Erro ao verificar pagamento {purch['asaas_payment_id']}: {e}")
            tasks.append(_check_payment())
            
    if tasks:
        await asyncio.gather(*tasks)

    # 3. Formata resposta
    result = []
    for c in contents:
        # Se for admin ou programador, libera acesso automático para teste
        from app.modules.payments.services.subscription_manager import SPECIAL_USERS
        has_access = c['id'] in purchased_ids or username in SPECIAL_USERS or user.get('role') == 'admin'
        
        result.append({
            **c,
            "has_access": has_access
        })

    return result

@router.get("/{content_id}/access")
async def get_content_access(content_id: str, user: dict = Depends(get_current_user)):
    """Retorna o link de acesso/download se o usuário tiver permissão."""
    db = get_client()
    username = user.get('username')

    # 1. Verifica se tem acesso
    from app.modules.payments.services.subscription_manager import SPECIAL_USERS
    is_special = username in SPECIAL_USERS or user.get('role') == 'admin'
    
    if not is_special:
        purchase = db.table('premium_purchases').select('id').eq('username', username).eq('content_id', content_id).eq('status', 'confirmed').execute()
        if not purchase.data:
            raise HTTPException(status_code=403, detail="Você não possui acesso a este conteúdo. Realize a compra para liberar.")

    # 2. Busca o link original
    content = db.table('premium_content').select('content_source').eq('id', content_id).single().execute()
    if not content.data:
        raise HTTPException(status_code=404, detail="Conteúdo não encontrado.")
    
    source = content.data['content_source']
    
    # 3. Formata URL (se for apenas nome de arquivo, assume Supabase Storage no bucket 'module-files')
    if source and not source.startswith('http'):
        from app.core.config import settings
        source = f"{settings.supabase_url}/storage/v1/object/public/module-files/{source}"

    return {"url": source}

@router.get("/{content_id}/download")
async def download_premium_content(
    content_id: str, 
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Faz o download do arquivo com o nome real (baseado no título)."""
    db = get_client()
    user = None
    
    # 1. Tenta pegar token do Header ou do Query Param
    final_token = token
    if not final_token and authorization and authorization.startswith("Bearer "):
        final_token = authorization.split(" ")[1]
    
    if final_token:
        from app.core.security import decode_token
        payload = decode_token(final_token)
        if payload:
            username = payload['sub']
            rows = db.table('users').select('username, role').eq('username', username).execute()
            if rows.data:
                user = rows.data[0]
    
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado.")

    username = user.get('username')

    # 1. Verifica se tem acesso
    from app.modules.payments.services.subscription_manager import SPECIAL_USERS
    is_special = username in SPECIAL_USERS or user.get('role') == 'admin'
    
    if not is_special:
        purchase = db.table('premium_purchases').select('id').eq('username', username).eq('content_id', content_id).eq('status', 'confirmed').execute()
        if not purchase.data:
            raise HTTPException(status_code=403, detail="Acesso negado.")

    # 2. Busca informações do conteúdo
    content = db.table('premium_content').select('*').eq('id', content_id).single().execute()
    if not content.data:
        raise HTTPException(status_code=404, detail="Conteúdo não encontrado.")
    
    item = content.data
    source = item['content_source']
    
    if not source:
        raise HTTPException(status_code=404, detail="Arquivo não configurado.")

    # 3. Se for URL externa (não Supabase), apenas redireciona
    if source.startswith('http'):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=source)

    # 4. Busca o arquivo no Supabase Storage e faz o stream
    try:
        supabase = get_client()
        # Baixa o arquivo do bucket 'module-files'
        file_data = supabase.storage.from_('module-files').download(source)
        
        from fastapi.responses import StreamingResponse
        import io
        import mimetypes
        
        # Define o nome do arquivo amigável
        extension = source.split('.')[-1] if '.' in source else 'file'
        filename = f"{item['title']}.{extension}".replace('/', '_')
        
        mime_type, _ = mimetypes.guess_type(source)
        if not mime_type:
            mime_type = 'application/octet-stream'

        return StreamingResponse(
            io.BytesIO(file_data),
            media_type=mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        print(f"[Hub] Erro no download: {e}")
        raise HTTPException(status_code=500, detail="Erro ao processar o download do arquivo.")

class HubCheckoutRequest(BaseModel):
    content_id: str
    billingType: str  # 'PIX' | 'BOLETO' | 'CREDIT_CARD'

@router.post("/checkout")
async def hub_checkout(body: HubCheckoutRequest, user: dict = Depends(get_current_user)):
    """Cria uma cobrança avulsa no Asaas para um item do Hub."""
    db = get_client()
    username = user['username']

    # 1. Busca o conteúdo e preço
    content = db.table('premium_content').select('*').eq('id', body.content_id).single().execute()
    if not content.data:
        raise HTTPException(status_code=404, detail="Conteúdo não encontrado.")
    
    item = content.data
    value = float(item['price'])

    # 2. Busca ou cria cliente no Asaas
    from app.modules.payments.routes.asaas import _get_validated_user, _find_customer_by_document
    from app.modules.payments.services.asaas import get_customer_by_email, create_customer, update_customer, create_payment, get_pix_qr_code
    
    user_db = _get_validated_user(username)
    raw_doc = user_db['_raw_doc']
    
    customer = await get_customer_by_email(user_db['email'])
    if customer:
        customer_id = customer['id']
        if not customer.get('cpfCnpj') and raw_doc:
            await update_customer(customer_id, {'cpfCnpj': raw_doc})
    else:
        new_cust = await create_customer(
            name=user_db.get('name') or username,
            email=user_db['email'],
            cpf_cnpj=raw_doc
        )
        customer_id = new_cust['id']

    # 3. Cria o pagamento no Asaas
    from datetime import date, timedelta
    due_date = (date.today() + timedelta(days=3)).isoformat()
    
    try:
        payment = await create_payment(
            customer_id=customer_id,
            billing_type=body.billingType,
            value=value,
            due_date=due_date,
            description=f"Compra Hub: {item['title']}",
            external_reference=f"PREMIUM:{item['id']}:{username}"
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    payment_id = payment.get('id')
    invoice_url = payment.get('invoiceUrl')

    # 4. Registra a compra como 'pending' no banco usando upsert para evitar erro de chave duplicada
    try:
        db.table('premium_purchases').upsert({
            'username': username,
            'content_id': item['id'],
            'asaas_payment_id': payment_id,
            'status': 'pending'
        }, on_conflict='username,content_id').execute()
    except Exception as exc:
        # Trata condição de corrida onde outro processo já inseriu a compra
        err = str(exc).lower()
        if 'duplicate key' in err or '23505' in err:
            print(f'[Hub] Aviso: compra já existe (race): {username} - {item["id"]}')
        else:
            raise

    # 5. Busca QR Code se for PIX
    pix_qr_code = None
    pix_copy_paste = None
    if body.billingType == 'PIX':
        pix_data = await get_pix_qr_code(payment_id)
        pix_qr_code = pix_data.get('encodedImage')
        pix_copy_paste = pix_data.get('payload')

    return {
        'paymentId': payment_id,
        'invoiceUrl': invoice_url,
        'pixQrCode': pix_qr_code,
        'pixCopyPaste': pix_copy_paste,
        'value': value,
        'title': item['title']
    }
