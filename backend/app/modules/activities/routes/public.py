import logging
from fastapi import Depends, APIRouter, HTTPException
from typing import List
from pydantic import BaseModel, EmailStr
from app.modules.activities.services.premium_service import PremiumService
from app.modules.activities.schema.premium import PremiumContentPublic, HubOrderPublic
from app.core.database import get_client
from app.core.security import hash_password
from app.core.dependencies.auth import get_current_user
from datetime import datetime, timezone, date, timedelta
from app.core.dependencies.auth import get_current_user, get_current_user_optional
from typing import Optional

router = APIRouter()


class CheckoutRequest(BaseModel):
    content_id: str
    name: str
    email: EmailStr
    cpf: str
    billingType: str


@router.get("", response_model=List[PremiumContentPublic])
async def list_premium_content(
    service: PremiumService = Depends()
):
    """Lista todo o conteúdo premium disponível para compra (não requer login)."""
    return await service.list_public_catalog()


@router.get("/orders", response_model=List[HubOrderPublic])
async def list_my_orders(
    user: dict = Depends(get_current_user),
    service: PremiumService = Depends(),
):
    """Lista pedidos do usuário autenticado no hub-site."""
    return await service.list_user_orders(user.get('username'))


@router.post("/checkout")
async def public_checkout(
    body: CheckoutRequest,
    service: PremiumService = Depends(),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Fluxo de checkout para visitantes:
    1. Busca ou Cria usuário com role 'buyer'
    2. Cria pedido nas tabelas 'orders' e 'order_items'
    3. Gera cobrança no Asaas
    """
    db = get_client()
    clean_email = body.email.strip().lower()
    raw_doc = "".join(filter(str.isdigit, body.cpf))

    temp_pass = None
    existing = db.table('users').select('username').eq(
        'email', clean_email).execute().data
    if existing:
        username = existing[0]['username']
        db.table('users').update({'cpf': raw_doc, 'cpf_cnpj': raw_doc}).eq(
            'username', username).execute()
    else:
        import random
        base_user = clean_email.split('@')[0]
        username = f"hub_{base_user}_{
            datetime.now().strftime('%H%M%S')}"
        clean_prefix = "".join(
            filter(
                str.isalnum,
                base_user))[
            :3].lower()
        random_suffix = "".join(
            [str(random.randint(0, 9)) for _ in range(4)])
        temp_pass = f"{clean_prefix}{random_suffix}"

        db.table('users').insert({
            'username': username,
            'name': body.name,
            'email': clean_email,
            'password': hash_password(temp_pass),
            'role': 'buyer',
            'cpf': raw_doc,
            'cpf_cnpj': raw_doc,
            'created_at': datetime.now(timezone.utc).isoformat()
        }).execute()

        from app.shared.services.email import EmailSender
        try:
            EmailSender().send_welcome_hub_email(
                to_email=clean_email,
                name=body.name,
                username=username,
                password=temp_pass
            )
        except Exception as e:
            logging.info(f"Erro ao enviar e-mail de boas-vindas: {e}")

    item = await service.get_public_item(body.content_id)
    if not item:
        raise HTTPException(
            status_code=404,
            detail="Material não encontrado")

    from app.modules.payments.services.asaas import (
        create_customer,
        create_payment,
        get_customer_by_email,
        get_pix_qr_code,
    )

    customer = await get_customer_by_email(clean_email)
    if not customer:
        customer = await create_customer(name=body.name, email=clean_email, cpf_cnpj=raw_doc)
    customer_id = customer['id']

    # Determina o role do usuário para decidir o preço.
    # Primeiro verifica o token (se estiver logado no hub). 
    # Se não, verifica se o e-mail já existe no banco.
    user_role = 'buyer'
    if current_user and current_user.get('role'):
        user_role = current_user.get('role')
    elif existing:
        # Precisamos buscar a role do usuário existente
        existing_full = db.table('users').select('role').eq('username', username).execute().data
        if existing_full and existing_full[0].get('role'):
            user_role = existing_full[0].get('role')

    # Alunos, professores e admins ganham o preço de estudante
    if user_role != 'buyer':
        resolved_price = float(
            item.get('price_students') or item.get('price') or 0)
    else:
        resolved_price = float(
            item.get('price_buyers') or item.get('price') or 0)

    if resolved_price <= 0:
        raise HTTPException(
            status_code=400,
            detail="Este material não possui preço configurado para compra.")

    due_date = (date.today() + timedelta(days=3)).isoformat()
    logging.info(
        f"[Checkout] billingType={
            body.billingType} customer_id={customer_id} value={resolved_price}")
    try:
        payment = await create_payment(
            customer_id=customer_id,
            billing_type=body.billingType,
            value=resolved_price,
            due_date=due_date,
            description=f"Material: {item['title']}",
            external_reference=f"HUB:{item['id']}:{username}"
        )
    except Exception as exc:
        err_str = str(exc)
        # Mensagens amigáveis para erros conhecidos do Asaas
        if 'invalid_billingType' in err_str or 'Pix não está disponível' in err_str:
            raise HTTPException(
                status_code=422,
                detail="Pagamento via Pix não está disponível no momento. Por favor, escolha Boleto ou Cartão de Crédito."
            )
        if 'invalid_environment' in err_str:
            raise HTTPException(
                status_code=503,
                detail="Serviço de pagamento temporariamente indisponível. Tente novamente em instantes."
            )
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao processar pagamento: {err_str}")

    payment_id = payment.get('id')

    order_res = db.table('orders').insert({
        'username': username,
        'total_amount': resolved_price,
        'status': 'pending',
        'asaas_id': payment_id,
        'payment_method': body.billingType
    }).execute()

    order_id = order_res.data[0]['id']

    db.table('order_items').insert({
        'order_id': order_id,
        'content_id': item['id'],
        'price': resolved_price
    }).execute()

    pix_data = {}
    if body.billingType == 'PIX':
        pix_res = await get_pix_qr_code(payment_id)
        pix_data = {
            'qrCode': pix_res.get('encodedImage'),
            'copyPaste': pix_res.get('payload')
        }

    return {
        'orderId': order_id,
        'paymentId': payment_id,
        'invoiceUrl': payment.get('invoiceUrl') or payment.get('paymentUrl'),
        'pix': pix_data if body.billingType == 'PIX' else None,
        'username': username,
        'password': temp_pass}


@router.get("/{item_id}", response_model=PremiumContentPublic)
async def get_catalog_item(
        item_id: str,
        service: PremiumService = Depends()):
    """Retorna detalhes de um item específico do catálogo."""
    item = await service.get_public_item(item_id)
    if not item:
        raise HTTPException(
            status_code=404,
            detail="Material não encontrado")
    return item


@router.post("/checkout/{payment_id}/cancel")
async def cancel_checkout(payment_id: str):
    """
    Cancela um pedido pendente identificado pelo payment_id do Asaas.
    Não requer autenticação pois o visitante pode não estar logado.
    """
    db = get_client()

    # Verifica se o pedido existe e está pendente
    order = db.table('orders').select('id, status').eq(
        'asaas_id', payment_id).execute().data
    if not order:
        raise HTTPException(
            status_code=404,
            detail="Pedido não encontrado.")

    if order[0]['status'] not in ('pending',):
        raise HTTPException(
            status_code=409,
            detail=f"Pedido não pode ser cancelado (status: {
                order[0]['status']}).")

    # Cancela no Asaas
    try:
        from app.modules.payments.services.asaas import cancel_payment
        await cancel_payment(payment_id)
    except Exception as e:
        logging.info(
            f"[CancelCheckout] Aviso: erro ao cancelar no Asaas: {e}")

    # Atualiza status no banco
    db.table('orders').update({'status': 'cancelled'}).eq(
        'asaas_id', payment_id).execute()
    db.table('premium_purchases').update({'status': 'cancelled'}).eq(
        'asaas_payment_id', payment_id).execute()

    return {'ok': True, 'message': 'Pedido cancelado com sucesso.'}
