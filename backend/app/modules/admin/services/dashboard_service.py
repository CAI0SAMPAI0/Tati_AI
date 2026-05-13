"""
services/dashboard_service.py
Serviço centralizado para o Dashboard Admin.
Implementa queries reais ao banco de dados em vez de dados hardcoded.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi.concurrency import run_in_threadpool
from app.core.database import get_client

def parse_dt(value: Any) -> datetime:
    """Helper global para parsing de datas ISO."""
    if not value or not isinstance(value, str):
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        # Garante formato compatível com Python (Z -> +00:00)
        clean_val = value.replace('Z', '+00:00')
        dt = datetime.fromisoformat(clean_val)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)

class DashboardService:
    """Serviço de dados para o painel administrativo."""

    def __init__(self) -> None:
        self.db = get_client()

    # ── Estatísticas rápidas ─────────────────────────────────────────────────

    async def get_quick_stats(self) -> Dict[str, Any]:
        """Estatísticas rápidas para o overview do dashboard."""

        def _fetch() -> Dict[str, Any]:
            today = date.today().isoformat()

            try:
                res_users = self.db.table('users').select('username', count='exact').execute()
                total_students = res_users.count if res_users.count is not None else len(res_users.data)
            except Exception as e:
                print(f"[DashboardService] Erro ao contar usuários: {e}")
                total_students = 0

            try:
                # Tenta usar created_at, fallback para date
                res_msgs = (
                    self.db.table('messages')
                    .select('id', count='exact')
                    .gte('created_at', today)
                    .eq('role', 'user')
                    .execute()
                )
                messages_today = res_msgs.count if res_msgs.count is not None else 0
            except Exception:
                try:
                    res_msgs = (
                        self.db.table('messages')
                        .select('id', count='exact')
                        .gte('date', today)
                        .eq('role', 'user')
                        .execute()
                    )
                    messages_today = res_msgs.count if res_msgs.count is not None else 0
                except Exception as e:
                    print(f"[DashboardService] Erro ao contar mensagens: {e}")
                    messages_today = 0

            # Usuários que enviaram ao menos 1 mensagem hoje
            try:
                active_rows = (
                    self.db.table('messages')
                    .select('username')
                    .gte('date', today)
                    .eq('role', 'user')
                    .execute()
                    .data
                    or []
                )
                active_today = len({r.get('username') for r in active_rows if r.get('username')})
            except Exception:
                active_today = 0

            return {
                'total_students': total_students or 0,
                'total_messages': messages_today or 0,
                'active_today': active_today,
            }

        try:
            return await run_in_threadpool(_fetch)
        except Exception as e:
            print(f"[DashboardService] Erro crítico em get_quick_stats: {e}")
            return {
                'total_students': 0,
                'total_messages': 0,
                'active_today': 0,
                'error': str(e)
            }

    # ── Lista de alunos ──────────────────────────────────────────────────────

    async def get_students_list(self) -> List[Dict[str, Any]]:
        """Lista alunos com metadados completos."""

        def _fetch() -> List[Dict[str, Any]]:
            try:
                # Busca apenas colunas que temos certeza que existem
                users = (
                    self.db.table('users')
                    .select(
                        'username, name, email, level, focus, '
                        'created_at, role'
                    )
                    .limit(500)
                    .execute()
                    .data
                    or []
                )
            except Exception as e:
                print(f"[DashboardService] Erro ao buscar usuários (tentando colunas mínimas): {e}")
                try:
                    users = self.db.table('users').select('username, name, email').limit(500).execute().data or []
                except Exception as e2:
                    print(f"[DashboardService] Falha total ao buscar usuários: {e2}")
                    return []

            # Busca todas as mensagens recentes para identificar atividade recente
            try:
                msg_rows = (
                    self.db.table('messages')
                    .select('username, date')
                    .eq('role', 'user')
                    .order('date', desc=True)
                    .limit(2000)
                    .execute()
                    .data
                    or []
                )
            except Exception as e:
                print(f"[DashboardService] Erro ao buscar mensagens recentes: {e}")
                msg_rows = []

            # Agrupa última atividade por usuário
            last_activity = {}
            for r in msg_rows:
                uname = r.get('username')
                if uname and uname not in last_activity:
                    last_activity[uname] = r.get('date') or r.get('created_at', '')

            # Processa a lista final
            processed_users = []
            from app.core.config import settings
            staff_roles = getattr(settings, 'staff_roles', [])
            
            for u in users:
                username = u.get('username')
                if not username: continue
                
                # Prioriza data da última mensagem, senão data de criação
                last_active_str = last_activity.get(username) or u.get('created_at', '')
                
                u['is_staff'] = u.get('role') in staff_roles
                u['last_active'] = last_active_str
                
                processed_users.append(u)

            # Ordena por atividade mais recente
            try:
                processed_users.sort(
                    key=lambda x: parse_dt(x.get('last_active')),
                    reverse=True
                )
            except Exception as sort_err:
                print(f"[DashboardService] Erro ao ordenar alunos: {sort_err}")

            return processed_users

        try:
            return await run_in_threadpool(_fetch)
        except Exception as e:
            print(f"[DashboardService] Erro em get_students_list: {e}")
            return []

    # ── Relatórios ──────────────────────────────────────────────────────────

    async def get_reports_overview(self) -> Dict[str, Any]:
        """Visão geral de performance da turma."""
        
        def _fetch():
            try:
                res = self.db.table('user_errors').select('category', count='exact').execute()
                total_errors = res.count or 0
                
                # Agrupamento simples por categoria
                cat_res = self.db.table('user_errors').select('category').execute().data or []
                by_category = {}
                for r in cat_res:
                    cat = r.get('category', 'others')
                    by_category[cat] = by_category.get(cat, 0) + 1
                    
                return {
                    'total_errors_logged': total_errors,
                    'by_category': by_category
                }
            except Exception:
                return {'total_errors_logged': 0, 'by_category': {}}

        return await run_in_threadpool(_fetch)

    async def get_difficulties_stats(self) -> Dict[str, Any]:
        """Retorna distribuição de dificuldades/níveis dos alunos."""
        def _fetch():
            try:
                res = self.db.table('users').select('level').execute().data or []
                stats = {}
                for r in res:
                    lvl = r.get('level') or 'Unknown'
                    stats[lvl] = stats.get(lvl, 0) + 1
                return stats
            except Exception as e:
                print(f"[DashboardService] Erro em get_difficulties_stats: {e}")
                return {}

        return await run_in_threadpool(_fetch)
