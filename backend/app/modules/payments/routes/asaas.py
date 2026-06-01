import logging
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.exceptions import PremiumAccessDeniedError, ContentNotFoundError, BusinessLogicError, UserNotFoundError
from pydantic import BaseModel

from app.core.config import settings
from app.core.dependencies.auth import get_current_user
from app.modules.users.routes.permissions import PAID_START, calc_due_date
from app.modules.payments.services.asaas import (
    cancel_payment,
    cancel_subscription,
    create_customer,
    create_subscription,
    get_customer_by_email,
    get_payment_status,
    get_pix_qr_code,
    get_subscription_payments,
    update_customer,
    update_subscription_due_day,
)
from app.core.database import get_client
from app.shared.services.document_validator import validate_document_auto
from app.modules.payments.services.subscription_manager import (
    SPECIAL_USERS,
    activate_subscription,
    expire_by_subscription_id,
)
from app.modules.payments.services.payment_notifier import payment_notifier
from fastapi import WebSocket, WebSocketDisconnect, Query

router = APIRouter()


def _pay_log(message: str) -> None:
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    logging.info(f"[Payments][{now}] {message}")


def _is_webhook_event_already_processed(event_key: str) -> bool:
    db = get_client()
    try:
        row = (
            db.table('payment_webhook_events')
            .select('event_key')
            .eq('event_key', event_key)
            .limit(1)
            .execute()
            .data
        )
        return bool(row)
    except Exception:
        # Fallback: se tabela não existir, seguimos sem bloqueio global
        return False


def _mark_webhook_event_processed(
        event_key: str,
        payload: dict) -> None:
    db = get_client()
    try:
        db.table('payment_webhook_events').insert(
            {'event_key': event_key, 'payload': payload}
        ).execute()
    except Exception:
        # Tabela pode não existir em alguns ambientes.
        pass


@router.websocket('/ws')
async def payment_ws(
    websocket: WebSocket,
    token: str | None = Query(None)
):
    """WebSocket para acompanhar o status do pagamento em tempo real."""
    from app.core.security import decode_token

    payload = decode_token(token) if token else None
    if not payload:
        await websocket.close(code=4001, reason='Token inválido')
        return

    username = payload['sub']
    await payment_notifier.connect(websocket, username)

    try:
        while True:
            # Mantém a conexão aberta e responde a pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        payment_notifier.disconnect(websocket, username)
    except Exception:
        payment_notifier.disconnect(websocket, username)


# ── Models ────────────────────────────────────────────────────────────


class SubscribeRequest(BaseModel):
    billingType: str  # 'PIX' | 'BOLETO' | 'CREDIT_CARD'
    planType: str = 'basic'  # 'basic' | 'full'


class ChangeDueDateRequest(BaseModel):
    preferred_day: int  # 1–28


# ── Helpers ───────────────────────────────────────────────────────────


async def _find_customer_by_document(doc: str) -> dict | None:
    """Busca customer Asaas pelo documento (CPF/CNPJ)."""
    from app.modules.payments.services.asaas import get_base_url, get_headers
    import httpx

    url = f'{get_base_url()}/customers'
    params = {}
    if len(doc) == 11:
        params['cpf'] = doc
    else:
        params['cnpj'] = doc
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url, params=params, headers=get_headers(), timeout=15
            )
            resp.raise_for_status()
            data = resp.json()
            return data['data'][0] if data.get('data') else None
    except Exception:
        return None


def _get_validated_user(username: str) -> dict:
    """Busca e valida dados do usuário necessários para pagamento."""
    db = get_client()
    try:
        user_db = (
            db.table('users')
            .select('email, name, username, cpf, cpf_cnpj, phone, preferred_due_day')
            .eq('username', username)
            .single()
            .execute()
            .data
        )
    except Exception:
        user_db = (
            db.table('users')
            .select('email, name, username, cpf, cpf_cnpj, preferred_due_day')
            .eq('username', username)
            .single()
            .execute()
            .data
        )

    if not user_db:
        raise UserNotFoundError(detail='Usuário não encontrado.')

    if not user_db.get('email'):
        raise BusinessLogicError(
            detail='Usuário não possui e-mail cadastrado.')

    # if user_db.get('username') in SPECIAL_USERS:
    #     raise HTTPException(
    #         status_code=403, detail='Usuários especiais têm acesso gratuito.'
    #     )

    raw_doc = (
        str(user_db.get('cpf') or user_db.get('cpf_cnpj') or '')
        .replace('.', '')
        .replace('-', '')
        .replace('/', '')
        .strip()
    )

    if not raw_doc:
        raise BusinessLogicError(
            detail='CPF/CNPJ é obrigatório. Por favor, preencha no seu perfil.',)

    validation = validate_document_auto(raw_doc)
    if not validation['valid']:
        raise BusinessLogicError(
            detail=f'Documento inválido: {validation["message"]}')

    user_db['_raw_doc'] = raw_doc
    return user_db


