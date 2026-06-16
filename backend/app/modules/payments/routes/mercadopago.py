import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from app.core.database import get_client
from app.modules.payments.services.mercadopago import MercadoPago
from app.modules.payments.services.payment_notifier import payment_notifier
from app.core.config import settings


router = APIRouter()


def _mp_log(message: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    logging.info(f"[MercadoPago][{now}] {message}")

@router.post('/mercadopago/webhook')
async def mercadopago_webhook(request: Request):
    """
    Webhook do Mercado Pago — processa eventos de pagamento.
    """
    try:
        body = await request.json()
        _mp_log(f"Webhook received: {body}")
        
        # Encaminha o webhook para outro servidor se configurado (ex: do Railway para o Render)
        import os
        import httpx
        forward_url = os.getenv("FORWARD_WEBHOOK_URL")
        if forward_url:
            _mp_log(f"Forwarding webhook to: {forward_url}")
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(forward_url, json=body, timeout=5.0)
            except Exception as forward_err:
                _mp_log(f"Error forwarding webhook: {forward_err}")

        
        # O Mercado Pago pode mandar notificações com campos diferentes dependendo do evento.
        event_type = body.get('type')
        payment_id = body.get('data', {}).get('id')
        
        if not payment_id and body.get('resource'):
            # Formato alternativo
            resource_url = body.get('resource', '')
            payment_id = resource_url.split('/')[-1]
            event_type = 'payment'
            
        if event_type != 'payment' or not payment_id:
            _mp_log(f"Ignoring event: type={event_type}, id={payment_id}")
            return {'ok': True, 'ignored': True}
            
        payment_id = str(payment_id)
        _mp_log(f"Processing payment: {payment_id}")
        
        # Consulta os detalhes do pagamento no Mercado Pago usando nossa chave secreta
        mp = MercadoPago()
        
        # Tenta buscar o pagamento, com até 3 retentativas e delay caso dê 404 (delay de propagação do MP)
        payment_details = None
        import asyncio
        for attempt in range(3):
            try:
                payment_details = await mp.get_payment(payment_id)
                break
            except Exception as e:
                if "404" in str(e) and attempt < 2:
                    _mp_log(f"Payment {payment_id} not found (404) on attempt {attempt + 1}. Retrying in 1.5s...")
                    await asyncio.sleep(1.5)
                else:
                    raise e
                    
        if not payment_details:
            raise RuntimeError(f"Could not retrieve payment details for {payment_id}")
            
        ext_ref = payment_details.get('external_reference')
        status = payment_details.get('status')
        _mp_log(f"Payment details: id={payment_id}, ext_ref={ext_ref}, status={status}")

        
        if not ext_ref:
            _mp_log(f"Payment {payment_id} does not have external_reference. Ignored.")
            return {'ok': True, 'ignored': True}
            
        if ext_ref.startswith('PREMIUM:') or ext_ref.startswith('HUB:'):
            is_new_hub = ext_ref.startswith('HUB:')
            parts = ext_ref.split(':')
            
            if len(parts) >= 3:
                content_id = parts[1]
                username = parts[2]
                db = get_client()
                
                if status == 'approved':
                    # 1. Upsert em premium_purchases
                    try:
                        db.table('premium_purchases').upsert({
                            'username': username,
                            'content_id': content_id,
                            'status': 'confirmed',
                            'asaas_payment_id': payment_id  # Guardamos o ID do MP aqui
                        }, on_conflict='username,content_id').execute()
                        _mp_log(f"premium_purchases confirmed for {username} - {content_id}")
                    except Exception as e:
                        _mp_log(f"Error upserting premium_purchases: {e}")
                        
                    # 2. Atualiza orders se for do novo hub
                    if is_new_hub:
                        try:
                            # Tenta atualizar por asaas_id
                            upd_res = db.table('orders').update({
                                'status': 'confirmed',
                                'confirmed_at': datetime.now(timezone.utc).isoformat()
                            }).eq('asaas_id', payment_id).execute()
                            
                            # Se não encontrou por asaas_id (ex: Preference), tenta via order_items
                            if not (upd_res.data if hasattr(upd_res, 'data') else upd_res):
                                _mp_log(f"No order found with asaas_id={payment_id}, trying via order_items")
                                oi_rows = db.table('order_items')\
                                    .select('order_id, orders!inner(id, username, status)')\
                                    .eq('content_id', content_id)\
                                    .execute().data or []
                                    
                                for oi in oi_rows:
                                    o = oi.get('orders', {})
                                    if o.get('username') == username and o.get('status') == 'pending':
                                        db.table('orders').update({
                                            'status': 'confirmed',
                                            'asaas_id': payment_id,
                                            'confirmed_at': datetime.now(timezone.utc).isoformat()
                                        }).eq('id', o['id']).execute()
                                        _mp_log(f"Order {o['id']} confirmed and updated with real MP payment_id")
                                        break
                        except Exception as e:
                            _mp_log(f"Error updating orders: {e}")
                            
                    # 3. Envia e-mail de confirmação
                    try:
                        user_data = db.table('users').select('email, name').eq('username', username).single().execute().data
                        content_data = db.table('premium_content').select('title').eq('id', content_id).single().execute().data
                        
                        if user_data and content_data:
                            from app.shared.services.email import EmailSender
                            sender = EmailSender()
                            hub_url = f"{getattr(settings, 'frontend_url', 'https://tati-ai.vercel.app')}/materiais"
                            sender.send_purchase_confirmation(
                                to_email=user_data['email'],
                                name=user_data.get('name') or username,
                                item_title=content_data['title'],
                                download_url=hub_url
                            )
                            _mp_log(f"Email sent to {user_data['email']}")
                            
                            # Notifica WebSocket em tempo real
                            await payment_notifier.notify_payment_status(
                                username,
                                "confirmed",
                                payment_id,
                                {"content_id": content_id, "title": content_data['title']}
                            )
                    except Exception as e:
                        _mp_log(f"Error sending confirmation email / notifying: {e}")
                        
                elif status in ('rejected', 'cancelled', 'refunded'):
                    try:
                        db.table('premium_purchases').update({'status': 'revoked'}).eq(
                            'username', username).eq('content_id', content_id).execute()
                            
                        if is_new_hub:
                            db.table('orders').update({'status': 'revoked'}).eq('asaas_id', payment_id).execute()
                            
                        _mp_log(f"Purchase revoked for {username} - {content_id}")
                    except Exception as e:
                        _mp_log(f"Error revoking purchase: {e}")
                        
        return {'ok': True}
        
    except Exception as exc:
        _mp_log(f"Error in webhook: {exc}")
        # Retornamos sucesso para o MP para evitar retries se for erro de parsing
        return {'ok': False, 'error': str(exc)}


@router.post('/mercadopago/sandbox/simulate-approve/{payment_id}')
async def sandbox_simulate_approve(payment_id: str):
    """
    [SANDBOX ONLY] Simula a aprovação de um pagamento MP diretamente no banco,
    sem depender do status do sandbox do MP. Usado para testes locais.
    """
    if not settings.mp_access_token.startswith('TEST-'):
        raise HTTPException(status_code=403, detail="Endpoint disponível apenas em ambiente de teste.")

    mp = MercadoPago()
    try:
        payment_details = await mp.get_payment(payment_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Pagamento não encontrado no MP: {e}")

    ext_ref = payment_details.get('external_reference', '')
    if not ext_ref:
        raise HTTPException(status_code=400, detail="Pagamento sem external_reference.")

    parts = ext_ref.split(':')
    if len(parts) < 3 or parts[0] not in ('HUB', 'PREMIUM'):
        raise HTTPException(status_code=400, detail=f"external_reference inválido: {ext_ref}")

    is_new_hub = parts[0] == 'HUB'
    content_id = parts[1]
    username = parts[2]
    db = get_client()

    # Atualiza premium_purchases
    db.table('premium_purchases').upsert({
        'username': username,
        'content_id': content_id,
        'status': 'confirmed',
        'asaas_payment_id': payment_id
    }, on_conflict='username,content_id').execute()

    # Atualiza orders
    if is_new_hub:
        upd_res = db.table('orders').update({
            'status': 'confirmed',
            'confirmed_at': datetime.now(timezone.utc).isoformat()
        }).eq('asaas_id', payment_id).execute()

        if not (upd_res.data if hasattr(upd_res, 'data') else upd_res):
            oi_rows = db.table('order_items')\
                .select('order_id, orders!inner(id, username, status)')\
                .eq('content_id', content_id).execute().data or []
            for oi in oi_rows:
                o = oi.get('orders', {})
                if o.get('username') == username and o.get('status') == 'pending':
                    db.table('orders').update({
                        'status': 'confirmed',
                        'asaas_id': payment_id,
                        'confirmed_at': datetime.now(timezone.utc).isoformat()
                    }).eq('id', o['id']).execute()
                    break

    # Notifica WebSocket
    try:
        content_data = db.table('premium_content').select('title').eq('id', content_id).single().execute().data
        title = content_data['title'] if content_data else content_id
        await payment_notifier.notify_payment_status(
            username, "confirmed", payment_id, {"content_id": content_id, "title": title}
        )
    except Exception as e:
        _mp_log(f"[SimulateApprove] Erro ao notificar WebSocket: {e}")

    _mp_log(f"[SimulateApprove] Pagamento {payment_id} aprovado manualmente para {username} - {content_id}")
    return {'ok': True, 'payment_id': payment_id, 'username': username, 'content_id': content_id, 'status': 'confirmed'}
