from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from routers.deps import get_current_user, require_staff
from services.database import get_client
from core.config import settings

router = APIRouter()

PAID_START    = date(2026, 6, 30)
FREE_MSG_LIMIT = 5

# Usuários com acesso total garantido (programadores/testers)
SPECIAL_USERS = {
    "tati",
    "tati.ai",
    "admin",
    "Professora",
    "Tatiana",
    "programador",
    "Programador",
}

# Feriados nacionais fixos (mês, dia) — adicione os móveis via banco se quiser
FERIADOS_FIXOS = {
    (1, 1),   # Ano Novo
    (4, 21),  # Tiradentes
    (5, 1),   # Dia do Trabalho
    (9, 7),   # Independência
    (10, 12), # Nossa Senhora
    (11, 2),  # Finados
    (11, 15), # Proclamação da República
    (12, 25), # Natal
}


# ── Helpers de dia útil ───────────────────────────────────────────

def is_business_day(d: date) -> bool:
    """Retorna True se o dia for dia útil (seg-sex, não feriado)."""
    if d.weekday() >= 5:  # sábado=5, domingo=6
        return False
    if (d.month, d.day) in FERIADOS_FIXOS:
        return False
    return True


def next_business_day(d: date) -> date:
    """Retorna o próximo dia útil a partir de d (inclusive)."""
    while not is_business_day(d):
        d += timedelta(days=1)
    return d


def nth_business_day(year: int, month: int, n: int) -> date:
    """Retorna o n-ésimo dia útil do mês."""
    d = date(year, month, 1)
    count = 0
    while True:
        if is_business_day(d):
            count += 1
            if count == n:
                return d
        d += timedelta(days=1)


def calc_due_date(reference: date, preferred_day: int = 5) -> date:
    """
    Calcula a data de vencimento da próxima fatura.
    - preferred_day: dia do mês preferido pelo usuário (1–28), padrão 5
    - A janela de pagamento vai do dia 25 do mês anterior ao 5º dia útil do mês atual
    - Se o dia preferido cair em feriado/fim de semana, avança para o próximo dia útil
    """
    # Próximo mês a partir da referência
    if reference.month == 12:
        year, month = reference.year + 1, 1
    else:
        year, month = reference.year, reference.month + 1

    # Dia preferido no próximo mês
    try:
        due = date(year, month, preferred_day)
    except ValueError:
        # Mês com menos dias que preferred_day (ex: fev com dia 30)
        due = date(year, month, 28)

    # Garante que é dia útil
    due = next_business_day(due)

    # Limite máximo: 5º dia útil do mês
    max_due = nth_business_day(year, month, 5)
    if due > max_due:
        due = max_due

    # Mínimo: dia 25 do mês anterior
    min_due = date(reference.year, reference.month, 25)
    if due < min_due:
        due = next_business_day(min_due)

    return due


# ── Models ────────────────────────────────────────────────────────

class ChangeDueDateRequest(BaseModel):
    preferred_day: int  # 1–28


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/access")
async def get_access_info(user: dict = Depends(get_current_user)):
    today      = date.today()
    username   = user.get("username")
    can_access_dashboard = _can_access_dashboard(user)
    is_admin   = can_access_dashboard
    is_exempt  = user.get("is_exempt", False) or username in SPECIAL_USERS
    plan_type  = user.get("plan_type")

    # Admin ou Usuário Especial → sempre liberado
    if is_admin or is_exempt:
        return _access_response(
            is_admin=is_admin,
            full=True,
            activities=True,
            can_access_dashboard=can_access_dashboard,
        )

    # Até 30/06/2026 (inclusive) → período gratuito para todos os alunos
    if _is_free_mode_period(today):
        return _access_response(
            full=True,
            activities=True,
            free_mode=True,
            can_access_dashboard=can_access_dashboard,
        )

    # Isento
    if is_exempt:
        return _access_response(
            full=True,
            activities=True,
            can_access_dashboard=can_access_dashboard,
        )

    # Verifica assinatura ativa no banco
    sub = _get_active_subscription(user["username"])

    if sub:
        expires = date.fromisoformat(sub["expires_at"][:10])
        plan    = sub["plan_type"]

        # Dentro da janela de tolerância (dia 25 ao 5º dia útil)
        in_grace = _in_grace_period(today, expires)

        if today <= expires or in_grace:
            return _access_response(
                full=True,
                activities=(plan == "full"),
                can_access_dashboard=can_access_dashboard,
                plan_type=plan,
                expires_at=sub["expires_at"][:10],
                in_grace=in_grace,
            )

    # Sem assinatura ativa → mensagens gratuitas
    used      = _get_free_messages_used(user["username"])
    remaining = max(0, FREE_MSG_LIMIT - used)
    return _access_response(
        full=False,
        activities=False,
        can_access_dashboard=can_access_dashboard,
        free_messages_remaining=remaining,
    )