# Funções de subscription agora estão em services/subscription_manager.py
# Importadas no topo: activate_subscription, expire_by_subscription_id,
# activate_special_user


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post('/subscribe')
async def subscribe(
    body: SubscribeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Cria uma assinatura recorrente mensal no Asaas.
    O valor vem do banco (tabela plans) — nunca do frontend.
    Retorna o invoiceUrl para redirecionar o aluno ao checkout do Asaas.
    """
    db = get_client()

    username = current_user['username']
    if username not in SPECIAL_USERS:
        if date.today() < PAID_START:
            raise PremiumAccessDeniedError(
                detail='Planos e pagamentos só estarão disponíveis a partir de 30/06/2026.',)

    # 1. Busca o plano no banco — o valor vem daqui, nunca do frontend
    plan = (
        db.table('plans')
        .select('*')
        .eq('id', body.planType)
        .eq('is_active', True)
        .execute()
        .data
    )
    if not plan:
        raise ContentNotFoundError(
            detail='Plano não encontrado ou indisponível.')
    plan = plan[0]
    value = float(plan['price'])

    # 2. Valida usuário (CPF, email, não é especial)
    user_db = _get_validated_user(current_user['username'])
    username = user_db['username']
    raw_doc = user_db['_raw_doc']
    phone = ''.join(
        filter(
            str.isdigit, str(
                user_db.get('phone') or '')))
    phone = phone if len(phone) >= 10 else None

    # 3. Busca ou cria customer no Asaas
    customer = await get_customer_by_email(user_db['email'])
    if customer:
        customer_id = customer['id']
        if not customer.get('cpfCnpj') and raw_doc:
            await update_customer(customer_id, {'cpfCnpj': raw_doc})
    else:
        try:
            new_cust = await create_customer(
                name=user_db.get('name') or username,
                email=user_db['email'],
                cpf_cnpj=raw_doc,
                phone=phone,
            )
            customer_id = new_cust['id']
        except Exception as exc:
            err_str = str(exc)
            if (
                'já cadastrado' in err_str
                or 'already been taken' in err_str
                or 'duplicate' in err_str.lower()
            ):
                customer_by_doc = await _find_customer_by_document(raw_doc)
                if customer_by_doc:
                    customer_id = customer_by_doc['id']
                else:
                    raise HTTPException(
                        status_code=409,
                        detail='Documento já cadastrado no sistema de pagamento. Use outro CPF/CNPJ ou entre em contato.',
                    )
            else:
                raise HTTPException(status_code=500, detail=err_str)

    # 4. Calcula data do primeiro vencimento
    preferred_day = user_db.get('preferred_due_day') or 5
    next_due_date = calc_due_date(
        date.today(), preferred_day).isoformat()

    # 5. Cria assinatura recorrente no Asaas
    try:
        subscription = await create_subscription(
            customer_id=customer_id,
            billing_type=body.billingType,
            value=value,
            next_due_date=next_due_date,
            description=plan.get('description')
            or f'Assinatura Teacher Tati — {plan["name"]}',
            external_reference=f'{username}|{body.planType}',
        )
    except Exception as exc:
        err_str = str(exc)
        if body.billingType == 'PIX' and (
            'duplicate' in err_str.lower() or 'já' in err_str.lower()
        ):
            raise HTTPException(
                status_code=409,
                detail='Este pagamento PIX já foi gerado. Tente outra forma de pagamento (boleto ou cartão).',
            )
        raise HTTPException(status_code=500, detail=err_str)

    subscription_id = subscription.get('id')

    # 6. Busca o primeiro payment gerado pela subscription
    # O invoiceUrl e QR Code ficam no payment, não na subscription
    first_payment = None
    invoice_url = subscription.get('invoiceUrl')
    first_payment_id = None

    try:
        payments = await get_subscription_payments(subscription_id)
        if payments:
            first_payment = payments[0]
            first_payment_id = first_payment.get('id')
            invoice_url = first_payment.get('invoiceUrl') or invoice_url
    except Exception as e:
        logging.info(
            f'[Subscribe] Aviso: não foi possível buscar payment da subscription: {e}')

    # 7. Salva no banco como 'pending' — webhook vai ativar
    db.table('subscriptions').insert(
        {
            'username': username,
            'plan_type': body.planType,
            'status': 'pending',
            'payment_id': first_payment_id or subscription_id,
            'asaas_subscription_id': subscription_id,
            'preferred_due_day': preferred_day,
            'expires_at': next_due_date,
        }
    ).execute()

    # 8. Busca QR Code PIX se necessário
    pix_qr_code = None
    pix_copy_paste = None
    if body.billingType == 'PIX' and first_payment_id:
        try:
            pix_data = await get_pix_qr_code(first_payment_id)
            pix_qr_code = pix_data.get('encodedImage')
            pix_copy_paste = pix_data.get('payload')
        except Exception as e:
            logging.info(
                f'[Subscribe] Aviso: erro ao buscar QR Code PIX: {e}')

    # 9. Retorna dados para o frontend
    return {
        'subscriptionId': subscription_id,
        'paymentId': first_payment_id,
        'invoiceUrl': invoice_url,
        'pixQrCode': pix_qr_code,
        'pixCopyPaste': pix_copy_paste,
        'dueDate': next_due_date,
        'value': value,
        'planName': plan['name'],
    }


@router.post('/cancel')
async def cancel(current_user: dict = Depends(get_current_user)):
    """Cancela a assinatura ativa do usuário."""
    db = get_client()
    sub = (
        db.table('subscriptions')
        .select('asaas_subscription_id, status')
        .eq('username', current_user['username'])
        .in_('status', ['active', 'pending', 'grace'])
        .order('created_at', desc=True)
        .limit(1)
        .execute()
        .data
    )

    if not sub:
        raise ContentNotFoundError(
            detail='Nenhuma assinatura ativa encontrada.')

    asaas_id = sub[0].get('asaas_subscription_id')

    # Cancela no Asaas
    if asaas_id and not asaas_id.startswith('special_'):
        await cancel_subscription(asaas_id)

    # Atualiza no banco
    db.table('subscriptions').update({'status': 'cancelled'}).eq(
        'username', current_user['username']
    ).in_('status', ['active', 'pending', 'grace']).execute()

    db.table('users').update(
        {
            'is_premium_active': False,
            'plan_type': None,
        }
    ).eq('username', current_user['username']).execute()

    return {'ok': True, 'message': 'Assinatura cancelada com sucesso.'}


@router.post('/change-due-date')
async def change_due_date(
    body: ChangeDueDateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Troca o dia de vencimento da assinatura no banco e no Asaas."""
    if not (1 <= body.preferred_day <= 28):
        raise BusinessLogicError(detail='Dia deve ser entre 1 e 28.')

    db = get_client()
    sub = (
        db.table('subscriptions')
        .select('asaas_subscription_id')
        .eq('username', current_user['username'])
        .in_('status', ['active', 'grace'])
        .order('created_at', desc=True)
        .limit(1)
        .execute()
        .data
    )

    if not sub:
        raise ContentNotFoundError(
            detail='Nenhuma assinatura ativa encontrada.')

    new_due = calc_due_date(date.today(), body.preferred_day)
    asaas_id = sub[0].get('asaas_subscription_id')

    # Atualiza no Asaas
    if asaas_id and not asaas_id.startswith('special_'):
        await update_subscription_due_day(asaas_id, new_due.isoformat())

    # Atualiza no banco
    db.table('subscriptions').update(
        {
            'preferred_due_day': body.preferred_day,
            'expires_at': new_due.isoformat(),
        }
    ).eq('username', current_user['username']).in_(
        'status', ['active', 'grace']
    ).execute()

    db.table('users').update(
        {
            'preferred_due_day': body.preferred_day,
        }
    ).eq('username', current_user['username']).execute()

    return {
        'ok': True,
        'new_due_date': new_due.isoformat(),
        'message': f'Vencimento alterado para dia {
            body.preferred_day} (próximo: {new_due}).',
    }


