from __future__ import annotations

import logging
import json
import os
from typing import Any, Dict
import httpx

from app.core.config import settings
from app.core.database import get_client

try:
    from pywebpush import WebPushException, webpush
except Exception:  # pragma: no cover - dependência opcional em ambiente local.
    WebPushException = Exception
    webpush = None


def _is_push_configured() -> bool:
    return bool(
        webpush
        and settings.vapid_public_key
        and settings.vapid_private_key
        and settings.vapid_contact
    )


def get_public_vapid_key() -> str:
    return settings.vapid_public_key or ''


def save_push_subscription(
    username: str,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str = '',
) -> bool:
    if not username or not endpoint or not p256dh or not auth:
        return False

    payload = {
        'username': username,
        'endpoint': endpoint,
        'p256dh': p256dh,
        'auth': auth,
        'user_agent': user_agent or '',
        'is_active': True,
    }
    db = get_client()
    try:
        db.table('push_subscriptions').upsert(
            payload, on_conflict='username,endpoint'
        ).execute()
        return True
    except Exception as exc:
        logging.info(f'[Push] Falha ao salvar subscription: {exc}')
        return False


def disable_push_subscription(username: str, endpoint: str) -> None:
    if not endpoint:
        return
    db = get_client()
    try:
        query = (
            db.table('push_subscriptions')
            .update({'is_active': False})
            .eq('endpoint', endpoint)
        )
        if username:
            query = query.eq('username', username)
        query.execute()
    except Exception as exc:
        logging.info(f'[Push] Falha ao desativar subscription: {exc}')


def _user_subscriptions(username: str) -> list[dict[str, Any]]:
    if not username:
        return []
    db = get_client()
    try:
        rows = (
            db.table('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('username', username)
            .eq('is_active', True)
            .execute()
            .data
        )
        return rows or []
    except Exception as exc:
        logging.info(f'[Push] Falha ao carregar subscriptions: {exc}')
        return []


def _get_fcm_access_token(service_account_path: str) -> str:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    
    scopes = ['https://www.googleapis.com/auth/firebase.messaging']
    creds = service_account.Credentials.from_service_account_file(
        service_account_path, scopes=scopes
    )
    creds.refresh(Request())
    return creds.token


def _get_fcm_project_id(service_account_path: str) -> str | None:
    try:
        with open(service_account_path, 'r') as f:
            data = json.load(f)
            return data.get('project_id')
    except Exception:
        return None


def send_native_fcm_notification(token: str, title: str, body: str, url: str = '/') -> bool:
    possible_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))), 'service-account.json'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'service-account.json'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'service-account.json'),
        os.path.join(os.path.dirname(os.getcwd()), 'service-account.json'),
        os.path.join(os.getcwd(), 'service-account.json'),
        os.path.join(os.getcwd(), 'backend', 'service-account.json'),
        os.path.join(os.getcwd(), 'mobile_app', 'capacitor', 'service-account.json')
    ]
    
    sa_path = None
    for p in possible_paths:
        if os.path.exists(p):
            sa_path = p
            break
            
    if not sa_path:
        logging.info("[FCM] Native push failed: service-account.json not found in paths.")
        return False
        
    project_id = _get_fcm_project_id(sa_path)
    if not project_id:
        logging.info("[FCM] Native push failed: project_id not found in service-account.json.")
        return False
        
    try:
        access_token = _get_fcm_access_token(sa_path)
        fcm_url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "message": {
                "token": token,
                "notification": {
                    "title": title,
                    "body": body
                },
                "data": {
                    "url": url
                },
                "android": {
                    "notification": {
                        "sound": "default"
                    }
                }
            }
        }
        
        resp = httpx.post(fcm_url, headers=headers, json=payload, timeout=10.0)
        if resp.status_code == 200:
            logging.info(f"[FCM] Native push successfully sent to token {token[:15]}...")
            return True
        else:
            logging.info(f"[FCM] Native push API error ({resp.status_code}): {resp.text}")
            return False
    except Exception as exc:
        logging.info(f"[FCM] Native push failed: {exc}")
        return False


def send_push_to_user(
    username: str, title: str, body: str, url: str = '/'
) -> Dict[str, int]:
    sent = 0
    failed = 0
    
    for row in _user_subscriptions(username):
        endpoint = str(row.get('endpoint') or '').strip()
        p256dh = str(row.get('p256dh') or '')
        
        if endpoint.startswith('fcm:') or p256dh == 'fcm':
            # 1. Enviar via Native FCM
            token = endpoint.replace('fcm:', '')
            success = send_native_fcm_notification(token, title, body, url)
            if success:
                sent += 1
            else:
                failed += 1
        else:
            # 2. Enviar via Web Push padrão
            if not _is_push_configured():
                failed += 1
                continue
                
            subscription_info = {
                'endpoint': endpoint,
                'keys': {
                    'p256dh': p256dh,
                    'auth': str(row.get('auth') or ''),
                },
            }
            try:
                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps({'title': title, 'body': body, 'url': url}),
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={'sub': settings.vapid_contact},
                    ttl=60 * 60,
                )
                sent += 1
            except WebPushException as exc:
                failed += 1
                status_code = getattr(
                    getattr(exc, 'response', None), 'status_code', None)
                if status_code in {404, 410}:
                    disable_push_subscription(
                        username=username, endpoint=endpoint)
            except Exception:
                failed += 1

    return {'sent': sent, 'failed': failed}
