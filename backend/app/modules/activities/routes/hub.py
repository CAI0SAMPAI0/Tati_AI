"""
routers/activities/hub.py
Gerencia o Hub de conteúdos premium (Kiwify style).
"""

from datetime import date, timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from app.core.database import get_client
from app.core.dependencies.auth import get_current_user, get_current_user_optional
from typing import List, Optional
from pydantic import BaseModel
from app.core.security import hash_password, generate_temp_password
from app.shared.services.document_validator import validate_document_auto
from app.shared.services.upstash import cache_delete

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


def _hub_log(message: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    print(f"[Hub][{now}] {message}")


@router.get("", response_model=List[PremiumContent])
async def list_premium_content(user: Optional[dict] = Depends(get_current_user_optional)):
    """Lista todos os conteúdos premium disponíveis e indica se o usuário já comprou."""
    db = get_client()
    username = user.get('username') if user else None

    # 1. Busca conteúdos ativos
    contents_res = db.table('premium_content').select('*').eq('is_active', True).execute()
    contents = contents_res.data or []

    # 2. Busca compras do usuário
    purchases_data = []
    if username:
        purchases_res = db.table('premium_purchases').select('id, content_id, asaas_payment_id, status').eq('username', username).execute()
        purchases_data = purchases_res.data or []
    
    # 2.1 Verifica em tempo real os pagamentos pendentes no Asaas
    purchased_ids = set()
    from app.modules.payments.services.asaas import get_payment
    import asyncio
    
    tasks = []
    for p in purchases_data:
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
        has_access = False
        if user and username:
            has_access = c['id'] in purchased_ids or username in SPECIAL_USERS or user.get('role') == 'admin'
        
        result.append({
            **c,
            "has_access": has_access
        })

    return result

@router.get("/public", response_model=List[PremiumContent])
async def list_premium_content_public(user: Optional[dict] = Depends(get_current_user_optional)):
    """Catálogo público do hub; se autenticado, também informa acesso."""
    return await list_premium_content(user)

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
        
        # Define o nome do arquivo
        extension = source.split('.')[-1] if '.' in source else 'file'
        # filename = f"{item['title']}.{extension}".replace('/', '_')
        
        # NOME SEGURO
        
        import re
        import unicodedata

        def sanitize_filename(value: str) -> str:
            value = unicodedata.normalize("NFKD", value)
            value = value.encode("ascii", "ignore").decode("ascii")
            value = re.sub(r'[^\w\s-]', '', value)
            value = re.sub(r'[-\s]+', '_', value).strip('_')
            return value

        safe_title = sanitize_filename(item['title'])
        filename = f"{safe_title}.{extension}"
        
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
    cpf: Optional[str] = None


class GuestCheckoutRequest(BaseModel):
    content_id: str
    billingType: str
    name: str
    email: str
    cpf: str


class PaymentStatusResponse(BaseModel):
    paymentId: str
    status: str
    billingType: Optional[str] = None
    invoiceUrl: Optional[str] = None
    pixQrCode: Optional[str] = None
    pixCopyPaste: Optional[str] = None
    raw: Optional[dict] = None


def _normalize_document(value: str) -> str:
    return ''.join(ch for ch in str(value or '') if ch.isdigit())


async def _persist_user_document(username: str, cpf: str) -> str:
    raw_doc = _normalize_document(cpf)
    if not raw_doc:
        return ''

    validation = validate_document_auto(raw_doc)
    if not validation['valid']:
        raise HTTPException(status_code=400, detail=f'Documento inválido: {validation["message"]}')

    formatted = validation.get('formatted') or raw_doc
    db = get_client()
    db.table('users').update({'cpf': formatted, 'cpf_cnpj': formatted}).eq('username', username).execute()
    await cache_delete(f'profile:{username}')
    return raw_doc


async def _sync_premium_purchase_payment(payment_id: str, username: str) -> dict | None:
    from app.modules.payments.services.asaas import get_payment, get_pix_qr_code

    db = get_client()
    purchase = (
        db.table('premium_purchases')
        .select('id, content_id, status')
        .eq('asaas_payment_id', payment_id)
        .eq('username', username)
        .limit(1)
        .execute()
        .data
    )
    if not purchase:
        return None

    payment_data = await get_payment(payment_id)
    if not payment_data:
        return None

    status = str(payment_data.get('status') or '').upper()
    if status in ('RECEIVED', 'CONFIRMED'):
        db.table('premium_purchases').update({'status': 'confirmed'}).eq('id', purchase[0]['id']).execute()
        content_id = purchase[0]['content_id']
        _hub_log(f'premium_purchase_confirmed username={username} content_id={content_id} payment_id={payment_id}')

    if str(payment_data.get('billingType') or '').upper() == 'PIX':
        pix_data = await get_pix_qr_code(payment_id)
        payment_data['_pixQrCode'] = pix_data.get('encodedImage')
        payment_data['_pixCopyPaste'] = pix_data.get('payload')

    return payment_data


def _resolve_checkout_url(payment: dict | None) -> Optional[str]:
    if not payment:
        return None
    return (
        payment.get('invoiceUrl')
        or payment.get('bankSlipUrl')
        or payment.get('paymentUrl')
        or payment.get('url')
    )


def _generate_guest_username(email: str) -> str:
    base = email.split('@')[0].strip().lower().replace('.', '_')
    base = ''.join(ch for ch in base if ch.isalnum() or ch == '_')
    return f"guest_{base}"[:35]


def _get_or_create_guest_user(name: str, email: str, cpf: str) -> str:
    db = get_client()
    clean_email = email.strip().lower()
    raw_doc = _normalize_document(cpf)
    existing = (
        db.table('users')
        .select('username')
        .eq('email', clean_email)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        username = existing[0]['username']
        db.table('users').update({'cpf': raw_doc, 'cpf_cnpj': raw_doc}).eq('username', username).execute()
        return username

    username = _generate_guest_username(clean_email)
    suffix = 1
    while (
        db.table('users').select('username').eq('username', username).limit(1).execute().data
    ):
        suffix += 1
        username = f"{_generate_guest_username(clean_email)}_{suffix}"[:35]

    temp_password = generate_temp_password()
    db.table('users').insert(
        {
            'username': username,
            'name': name.strip(),
            'email': clean_email,
            'password': hash_password(temp_password),
            'temp_password': hash_password(temp_password),
            'role': 'student',
            'level': 'Beginner',
            'focus': 'General Conversation',
            'cpf': raw_doc,
            'cpf_cnpj': raw_doc,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'is_premium_active': False,
        }
    ).execute()
    _hub_log(f"guest_user_created username={username} email={clean_email}")
    return username

@router.post("/checkout")
async def hub_checkout(body: HubCheckoutRequest, user: dict = Depends(get_current_user)):
    """Cria uma cobrança avulsa no Asaas para um item do Hub."""
    db = get_client()
    username = user['username']

    content = db.table('premium_content').select('*').eq('id', body.content_id).single().execute()
    if not content.data:
        raise HTTPException(status_code=404, detail='Conteúdo não encontrado.')

    item = content.data
    value = float(item['price'])

    from app.modules.payments.routes.asaas import _get_validated_user
    from app.modules.payments.services.asaas import (
        create_customer,
        create_payment,
        get_customer_by_email,
        get_pix_qr_code,
        update_customer,
    )

    if body.cpf:
        await _persist_user_document(username, body.cpf)

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
            cpf_cnpj=raw_doc,
        )
        customer_id = new_cust['id']

    due_date = (date.today() + timedelta(days=3)).isoformat()
    try:
        payment = await create_payment(
            customer_id=customer_id,
            billing_type=body.billingType,
            value=value,
            due_date=due_date,
            description=f"Compra Hub: {item['title']}",
            external_reference=f"PREMIUM:{item['id']}:{username}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    payment_id = payment.get('id')
    invoice_url = _resolve_checkout_url(payment)

    try:
        db.table('premium_purchases').upsert(
            {
                'username': username,
                'content_id': item['id'],
                'asaas_payment_id': payment_id,
                'status': 'pending',
            },
            on_conflict='username,content_id',
        ).execute()
    except Exception as exc:
        err = str(exc).lower()
        if 'duplicate key' in err or '23505' in err:
            print(f'[Hub] Aviso: compra já existe (race): {username} - {item["id"]}')
        else:
            raise

    pix_qr_code = None
    pix_copy_paste = None
    if body.billingType == 'PIX' and payment_id:
        pix_data = await get_pix_qr_code(payment_id)
        pix_qr_code = pix_data.get('encodedImage')
        pix_copy_paste = pix_data.get('payload')

    return {
        'paymentId': payment_id,
        'invoiceUrl': invoice_url,
        'pixQrCode': pix_qr_code,
        'pixCopyPaste': pix_copy_paste,
        'value': value,
        'title': item['title'],
    }


@router.post("/checkout/guest")
async def hub_checkout_guest(body: GuestCheckoutRequest):
    """Checkout de visitante para compra no hub público."""
    db = get_client()
    raw_doc = _normalize_document(body.cpf)
    if len(raw_doc) not in (11, 14):
        raise HTTPException(status_code=400, detail='CPF/CNPJ inválido.')

    username = _get_or_create_guest_user(body.name, body.email, raw_doc)
    _hub_log(f"guest_checkout_start username={username} content_id={body.content_id} billingType={body.billingType}")

    content = db.table('premium_content').select('*').eq('id', body.content_id).single().execute()
    if not content.data:
        raise HTTPException(status_code=404, detail='Conteúdo não encontrado.')
    item = content.data
    value = float(item['price'])

    from app.modules.payments.services.asaas import (
        create_customer,
        create_payment,
        get_customer_by_email,
        get_pix_qr_code,
        update_customer,
    )

    customer = await get_customer_by_email(body.email.strip().lower())
    if customer:
        customer_id = customer['id']
        if not customer.get('cpfCnpj'):
            await update_customer(customer_id, {'cpfCnpj': raw_doc})
    else:
        new_cust = await create_customer(
            name=body.name.strip(),
            email=body.email.strip().lower(),
            cpf_cnpj=raw_doc,
        )
        customer_id = new_cust['id']

    due_date = (date.today() + timedelta(days=3)).isoformat()
    payment = await create_payment(
        customer_id=customer_id,
        billing_type=body.billingType,
        value=value,
        due_date=due_date,
        description=f"Compra Hub: {item['title']}",
        external_reference=f"PREMIUM:{item['id']}:{username}",
    )
    payment_id = payment.get('id')
    invoice_url = _resolve_checkout_url(payment)

    db.table('premium_purchases').upsert(
        {
            'username': username,
            'content_id': item['id'],
            'asaas_payment_id': payment_id,
            'status': 'pending',
        },
        on_conflict='username,content_id',
    ).execute()
    _hub_log(f"guest_checkout_created username={username} content_id={item['id']} payment_id={payment_id}")

    pix_qr_code = None
    pix_copy_paste = None
    if body.billingType == 'PIX' and payment_id:
        pix_data = await get_pix_qr_code(payment_id)
        pix_qr_code = pix_data.get('encodedImage')
        pix_copy_paste = pix_data.get('payload')

    return {
        'paymentId': payment_id,
        'invoiceUrl': invoice_url,
        'pixQrCode': pix_qr_code,
        'pixCopyPaste': pix_copy_paste,
        'value': value,
        'title': item['title'],
        'username': username,
    }


@router.get("/payment-status/{payment_id}", response_model=PaymentStatusResponse)
async def hub_payment_status(payment_id: str, user: dict = Depends(get_current_user)):
    """Consulta o status de um pagamento do hub e sincroniza a compra quando confirmado."""
    db = get_client()
    purchase = (
        db.table('premium_purchases')
        .select('username, content_id, status')
        .eq('asaas_payment_id', payment_id)
        .eq('username', user['username'])
        .limit(1)
        .execute()
        .data
    )

    if not purchase:
        raise HTTPException(status_code=404, detail='Pagamento não encontrado.')

    payment_data = await _sync_premium_purchase_payment(payment_id, user['username'])
    if not payment_data:
        raise HTTPException(status_code=404, detail='Pagamento não encontrado no Asaas.')

    checkout_url = (
        payment_data.get('invoiceUrl')
        or payment_data.get('bankSlipUrl')
        or payment_data.get('paymentUrl')
        or payment_data.get('url')
    )

    return {
        'paymentId': payment_id,
        'status': str(payment_data.get('status') or 'PENDING').lower(),
        'billingType': payment_data.get('billingType'),
        'invoiceUrl': checkout_url,
        'pixQrCode': payment_data.get('_pixQrCode'),
        'pixCopyPaste': payment_data.get('_pixCopyPaste'),
        'raw': payment_data,
    }