@router.get('/plans')
async def list_plans(current_user: dict = Depends(get_current_user)):
    """Retorna os planos disponíveis com preços do banco."""
    plans = (
        get_client()
        .table('plans')
        .select('id, name, description, price')
        .eq('is_active', True)
        .execute()
        .data
    )
    return plans or []


@router.get('/status')
async def get_status(current_user: dict = Depends(get_current_user)):
    """Retorna status da assinatura atual do usuário."""
    from app.modules.users.routes.permissions import SPECIAL_USERS

    username = current_user.get('username')
    is_special = username in SPECIAL_USERS or current_user.get(
        'is_exempt')

    if is_special:
        return {
            'has_subscription': True,
            'plan_type': 'full',
            'status': 'active',
            'expires_at': '2099-12-31',
            'days_left': 9999,
            'asaas_subscription_id': f'special_{username}',
            'preferred_due_day': 5,
        }

    db = get_client()
    sub = (
        db.table('subscriptions')
        .select(
            'plan_type, status, expires_at, asaas_subscription_id, preferred_due_day'
        )
        .eq('username', current_user['username'])
        .order('created_at', desc=True)
        .limit(1)
        .execute()
        .data
    )

    if not sub:
        return {'has_subscription': False}

    s = sub[0]
    expires = date.fromisoformat(s['expires_at'][:10])
    today = date.today()
    days_left = (expires - today).days

    return {
        'has_subscription': True,
        'plan_type': s['plan_type'],
        'status': s['status'],
        'expires_at': s['expires_at'][:10],
        'days_left': max(0, days_left),
        'asaas_subscription_id': s.get('asaas_subscription_id'),
        'preferred_due_day': s.get('preferred_due_day', 5),
        'payment_id': s.get('payment_id')
    }


