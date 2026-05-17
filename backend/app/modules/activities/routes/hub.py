"""
routers/activities/hub.py
Gerencia o Hub de conteúdos premium (Kiwify style).
"""

from app.core.exceptions import AuthenticationRequiredError
from datetime import date, timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from app.core.database import get_client
from app.core.dependencies.auth import get_current_user, get_current_user_optional
from typing import List, Optional
from pydantic import BaseModel
from app.core.security import hash_password, generate_temp_password
from app.shared.services.document_validator import validate_document_auto
from app.shared.services.upstash import cache_delete
from app.core.exceptions import PremiumAccessDeniedError, ContentNotFoundError, AuthenticationRequiredError, InvalidDocumentError


router = APIRouter()

class PremiumContent(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    price: float
    type: str
    content_source: Optional[str] = None
    thumbnail_url: Optional[str] = None
    preview_url: Optional[str] = None
    emoji: Optional[str] = None
    category: Optional[str] = 'other'
    is_featured: Optional[bool] = False
    processing_status: Optional[str] = None
    is_active: bool = True
    has_access: bool = False

    class Config:
        extra = 'ignore'


def _hub_log(message: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    print(f"[Hub][{now}] {message}")


@router.post("/admin/reprocess/{content_id}")
async def admin_reprocess_content(content_id: str, user: dict = Depends(get_current_user)):
    """Reset processing_status e dispara reprocessamento de um material. Apenas admin."""
    if user.get('role') not in ('admin', 'programmer', 'programador'):
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")

    db = get_client()
    content = db.table('premium_content').select('*').eq('id', content_id).single().execute()
    if not content.data:
        raise ContentNotFoundError()

    item = content.data
    source = item.get('content_source', '')

    _hub_log(f"admin_reprocess_requested content_id={content_id} source={source} current_status={item.get('processing_status')}")

    if not source:
        raise HTTPException(status_code=400, detail="Material sem arquivo fonte configurado.")

    # Reseta o status
    db.table('premium_content').update({
        'processing_status': 'pending',
        'secure_pages': None,
    }).eq('id', content_id).execute()

    import asyncio

    async def _do_reprocess():
        import tempfile, os
        try:
            from app.shared.services.secure_document_service import SecureDocumentService
            svc = SecureDocumentService()

            # Baixa o PDF do Supabase Storage para um arquivo temporário
            file_bytes = db.storage.from_('module-files').download(source)
            filename = os.path.basename(source)
            suffix = os.path.splitext(filename)[1] or '.pdf'

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name

            _hub_log(f"admin_reprocess_pdf_downloaded content_id={content_id} tmp={tmp_path} size={len(file_bytes)}b")

            result = svc.secure_process_document(tmp_path, filename, content_id)

            try:
                os.unlink(tmp_path)
            except Exception:
                pass

            _hub_log(f"admin_reprocess_done content_id={content_id} result={result}")
        except Exception as e:
            _hub_log(f"admin_reprocess_error content_id={content_id} error={e}")
            db.table('premium_content').update({
                'processing_status': 'failed',
            }).eq('id', content_id).execute()

    asyncio.create_task(_do_reprocess())

    return {
        'ok': True,
        'message': f'Reprocessamento de "{item["title"]}" iniciado. Acompanhe os logs do servidor.',
        'content_id': content_id,
        'source': source,
    }


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
    from app.core.config import settings
    
    from app.shared.services.secure_document_service import public_preview_url

    for c in contents:
        if float(c.get('price') or 0) <= 0:
            continue

        from app.modules.payments.services.subscription_manager import SPECIAL_USERS
        has_access = False
        if user and username:
            has_access = (
                c['id'] in purchased_ids
                or username in SPECIAL_USERS
                or user.get('role') == 'admin'
            )

        preview_path = c.get('preview_path')
        preview_url = public_preview_url(preview_path) if preview_path else c.get('thumbnail_url')
        if preview_url and not str(preview_url).startswith('http'):
            preview_url = f"{settings.supabase_url}/storage/v1/object/public/hub-previews/{preview_url}"

        category = (c.get('category') or 'other').lower()

        result.append({
            'id': c['id'],
            'title': c['title'],
            'description': c.get('description'),
            'price': c['price'],
            'type': c.get('type', 'file'),
            'thumbnail_url': c.get('thumbnail_url'),
            'preview_url': preview_url,
            'emoji': c.get('emoji'),
            'category': category,
            'is_featured': bool(c.get('is_featured')),
            'processing_status': c.get('processing_status'),
            'is_active': c.get('is_active', True),
            'has_access': has_access,
        })

    return result

@router.get("/public", response_model=List[PremiumContent])
async def list_premium_content_public(user: Optional[dict] = Depends(get_current_user_optional)):
    """Catálogo público do hub; se autenticado, também informa acesso."""
    return await list_premium_content(user)

@router.get("/{content_id}/access")
async def get_content_access(
    content_id: str, 
    request: Request,
    user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """Retorna o link de acesso/download se o usuário tiver permissão."""
    db = get_client()
    username = user.get('username')

    # Extrai o token para passar para as URLs das páginas
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ")[1]

    # 1. Verifica se tem acesso
    from app.modules.payments.services.subscription_manager import SPECIAL_USERS
    is_special = username in SPECIAL_USERS or user.get('role') == 'admin'

    if not is_special:
        # Verifica na tabela clássica premium_purchases
        purchase = db.table('premium_purchases')\
            .select('id, status')\
            .eq('username', username)\
            .eq('content_id', content_id)\
            .eq('status', 'confirmed')\
            .execute()

        has_access = bool(purchase.data)
        _hub_log(f"access_check username={username} content_id={content_id} premium_purchases={purchase.data}")

        # Fallback: verifica nas tabelas orders + order_items (fluxo hub-site público)
        if not has_access:
            order_items = db.table('order_items')\
                .select('order_id, orders!inner(id, username, status, asaas_id)')\
                .eq('content_id', content_id)\
                .execute()

            _hub_log(f"access_check_orders username={username} content_id={content_id} order_items={order_items.data}")

            from app.modules.payments.services.asaas import get_payment_status as asaas_get_payment_status

            for oi in (order_items.data or []):
                order = oi.get('orders', {})
                if order.get('username') != username:
                    continue

                if order.get('status') == 'confirmed':
                    has_access = True
                    break

                # Se está pendente, verifica diretamente no Asaas
                if order.get('status') == 'pending' and order.get('asaas_id'):
                    try:
                        asaas_data = await asaas_get_payment_status(order['asaas_id'])
                        asaas_status = asaas_data.get('status', '') if asaas_data else ''
                        _hub_log(f"asaas_direct_check order_id={order['id']} asaas_id={order['asaas_id']} asaas_status={asaas_status}")

                        if asaas_status in ('RECEIVED', 'CONFIRMED'):
                            has_access = True
                            # Sincroniza tudo no banco
                            db.table('orders').update({
                                'status': 'confirmed',
                                'confirmed_at': datetime.now(timezone.utc).isoformat()
                            }).eq('id', order['id']).execute()

                            try:
                                db.table('premium_purchases').upsert({
                                    'username': username,
                                    'content_id': content_id,
                                    'status': 'confirmed',
                                    'asaas_payment_id': order['asaas_id'],
                                }, on_conflict='username,content_id').execute()
                            except Exception:
                                db.table('premium_purchases').insert({
                                    'username': username,
                                    'content_id': content_id,
                                    'status': 'confirmed',
                                    'asaas_payment_id': order['asaas_id'],
                                }).execute()

                            _hub_log(f"access_granted_via_asaas_direct username={username} content_id={content_id}")
                            break
                    except Exception as e:
                        _hub_log(f"asaas_direct_check ERROR: {e}")

        if not has_access:
            raise PremiumAccessDeniedError()

    # 2. Busca informações do conteúdo
    content = db.table('premium_content').select('*').eq('id', content_id).single().execute()
    if not content.data:
        raise ContentNotFoundError()

    item = content.data

    # 3. Verifica se é um documento seguro (Imagens)
    if item.get('is_secure'):
        status = item.get('processing_status', 'pending')
        if status in ('pending', 'processing'):
            raise HTTPException(
                status_code=409,
                detail="Material em processamento seguro. Por favor, aguarde alguns segundos."
            )

        if status in ('ready', 'skipped') and item.get('secure_pages'):
            pages = item['secure_pages']
            secure_urls = []
            external_links = []
            
            # Detecta e extrai metadata escondido no array (hack inteligente para evitar alteração de DB)
            if pages and isinstance(pages[-1], str) and pages[-1].startswith('{"external_links"'):
                import json
                try:
                    meta = json.loads(pages.pop())
                    external_links = meta.get("external_links", [])
                except:
                    pass

            # Detecta a base URL da requisição atual para montar o link completo
            api_base = str(request.base_url).rstrip('/')
            # Removido /api pois o servidor Python não usa esse prefixo nas rotas

            for i in range(len(pages)):
                token_suffix = f"?token={raw_token}" if raw_token else ""
                secure_urls.append(f"{api_base}/activities/hub/{content_id}/pages/{i}{token_suffix}")

            return {
                "type": "secure_images",
                "pages": secure_urls,
                "total_pages": len(secure_urls),
                "is_secure_viewer": True,
                "title": item.get('title'),
                "external_links": external_links
            }

    # 4. Caso contrário, fluxo antigo (Link direto ou Signed URL)
    source = item['content_source']
    if source and not source.startswith('http'):
        from app.core.config import settings
        # Gera Signed URL em vez de link público direto
        res = db.storage.from_('module-files').create_signed_url(source, 900)
        source = res['signedURL']

    return {"url": source, "type": "direct"}

import asyncio
from starlette.concurrency import run_in_threadpool

# Cache global em memória para imagens brutas (evita baixar do Supabase toda hora)
_RAW_IMAGE_CACHE = {}

@router.get("/{content_id}/pages/{page_index}")
async def get_secure_page(
    content_id: str, 
    page_index: int, 
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Retorna a página de um documento seguro com marca d'água do email (Alta Performance)."""
    db = get_client()
    user = None
    
    # 1. Autenticação rápida
    final_token = token
    if not final_token and authorization and authorization.startswith("Bearer "):
        final_token = authorization.split(" ")[1]
    
    if final_token:
        from app.core.security import decode_token
        payload = decode_token(final_token)
        if payload:
            username = payload['sub']
            # Cache de usuários pode ser feito aqui futuramente, por enquanto query rápida
            rows = db.table('users').select('username, email, role').eq('username', username).execute()
            if rows.data:
                user = rows.data[0]
    
    if not user:
        raise AuthenticationRequiredError()

    username = user.get('username')
    email = user.get('email') or username

    # 2. Verifica se tem acesso
    from app.modules.payments.services.subscription_manager import SPECIAL_USERS
    is_special = username in SPECIAL_USERS or user.get('role') == 'admin'
    
    if not is_special:
        purchase = db.table('premium_purchases').select('id').eq('username', username).eq('content_id', content_id).eq('status', 'confirmed').execute()
        if not purchase.data:
            raise PremiumAccessDeniedError()

    # 3. Busca informações do conteúdo
    content = db.table('premium_content').select('secure_pages').eq('id', content_id).single().execute()
    if not content.data or not content.data.get('secure_pages'):
        raise ContentNotFoundError()
    
    pages = content.data['secure_pages']
    
    # Remove metadata oculto da contagem
    if pages and isinstance(pages[-1], str) and pages[-1].startswith('{"'):
        pages = pages[:-1]

    if page_index < 0 or page_index >= len(pages):
        raise HTTPException(status_code=404, detail="Página não encontrada")
        
    storage_path = pages[page_index]
    
    # 4. Baixa a imagem do Supabase usando CACHE em RAM (Acelera 1000x)
    file_data = _RAW_IMAGE_CACHE.get(storage_path)
    
    if not file_data:
        try:
            # Roda download em threadpool para não congelar o servidor
            file_data = await run_in_threadpool(db.storage.from_('hub-secure-pages').download, storage_path)
            # Limita tamanho do cache para não estourar memória (max ~500 imagens de 500kb = 250MB)
            if len(_RAW_IMAGE_CACHE) > 500:
                _RAW_IMAGE_CACHE.pop(next(iter(_RAW_IMAGE_CACHE)))
            _RAW_IMAGE_CACHE[storage_path] = file_data
        except Exception as e:
            print(f"[Hub] Erro ao baixar página {storage_path}: {e}")
            raise HTTPException(status_code=500, detail="Erro ao processar imagem")
        
    # 5. Aplica a marca d'água de forma assíncrona para não travar outras requisições
    from app.shared.services.secure_document_service import apply_watermark
    from fastapi.responses import Response
    
    watermarked_image = await run_in_threadpool(apply_watermark, file_data, email)
    
    return Response(content=watermarked_image, media_type="image/webp")

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
        raise AuthenticationRequiredError()

    username = user.get('username')

    # 1. Verifica se tem acesso
    from app.modules.payments.services.subscription_manager import SPECIAL_USERS
    is_special = username in SPECIAL_USERS or user.get('role') == 'admin'
    
    if not is_special:
        purchase = db.table('premium_purchases').select('id').eq('username', username).eq('content_id', content_id).eq('status', 'confirmed').execute()
        if not purchase.data:
            raise PremiumAccessDeniedError()

    # 2. Busca informações do conteúdo
    content = db.table('premium_content').select('*').eq('id', content_id).single().execute()
    if not content.data:
        raise ContentNotFoundError()
    
    item = content.data

    if item.get('is_secure'):
        raise HTTPException(
            status_code=403,
            detail='Download desativado. Use o visualizador seguro no navegador.',
        )

    source = item['content_source']

    if not source:
        raise ContentNotFoundError()

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
        raise InvalidDocumentError(detail=f'Documento inválido: {validation["message"]}')

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
        raise ContentNotFoundError("Conteúdo não encontrado.")

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
        raise InvalidDocumentError(detail="CPF/CNPJ inválido.")

    username = _get_or_create_guest_user(body.name, body.email, raw_doc)
    _hub_log(f"guest_checkout_start username={username} content_id={body.content_id} billingType={body.billingType}")

    content = db.table('premium_content').select('*').eq('id', body.content_id).single().execute()
    if not content.data:
        raise ContentNotFoundError("Conteúdo não encontrado.")
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
        raise ContentNotFoundError("Pagamento não encontrado.")

    payment_data = await _sync_premium_purchase_payment(payment_id, user['username'])
    if not payment_data:
        raise ContentNotFoundError("Pagamento não encontrado no Asaas.")

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
