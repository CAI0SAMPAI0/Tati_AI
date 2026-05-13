"""
services/subscription_manager.py
Lógica compartilhada para ativação e expiração de assinaturas.

Evita imports circulares entre ``app.modules.auth.routes.auth`` e ``app.modules.payments.routes.asaas``
centralizando a lógica de subscription aqui.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.core.database import get_client


# ── Constantes ────────────────────────────────────────────────────────────────

SPECIAL_USERS: set[str] = {
    'tati',
    'tati.ai',
    'admin',
    'Professora',
    'Tatiana',
    'professor',
}


# ── Funções públicas ─────────────────────────────────────────────────────────


def activate_subscription(
    username: str,
    plan_type: str,
    asaas_subscription_id: str,
    payment_id: str,
    preferred_day: Optional[int] = None,
) -> None:
    """Ativa assinatura no banco após confirmação de pagamento."""
    from app.modules.users.routes.permissions import calc_due_date

    db = get_client()
    today = date.today()

    if preferred_day is None:
        user_row = (
            db.table('users')
            .select('preferred_due_day')
            .eq('username', username)
            .limit(1)
            .execute()
            .data
        )
        preferred_day = (user_row[0].get('preferred_due_day') or 5) if user_row else 5

    expires_at = calc_due_date(today, preferred_day)

    # Cancela assinaturas anteriores
    db.table('subscriptions').update({'status': 'cancelled'}).eq(
        'username',
        username,
    ).in_('status', ['pending', 'active', 'grace']).execute()

    # Cria nova assinatura ativa
    db.table('subscriptions').insert(
        {
            'username': username,
            'plan_type': plan_type,
            'status': 'active',
            'payment_id': payment_id,
            'asaas_subscription_id': asaas_subscription_id,
            'preferred_due_day': preferred_day,
            'expires_at': expires_at.isoformat(),
        }
    ).execute()

    # Atualiza flags do usuário
    db.table('users').update(
        {
            'is_premium_active': True,
            'plan_type': plan_type,
            'free_messages_used': 0,
        }
    ).eq('username', username).execute()


def expire_by_subscription_id(asaas_subscription_id: str) -> None:
    """Expira assinatura pelo ID do Asaas."""
    db = get_client()
    rows = (
        db.table('subscriptions')
        .select('username')
        .eq('asaas_subscription_id', asaas_subscription_id)
        .limit(1)
        .execute()
        .data
    )

    if not rows:
        return

    username = rows[0]['username']
    db.table('subscriptions').update({'status': 'expired'}).eq(
        'asaas_subscription_id',
        asaas_subscription_id,
    ).execute()
    db.table('users').update(
        {
            'is_premium_active': False,
            'plan_type': None,
        }
    ).eq('username', username).execute()


def activate_special_user(
    username: str,
    plan_type: str = 'full',
) -> None:
    """Ativa assinatura para usuários especiais sem pagamento.

    Verifica primeiro se já existe assinatura ativa para evitar
    escritas desnecessárias no banco a cada login.
    """
    if username not in SPECIAL_USERS:
        return

    db = get_client()

    # Verifica se já possui assinatura ativa — evita INSERT a cada login
    existing = (
        db.table('subscriptions')
        .select('id')
        .eq('username', username)
        .eq('status', 'active')
        .limit(1)
        .execute()
        .data
    )
    if existing:
        return

    today = date.today()
    expires_at = date(today.year + 2, today.month, today.day)

    db.table('subscriptions').update({'status': 'cancelled'}).eq(
        'username',
        username,
    ).in_('status', ['pending', 'active', 'grace']).execute()

    db.table('subscriptions').insert(
        {
            'username': username,
            'plan_type': plan_type,
            'status': 'active',
            'payment_id': f'special_{username}',
            'asaas_subscription_id': f'special_{username}',
            'preferred_due_day': 5,
            'expires_at': expires_at.isoformat(),
        }
    ).execute()

    db.table('users').update(
        {
            'is_premium_active': True,
            'plan_type': plan_type,
            'free_messages_used': 0,
        }
    ).eq('username', username).execute()