@router.get('/payment-status/{payment_id}')
async def get_payment_status_endpoint(
    payment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retorna o status atualizado de um pagamento específico no Asaas."""
    status_data = await get_payment_status(payment_id)
    if not status_data:
        raise ContentNotFoundError(detail='Pagamento não encontrado.')

    # Verifica se o pagamento pertence ao usuário
    db = get_client()
    sub = (
        db.table('subscriptions')
        .select('username')
        .eq('payment_id', payment_id)
        .eq('username', current_user['username'])
        .execute()
        .data
    )

    if not sub:
        raise PremiumAccessDeniedError(detail='Acesso negado.')

    return status_data


@router.post('/cancel-payment/{payment_id}')
async def cancel_payment_endpoint(
    payment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancela um pagamento pendente do usuário."""
    db = get_client()

    # Verifica se o pagamento pertence ao usuário
    sub = (
        db.table('subscriptions')
        .select('status')
        .eq('payment_id', payment_id)
        .eq('username', current_user['username'])
        .execute()
        .data
    )

    if not sub:
        raise ContentNotFoundError(detail='Pagamento não encontrado.')

    if sub[0].get('status') != 'pending':
        raise BusinessLogicError(
            detail='Só é possível cancelar pagamentos pendentes.')

    # Cancela no Asaas
    success = await cancel_payment(payment_id)
    if not success:
        raise HTTPException(
            status_code=500,
            detail='Erro ao cancelar pagamento no Asaas.')

    # Atualiza no banco
    db.table('subscriptions').update({'status': 'cancelled'}).eq(
        'payment_id', payment_id
    ).execute()

    return {'ok': True, 'message': 'Pagamento cancelado com sucesso.'}


@router.post('/webhook')
async def asaas_webhook(request: Request):
    """
    Webhook do Asaas — processa eventos de pagamento e assinatura.
    Configure a URL no painel Asaas em: Configurações > Integrações > Webhooks
    """
    try:
        # Valida token do webhook (obrigatório)
        token = request.headers.get('asaas-access-token', '')

        if not settings.asaas_webhook_token:
            _pay_log(
                "CRITICAL: asaas_webhook_token not configured in settings")
            raise HTTPException(
                status_code=500,
                detail="Webhook security token not configured")

        if token != settings.asaas_webhook_token:
            _pay_log(f"webhook_invalid_token token={token}")
            raise HTTPException(
                status_code=401, detail="Invalid webhook token")

        body = await request.json()
        event = body.get('event', '')
        payment = body.get('payment', {})

        payment_id = payment.get('id', '')
        # ID da assinatura no Asaas
        subscription_id = payment.get('subscription', '')
        ext_ref = payment.get('externalReference', '')
        event_key = f"{event}:{payment_id}:{subscription_id}:{ext_ref}"

        if _is_webhook_event_already_processed(event_key):
            _pay_log(f"webhook_duplicate_ignored event_key={event_key}")
            return {'ok': True, 'duplicate': True}
        _mark_webhook_event_processed(event_key, body)

        # ── Processamento de Conteúdo Premium (Novo Hub e Antigo) ─────
        if ext_ref.startswith('PREMIUM:') or ext_ref.startswith('HUB:'):
            _pay_log(
                f"webhook_premium_event event={event} ext_ref={ext_ref} payment_id={payment_id}")
            is_new_hub = ext_ref.startswith('HUB:')
            parts = ext_ref.split(':')

            if len(parts) >= 3:
                content_id = parts[1]
                username = parts[2]
                db = get_client()

                if event in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'):
                    # 1. Upsert em premium_purchases (tabela clássica)
                    try:
                        upsert_res = db.table('premium_purchases').upsert({
                            'username': username,
                            'content_id': content_id,
                            'status': 'confirmed',
                            'asaas_payment_id': payment_id
                        }, on_conflict='username,content_id').execute()
                        _pay_log(
                            f'premium_purchases_upsert ok username={username} content_id={content_id} result={
                                upsert_res.data}')
                    except Exception as e:
                        _pay_log(f'premium_purchases_upsert ERROR: {e}')
                        # Fallback: insert simples sem upsert
                        try:
                            db.table('premium_purchases').insert({
                                'username': username,
                                'content_id': content_id,
                                'status': 'confirmed',
                                'asaas_payment_id': payment_id
                            }).execute()
                            _pay_log(
                                f'premium_purchases_insert_fallback ok username={username}')
                        except Exception as e2:
                            _pay_log(
                                f'premium_purchases_insert_fallback ERROR: {e2}')

                    # 2. Atualiza orders (tabela do novo hub) — busca
                    # por asaas_id OU por username+content via
                    # order_items
                    if is_new_hub:
                        try:
                            # Atualização direta por asaas_id
                            upd_res = db.table('orders').update({
                                'status': 'confirmed',
                                'confirmed_at': datetime.now(timezone.utc).isoformat()
                            }).eq('asaas_id', payment_id).execute()
                            _pay_log(
                                f'orders_update ok asaas_id={payment_id} rows_updated={len(upd_res.data or [])}')

                            # Se não encontrou por asaas_id, tenta via
                            # order_items
                            if not upd_res.data:
                                _pay_log(
                                    f'orders_update no rows by asaas_id — trying via order_items username={username} content_id={content_id}')
                                oi_rows = db.table('order_items')\
                                    .select('order_id, orders!inner(id, username, status)')\
                                    .eq('content_id', content_id)\
                                    .execute().data or []
                                for oi in oi_rows:
                                    o = oi.get('orders', {})
                                    if o.get('username') == username and o.get(
                                            'status') == 'pending':
                                        db.table('orders').update({
                                            'status': 'confirmed',
                                            'asaas_id': payment_id,
                                            'confirmed_at': datetime.now(timezone.utc).isoformat()
                                        }).eq('id', o['id']).execute()
                                        _pay_log(
                                            f'orders_update_via_order_items ok order_id={
                                                o["id"]}')
                                        break
                        except Exception as e:
                            _pay_log(f'orders_update ERROR: {e}')

                    _pay_log(
                        f'premium_purchase_confirmed username={username} content_id={content_id} payment_id={payment_id}')

                    # 3. Envia e-mail de confirmação
                    try:
                        user_data = db.table('users').select('email, name').eq(
                            'username', username).single().execute().data
                        content_data = db.table('premium_content').select(
                            'title').eq('id', content_id).single().execute().data

                        if user_data and content_data:
                            from app.shared.services.email import EmailSender
                            sender = EmailSender()
                            hub_url = f"{
                                getattr(
                                    settings,
                                    'frontend_url',
                                    'https://tati-ai.vercel.app')}/materiais"
                            sender.send_purchase_confirmation(
                                to_email=user_data['email'],
                                name=user_data.get('name') or username,
                                item_title=content_data['title'],
                                download_url=hub_url
                            )
                            _pay_log(
                                f'premium_confirmation_email_sent username={username} email={
                                    user_data["email"]}')

                            await payment_notifier.notify_payment_status(
                                username,
                                "confirmed",
                                payment_id,
                                {"content_id": content_id,
                                    "title": content_data['title']}
                            )
                    except Exception as e:
                        _pay_log(f'premium_email_send ERROR: {e}')

                elif event in ('PAYMENT_REFUNDED', 'CHARGEBACK_REQUESTED', 'PAYMENT_DELETED'):
                    try:
                        db.table('premium_purchases').update({'status': 'revoked'}).eq(
                            'username', username).eq('content_id', content_id).execute()

                        if is_new_hub:
                            db.table('orders').update({'status': 'revoked'}).eq(
                                'asaas_id', payment_id).execute()

                        _pay_log(
                            f'premium_purchase_revoked username={username} content_id={content_id} payment_id={payment_id}')
                    except Exception as e:
                        _pay_log(f'premium_revoke ERROR: {e}')

            return {'ok': True}

        # ── Processamento de Assinaturas ──────────────────────────────
        parts = ext_ref.split('|') if '|' in ext_ref else [
            ext_ref, 'basic']
        username = parts[0]
        plan_type = parts[1] if len(parts) > 1 else 'basic'

        _pay_log(
            f'webhook_subscription_event event={event} username={username} plan={plan_type} subscription={subscription_id} payment_id={payment_id}')

        if event in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'):
            # Pagamento confirmado — ativa a assinatura
            activate_subscription(username, plan_type,
                                  subscription_id, payment_id)
            _pay_log(
                f'subscription_activated username={username} plan={plan_type} subscription={subscription_id}')

        elif event == 'PAYMENT_OVERDUE':
            # Venceu — entra em grace period, ainda não cancela
            get_client().table('subscriptions').update({'status': 'grace'}).eq(
                'asaas_subscription_id', subscription_id).execute()
            _pay_log(
                f'subscription_grace_period username={username} subscription={subscription_id}')

        elif event in (
            'PAYMENT_DELETED',
            'PAYMENT_REFUNDED',
            'CHARGEBACK_REQUESTED',
            'SUBSCRIPTION_DELETED',
        ):
            # Cancelado ou estornado — expira acesso
            expire_by_subscription_id(subscription_id)
            # Envia e-mail de pagamento recusado
            db = get_client()
            user_data = db.table('users').select('email, name').eq(
                'username', username).single().execute().data
            if user_data:
                from app.shared.services.email import EmailSender
                sender = EmailSender()
                billing_type = payment.get(
                    'billingType', 'desconhecida')
                reason_map = {
                    'PAYMENT_REFUNDED': 'Pagamento estornado.',
                    'CHARGEBACK_REQUESTED': 'Chargeback solicitado.',
                    'PAYMENT_DELETED': 'Pagamento cancelado.',
                    'SUBSCRIPTION_DELETED': 'Assinatura cancelada.',
                }
                reason = reason_map.get(
                    event, 'Pagamento não aprovado.')
                sender.send_payment_refused(
                    to_email=user_data['email'],
                    name=user_data.get('name') or username,
                    payment_method=billing_type.replace(
                        '_',
                        ' ').title(),
                    reason=reason)
                _pay_log(
                    f'payment_refused_email_sent username={username} email={
                        user_data["email"]} event={event}')

                # Notify WebSocket
                await payment_notifier.notify_payment_status(
                    username,
                    "refused",
                    payment_id,
                    {"reason": reason, "event": event}
                )

            _pay_log(
                f'subscription_expired username={username} subscription={subscription_id} event={event}')

        elif event in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'):
            # Only relevant if not caught by subscriptions logic above
            # For robustness, notify any confirmed payment
            await payment_notifier.notify_payment_status(username, "confirmed", payment_id)

        return {'ok': True}

    except Exception as exc:
        _pay_log(f'webhook_error error={exc}')
        # sempre 200 para o Asaas não retentar
        return {'ok': False, 'error': str(exc)}