@router.post("/change-due-date")
async def change_due_date(
    body: ChangeDueDateRequest,
    user: dict = Depends(get_current_user),
):
    if not (1 <= body.preferred_day <= 28):
        raise HTTPException(status_code=400, detail="Dia deve ser entre 1 e 28.")

    db  = get_client()
    sub = _get_active_subscription(user["username"])
    if not sub:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura ativa encontrada.")

    # Calcula nova data de vencimento a partir de hoje
    new_due = calc_due_date(date.today(), preferred_day=body.preferred_day)

    db.table("subscriptions").update({
        "preferred_due_day": body.preferred_day,
        "expires_at":        new_due.isoformat(),
    }).eq("username", user["username"]).execute()

    # Salva preferência no usuário também
    db.table("users").update({
        "preferred_due_day": body.preferred_day,
    }).eq("username", user["username"]).execute()

    return {
        "ok":          True,
        "new_due_date": new_due.isoformat(),
        "message":     f"Vencimento alterado para dia {body.preferred_day} (próximo: {new_due}).",
    }


@router.get("/subscription")
async def get_subscription(user: dict = Depends(get_current_user)):
    """Retorna detalhes da assinatura atual."""
    sub = _get_active_subscription(user["username"])
    if not sub:
        return {"has_subscription": False}

    expires     = date.fromisoformat(sub["expires_at"][:10])
    today       = date.today()
    in_grace    = _in_grace_period(today, expires)
    days_left   = (expires - today).days

    return {
        "has_subscription":  True,
        "plan_type":         sub["plan_type"],
        "status":            sub["status"],
        "expires_at":        sub["expires_at"][:10],
        "days_left":         days_left,
        "in_grace_period":   in_grace,
        "preferred_due_day": sub.get("preferred_due_day", 5),
        "next_due_date":     calc_due_date(today, sub.get("preferred_due_day", 5)).isoformat(),
    }


# ── Privados ──────────────────────────────────────────────────────

def _access_response(
    is_admin=False, full=False, activities=False,
    can_access_dashboard=False,
    free_mode=False, plan_type=None, expires_at=None,
    in_grace=False, free_messages_remaining=None,
):
    return {
        "is_admin":                is_admin,
        "full_access":             full,
        "can_access_activities":   activities,
        "can_access_dashboard":    can_access_dashboard,
        "free_mode":               free_mode,
        "plan_type":               plan_type,
        "expires_at":              expires_at,
        "in_grace_period":         in_grace,
        "free_messages_remaining": free_messages_remaining,
    }


def _can_access_dashboard(user: dict) -> bool:
    username = user.get("username")
    role = user.get("role")
    return role in settings.staff_roles or username in SPECIAL_USERS


def _is_free_mode_period(today: date) -> bool:
    return today <= PAID_START


def _get_active_subscription(username: str) -> dict | None:
    rows = (
        get_client()
        .table("subscriptions")
        .select("id, plan_type, status, expires_at, preferred_due_day")
        .eq("username", username)
        .in_("status", ["active", "grace"])
        .order("expires_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def _get_free_messages_used(username: str) -> int:
    try:
        row = (
            get_client()
            .table("users")
            .select("free_messages_used")
            .eq("username", username)
            .single()
            .execute()
            .data
        )
        return row.get("free_messages_used") or 0
    except Exception:
        return 0


def _in_grace_period(today: date, expires: date) -> bool:
    """
    Janela de tolerância: do dia 25 do mês de vencimento
    até o 5º dia útil do mês seguinte.
    """
    if today <= expires:
        return False  # ainda não venceu

    # Início da janela: dia 25 do mês de vencimento
    grace_start = date(expires.year, expires.month, 25)

    # Fim da janela: 5º dia útil do mês seguinte ao vencimento
    if expires.month == 12:
        next_year, next_month = expires.year + 1, 1
    else:
        next_year, next_month = expires.year, expires.month + 1
    grace_end = nth_business_day(next_year, next_month, 5)

    return grace_start <= today <= grace_end
