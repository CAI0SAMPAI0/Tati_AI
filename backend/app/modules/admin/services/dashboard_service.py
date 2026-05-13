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
        """Visão geral de performance da turma — retorna dados para os gráficos do frontend."""

        def _fetch():
            try:
                # ── Atividade semanal (mensagens por dia nos últimos 7 dias) ──────
                weekly_activity = [0] * 7
                today = date.today()
                # Segunda-feira = índice 0, Domingo = índice 6
                week_start = today - timedelta(days=today.weekday())

                try:
                    since_iso = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
                    msg_rows = (
                        self.db.table('messages')
                        .select('date, created_at')
                        .eq('role', 'user')
                        .gte('created_at', since_iso)
                        .execute()
                        .data
                        or []
                    )
                    for r in msg_rows:
                        raw = r.get('created_at') or r.get('date') or ''
                        try:
                            dt = parse_dt(raw)
                            day_idx = (dt.date() - week_start).days
                            if 0 <= day_idx < 7:
                                weekly_activity[day_idx] += 1
                        except Exception:
                            pass
                except Exception as e:
                    print(f'[DashboardService] Erro ao buscar atividade semanal: {e}')

                # ── Distribuição de níveis ─────────────────────────────────────────
                level_distribution: Dict[str, int] = {}
                try:
                    user_rows = self.db.table('users').select('level').execute().data or []
                    for r in user_rows:
                        lvl = r.get('level') or 'Unknown'
                        level_distribution[lvl] = level_distribution.get(lvl, 0) + 1
                except Exception as e:
                    print(f'[DashboardService] Erro ao buscar níveis: {e}')

                return {
                    'weekly_activity': weekly_activity,
                    'level_distribution': level_distribution,
                }
            except Exception as e:
                print(f'[DashboardService] Erro crítico em get_reports_overview: {e}')
                return {
                    'weekly_activity': [0, 0, 0, 0, 0, 0, 0],
                    'level_distribution': {},
                }

        return await run_in_threadpool(_fetch)


    async def get_difficulties_stats(self) -> Dict[str, Any]:
        """Retorna distribuição de dificuldades/níveis dos alunos."""
        def _fetch():
            try:
                user_rows = self.db.table('users').select('username, level, created_at').execute().data or []
                level_dist: Dict[str, int] = {}
                alerts = []

                for r in user_rows:
                    lvl = r.get('level') or 'Unknown'
                    level_dist[lvl] = level_dist.get(lvl, 0) + 1

                    # Alerta: aluno no nível mais básico há mais de 30 dias
                    if lvl in ('Beginner', 'A1', 'Unknown'):
                        created = r.get('created_at') or ''
                        try:
                            dt = parse_dt(created)
                            days_since = (datetime.now(timezone.utc) - dt).days
                            if days_since > 30:
                                alerts.append({
                                    'username': r.get('username', '?'),
                                    'current_difficulty': f'{lvl} ({days_since}d)',
                                })
                        except Exception:
                            pass

                return {
                    'level_distribution': level_dist,
                    'alerts': alerts[:10],  # máximo 10 alertas
                }
            except Exception as e:
                print(f'[DashboardService] Erro em get_difficulties_stats: {e}')
                return {'level_distribution': {}, 'alerts': []}

        return await run_in_threadpool(_fetch)


    async def get_all_simulations(self) -> List[Dict[str, Any]]:
        """Lista todas as simulações cadastradas."""
        def _fetch():
            try:
                res = self.db.table('simulations').select('*').order('created_at', desc=True).execute()
                return res.data or []
            except Exception as e:
                print(f"[DashboardService] Erro em get_all_simulations: {e}")
                return []
        return await run_in_threadpool(_fetch)

    async def get_user_stats(self, username: str) -> Dict[str, Any]:
        """Estatísticas específicas de um aluno."""
        def _fetch():
            try:
                user_res = self.db.table('users').select('xp, level, focus').eq('username', username).limit(1).execute()
                user_data = user_res.data[0] if user_res.data else {}
                
                msg_res = self.db.table('messages').select('id', count='exact').eq('username', username).eq('role', 'user').execute()
                total_messages = msg_res.count or 0
                
                err_res = self.db.table('user_errors').select('id', count='exact').eq('username', username).execute()
                total_errors = err_res.count or 0
                
                return {
                    'xp': user_data.get('xp', 0),
                    'level': user_data.get('level', 'Beginner'),
                    'focus': user_data.get('focus', 'General English'),
                    'total_messages': total_messages,
                    'total_errors': total_errors
                }
            except Exception as e:
                print(f"[DashboardService] Erro em get_user_stats: {e}")
                return {}
        return await run_in_threadpool(_fetch)

    async def update_student(self, username: str, level: Optional[str] = None, custom_prompt: Optional[str] = None) -> dict:
        """Atualiza nível e/ou prompt de um aluno."""
        payload = {}
        if level: payload['level'] = level
        if custom_prompt: payload['custom_prompt'] = custom_prompt
        if not payload: return {'ok': True}
        def _exec():
            return self.db.table('users').update(payload).eq('username', username).execute()
        await run_in_threadpool(_exec)
        return {'ok': True}

    async def get_grammar_errors(self, username: str, lang: str = 'en-US') -> dict:
        """Analisa erros gramaticais de um aluno."""
        def _fetch():
            try:
                res = self.db.table('user_errors').select('*').eq('username', username).order('created_at', desc=True).limit(50).execute()
                return {'errors': res.data or []}
            except Exception:
                return {'errors': []}
        return await run_in_threadpool(_fetch)

    async def get_recommendations(self, username: str, lang: str = 'en-US') -> dict:
        """Retorna recomendações pedagógicas."""
        # Simplificado por enquanto
        return {
            'recommendations': [
                'Pratique mais conversação sobre temas do seu dia a dia.',
                'Assista a vídeos curtos sobre gramática básica.',
                'Tente usar novas palavras do seu vocabulário nas conversas.'
            ]
        }

    async def generate_simulation(self, topic: str, level: str, instructions: str) -> dict:
        """Gera um cenário de simulação via IA."""
        from app.modules.chat.services.llm import groq_chat
        import json, re
        
        prompt = (
            f"Create a professional English practice scenario about: {topic}.\n"
            f"Target Student Level: {level}. Extra Instructions: {instructions}.\n"
            "Return ONLY a JSON with: name, slug (url-friendly), description, difficulty (matching level), system_prompt (the persona), greeting (first message)."
        )
        try:
            resp_str = await groq_chat([{'role': 'user', 'content': prompt}])
            match = re.search(r'\{.*\}', resp_str, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                # Garante que is_active seja True para RLS
                data['is_active'] = True
                res = self.db.table('simulations').insert(data).execute()
                return res.data[0] if res.data else {'error': 'Falha ao salvar no banco'}
            return {'error': 'IA retornou formato inválido'}
        except Exception as e:
            return {'error': str(e)}
