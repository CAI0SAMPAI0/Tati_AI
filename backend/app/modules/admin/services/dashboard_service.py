import logging
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi.concurrency import run_in_threadpool
from app.core.dependencies.db import get_db
from fastapi import Depends


EXCLUDED_USERS = ['programador', 'professor', 'admin', 'caio', 'tati']


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

    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    # ── Estatísticas rápidas ──────────────────────────────────────────

    async def get_quick_stats(self) -> Dict[str, Any]:
        """Estatísticas rápidas para o overview do dashboard."""

        def _fetch() -> Dict[str, Any]:
            today = date.today().isoformat()

            try:
                res_users = (
                    self.db.table('users')
                    .select('username', count='exact')
                    .not_.in_('username', EXCLUDED_USERS)
                    .neq('role', 'buyer')
                    .execute()
                )

                res_buyers = (
                    self.db.table('users')
                    .select('username', count='exact')
                    .eq('role', 'buyer')
                    .execute()
                )
                total_students = res_users.count if res_users.count is not None else len(
                    res_users.data)
                total_buyers = res_buyers.count if res_buyers.count is not None else len(
                    res_buyers.data)
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro ao contar usuários: {e}")
                total_students = 0
                total_buyers = 0

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
                    logging.info(
                        f"[DashboardService] Erro ao contar mensagens: {e}")
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
                active_today = len({r.get('username')
                                   for r in active_rows if r.get('username')})
            except Exception:
                active_today = 0

            return {
                'total_students': total_students or 0,
                'total_buyers': total_buyers or 0,
                'total_messages': messages_today or 0,
                'active_today': active_today,
            }

        try:
            return await run_in_threadpool(_fetch)
        except Exception as e:
            logging.info(
                f"[DashboardService] Erro crítico em get_quick_stats: {e}")
            return {
                'total_students': 0,
                'total_messages': 0,
                'active_today': 0,
                'error': str(e)
            }

    # ── Lista de alunos ───────────────────────────────────────────────

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
                    .not_.in_('username', EXCLUDED_USERS)
                    .neq('role', 'buyer')
                    .limit(500)
                    .execute()
                    .data
                    or []
                )
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro ao buscar usuários (tentando colunas mínimas): {e}")
                try:
                    users = self.db.table('users').select(
                        'username, name, email').limit(500).execute().data or []
                except Exception as e2:
                    logging.info(
                        f"[DashboardService] Falha total ao buscar usuários: {e2}")
                    return []

            # Busca todas as mensagens recentes para identificar
            # atividade recente
            try:
                msg_rows = (
                    self.db.table('messages')
                    .select('username, created_at, date')
                    .eq('role', 'user')
                    .order('created_at', desc=True)
                    .limit(2000)
                    .execute()
                    .data
                    or []
                )
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro ao buscar mensagens recentes: {e}")
                msg_rows = []

            # Agrupa última atividade por usuário
            last_activity = {}
            for r in msg_rows:
                uname = r.get('username')
                if uname and uname not in last_activity:
                    # Usa created_at (que tem hora) e faz fallback para
                    # date
                    last_activity[uname] = r.get(
                        'created_at') or r.get('date', '')

            # Processa a lista final
            processed_users = []
            from app.core.config import settings
            staff_roles = getattr(settings, 'staff_roles', [])

            for u in users:
                username = u.get('username')
                if not username:
                    continue

                # Prioriza data da última mensagem, senão data de
                # criação
                last_active_str = last_activity.get(
                    username) or u.get('created_at', '')

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
                logging.info(
                    f"[DashboardService] Erro ao ordenar alunos: {sort_err}")

            return processed_users

        try:
            return await run_in_threadpool(_fetch)
        except Exception as e:
            logging.info(
                f"[DashboardService] Erro em get_students_list: {e}")
            return []

    # ── Relatórios ────────────────────────────────────────────────────

    async def get_reports_overview(self) -> Dict[str, Any]:
        """Visão geral de performance da turma — retorna dados para os gráficos do frontend."""

        def _fetch():
            try:
                # ── Atividade semanal (mensagens por dia nos últimos 7
                weekly_activity = [0] * 7
                today = date.today()
                # Segunda-feira = índice 0, Domingo = índice 6
                week_start = today - timedelta(days=today.weekday())

                try:
                    since_iso = datetime.combine(
                        week_start, datetime.min.time()).replace(
                        tzinfo=timezone.utc).isoformat()
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
                    logging.info(
                        f'[DashboardService] Erro ao buscar atividade semanal: {e}')

                # ── Distribuição de níveis ────────────────────────────
                level_distribution: Dict[str, int] = {}
                try:
                    user_rows = (
                        self.db.table('users')
                        .select('level')
                        .not_.in_('username', EXCLUDED_USERS)
                        .neq('role', 'buyer')
                        .execute()
                        .data
                        or []
                    )
                    for r in user_rows:
                        lvl = r.get('level') or 'Unknown'
                        level_distribution[lvl] = level_distribution.get(
                            lvl, 0) + 1
                except Exception as e:
                    logging.info(
                        f'[DashboardService] Erro ao buscar níveis: {e}')

                return {
                    'weekly_activity': weekly_activity,
                    'level_distribution': level_distribution,
                }
            except Exception as e:
                logging.info(
                    f'[DashboardService] Erro crítico em get_reports_overview: {e}')
                return {
                    'weekly_activity': [0, 0, 0, 0, 0, 0, 0],
                    'level_distribution': {},
                }

        return await run_in_threadpool(_fetch)

    async def get_difficulties_stats(self) -> Dict[str, Any]:
        """Retorna distribuição de dificuldades/níveis dos alunos e alertas baseados em IA."""
        import asyncio
        from app.modules.chat.services.llm import groq_chat

        def _fetch_users():
            try:
                user_rows = (
                    self.db.table('users')
                    .select('username, level, created_at')
                    .not_.in_('username', EXCLUDED_USERS)
                    .neq('role', 'buyer')
                    .execute()
                    .data
                    or []
                )
                level_dist: Dict[str, int] = {}
                for r in user_rows:
                    lvl = r.get('level') or 'Unknown'
                    level_dist[lvl] = level_dist.get(lvl, 0) + 1
                return level_dist
            except Exception:
                return {}

        def _fetch_recent_active():
            try:
                # Busca as últimas 1000 mensagens para abranger mais
                # alunos
                res = self.db.table('messages').select('username, content').eq(
                    'role', 'user').not_.in_(
                    'username', EXCLUDED_USERS).order(
                    'created_at', desc=True).limit(1000).execute().data or []
                user_msgs = {}
                for r in res:
                    u = r.get('username')
                    if u:
                        # Mantemos apenas as 10 mais recentes de cada um
                        # para análise
                        if u not in user_msgs:
                            user_msgs[u] = []
                        if len(user_msgs[u]) < 10:
                            user_msgs[u].append(r.get('content', ''))

                return list(user_msgs.items())
            except Exception:
                return []

        level_dist = await run_in_threadpool(_fetch_users)
        top_users = await run_in_threadpool(_fetch_recent_active)

        alerts = []
        # Limita chamadas paralelas para não travar o rate limit
        sem = asyncio.Semaphore(5)

        async def analyze_user(username, msgs):
            async with sem:
                context = " | ".join(msgs[:10])
                prompt = (
                    f"Analyze these messages from an English learner and identify their main language difficulty or struggle in 2-4 words "
                    f"(e.g. 'Past Tense', 'Vocabulary', 'Prepositions', 'Basic Phrasing'). "
                    f"Return ONLY the 2-4 words, nothing else.\n"
                    f"Messages: {context}"
                )
                try:
                    difficulty = await groq_chat([{"role": "user", "content": prompt}], temperature=0.1)

                    if len(difficulty) > 40:
                        difficulty = "General Grammar"

                    alerts.append({
                        'username': username,
                        'current_difficulty': difficulty.strip().replace('"', '')
                    })
                except Exception:
                    pass

        tasks = [analyze_user(u, msgs) for u, msgs in top_users]
        if tasks:
            await asyncio.gather(*tasks)

        # Ordenar os alertas por username para consistência
        alerts.sort(key=lambda x: x['username'])

        return {
            'level_distribution': level_dist,
            'alerts': alerts,
        }

    async def get_all_simulations(self) -> List[Dict[str, Any]]:
        """Lista todas as simulações cadastradas."""
        def _fetch():
            try:
                res = self.db.table('simulations').select(
                    '*').order('created_at', desc=True).execute()
                return res.data or []
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro em get_all_simulations: {e}")
                return []
        return await run_in_threadpool(_fetch)

    async def get_user_stats(self, username: str) -> Dict[str, Any]:
        """Estatísticas específicas de um aluno."""
        def _fetch():
            try:
                user_res = self.db.table('users').select('xp, level, focus').eq(
                    'username', username).limit(1).execute()
                user_data = user_res.data[0] if user_res.data else {}

                msg_res = self.db.table('messages').select(
                    'id',
                    count='exact').eq(
                    'username',
                    username).eq(
                    'role',
                    'user').execute()
                total_messages = msg_res.count or 0

                err_res = self.db.table('user_errors').select(
                    'id', count='exact').eq(
                    'username', username).execute()
                total_errors = err_res.count or 0

                return {
                    'xp': user_data.get('xp', 0),
                    'level': user_data.get('level', 'Beginner'),
                    'focus': user_data.get('focus', 'General English'),
                    'total_messages': total_messages,
                    'total_errors': total_errors
                }
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro em get_user_stats: {e}")
                return {}
        return await run_in_threadpool(_fetch)

    async def update_student(
            self,
            username: str,
            level: Optional[str] = None,
            custom_prompt: Optional[str] = None) -> dict:
        """Atualiza nível e/ou prompt de um aluno."""
        payload = {}
        if level:
            payload['level'] = level
        if custom_prompt:
            payload['custom_prompt'] = custom_prompt
        if not payload:
            return {'ok': True}

        def _exec():
            return self.db.table('users').update(
                payload).eq('username', username).execute()
        await run_in_threadpool(_exec)
        return {'ok': True}

    async def get_grammar_errors(
            self,
            username: str,
            lang: str = 'en-US') -> dict:
        """Analisa erros gramaticais de um aluno."""
        def _fetch():
            try:
                res = self.db.table('user_errors').select(
                    '*').eq('username', username).order('created_at', desc=True).limit(50).execute()
                return {'errors': res.data or []}
            except Exception:
                return {'errors': []}
        return await run_in_threadpool(_fetch)

    async def get_recommendations(
            self,
            username: str,
            lang: str = 'en-US') -> dict:
        """Retorna recomendações pedagógicas."""
        # Simplificado por enquanto
        return {
            'recommendations': [
                'Pratique mais conversação sobre temas do seu dia a dia.',
                'Assista a vídeos curtos sobre gramática básica.',
                'Tente usar novas palavras do seu vocabulário nas conversas.']}

    async def generate_simulation(
            self,
            topic: str,
            level: str,
            instructions: str) -> dict:
        """Gera um cenário de simulação via IA."""
        from app.modules.chat.services.llm import groq_chat_json

        prompt = (
            f"Create a professional English practice scenario about: {topic}.\n"
            f"Target Student Level: {level}. Extra Instructions: {instructions}.\n"
            "Return ONLY a JSON with: name, slug (url-friendly), description, difficulty (matching level), system_prompt (the persona), greeting (first message)."
        )
        try:
            data = await groq_chat_json([{'role': 'user', 'content': prompt}])
            if data:
                # Garante que is_active seja True para RLS
                data['is_active'] = True
                res = self.db.table(
                    'simulations').insert(data).execute()
                return res.data[0] if res.data else {
                    'error': 'Falha ao salvar no banco'}
            return {'error': 'IA retornou formato inválido'}
        except Exception as e:
            return {'error': str(e)}

    async def delete_student(self, username: str) -> bool:
        """Exclui um usuário (aluno ou buyer) e todos os seus dados vinculados — evita erros de FK."""
        def _delete():
            # ── 0. Resolve o username EXATO como está no banco (não forçar lowercase) ─
            # O bug original: .lower() fazia o match falhar se o DB tinha capitalização
            # diferente, resultando em orders não removidos e FK
            # bloqueando a deleção.
            try:
                user_row = (
                    self.db.table('users')
                    .select('username')
                    .eq('username', username.strip())
                    .limit(1)
                    .execute()
                    .data
                )
                if not user_row:
                    # Fallback: busca insensível a maiúsculas
                    user_row = (
                        self.db.table('users')
                        .select('username')
                        .ilike('username', username.strip())
                        .limit(1)
                        .execute()
                        .data
                    )
                uname = user_row[0]['username'] if user_row else username.strip(
                )
            except Exception as e:
                logging.info(
                    f"[DashboardService] Aviso ao resolver username exato: {e}")
                uname = username.strip()

            logging.info(
                f"[DashboardService] Iniciando exclusão total do usuário: '{uname}'")

            # ── 1. Limpeza de pedidos e itens (orders — FK crítica!) ──
            try:
                orders = (
                    self.db.table('orders')
                    .select('id')
                    .eq('username', uname)
                    .execute()
                    .data
                ) or []
                logging.info(
                    f"[DashboardService] {
                        len(orders)} pedido(s) encontrado(s) para '{uname}'")
                if orders:
                    order_ids = [o['id'] for o in orders]
                    self.db.table('order_items').delete().in_(
                        'order_id', order_ids).execute()
                    self.db.table('orders').delete().eq(
                        'username', uname).execute()
                    logging.info(
                        f"[DashboardService] orders/order_items de '{uname}' removidos.")
            except Exception as e:
                logging.info(
                    f"[DashboardService] ERRO ao limpar orders/items para '{uname}': {e}")

            # ── Verificação de segurança — garante que orders foram lim
            try:
                remaining = (
                    self.db.table('orders')
                    .select('id', count='exact')
                    .eq('username', uname)
                    .execute()
                )
                still_there = remaining.count or len(
                    remaining.data or [])
                if still_there > 0:
                    raise RuntimeError(
                        f"Ainda existem {still_there} pedido(s) em 'orders' para '{uname}'. "
                        "Configure ON DELETE CASCADE na FK orders_username_fkey no Supabase, "
                        "ou remova os pedidos manualmente antes de deletar o usuário."
                    )
            except RuntimeError:
                raise  # erro crítico — propaga para o caller
            except Exception as e:
                logging.info(
                    f"[DashboardService] Aviso na verificação de orders para '{uname}': {e}")

            # ── 2. Limpeza de conversas e mensagens vinculadas ────────
            try:
                convs = (
                    self.db.table('conversations')
                    .select('id')
                    .eq('username', uname)
                    .execute()
                    .data
                ) or []
                if convs:
                    conv_ids = [c['id'] for c in convs]
                    self.db.table('messages').delete().in_(
                        'session_id', conv_ids).execute()
                    self.db.table('conversations').delete().eq(
                        'username', uname).execute()
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro ao limpar conversas/mensagens para '{uname}': {e}")

            # ── 3. Tabelas com FK direta em username ──────────────────
            tables = [
                'messages',              # órfãs diretas
                'activity_submissions',
                'user_exercise_attempts',
                'user_errors',
                'user_vocabulary',
                'notifications',
                'premium_purchases',
                'study_sessions',
                'user_trophies',
                'user_progress',
                'user_actions',
                'user_streaks',
                'user_goals',
                'user_stats',
                'flashcards',
                'user_feedback',
            ]

            for table in tables:
                try:
                    self.db.table(table).delete().eq(
                        'username', uname).execute()
                except Exception as e:
                    err_msg = str(e)
                    if 'PGRST205' not in err_msg:  # ignora "tabela não existe"
                        logging.info(
                            f"[DashboardService] Erro ao limpar {table} para '{uname}': {e}")

            # ── 4. Deleta o usuário ───────────────────────────────────
            try:
                res = self.db.table('users').delete().eq(
                    'username', uname).execute()
                logging.info(
                    f"[DashboardService] Usuário '{uname}' excluído. Resposta: {
                        res.data}")
                return True
            except Exception as e:
                logging.info(
                    f"[DashboardService] ERRO CRÍTICO ao deletar usuário '{uname}': {e}")
                raise e

        return await run_in_threadpool(_delete)

    async def get_buyers_list(self) -> List[Dict[str, Any]]:
        """Lista usuários com role=buyer com total gasto via orders/order_items."""

        def _fetch() -> List[Dict[str, Any]]:
            try:
                users = (
                    self.db.table('users')
                    .select('username, name, email, created_at, role')
                    .eq('role', 'buyer')
                    .limit(500)
                    .execute()
                    .data
                    or []
                )
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro ao buscar buyers: {e}")
                return []

            # Busca orders confirmadas com seus itens
            # Fazemos dois fetches separados para evitar joins complexos
            # via PostgREST
            try:
                orders_rows = (
                    self.db.table('orders')
                    .select('id, username, total_amount, status, confirmed_at, created_at, payment_method')
                    .eq('status', 'confirmed')
                    .execute()
                    .data
                    or []
                )
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro ao buscar orders: {e}")
                orders_rows = []

            # Agrupa orders por username
            orders_by_user: Dict[str, List[dict]] = {}
            for o in orders_rows:
                uname = o.get('username')
                if uname:
                    if uname not in orders_by_user:
                        orders_by_user[uname] = []
                    orders_by_user[uname].append(o)

            processed = []
            for u in users:
                username = u.get('username')
                if not username:
                    continue

                user_orders = orders_by_user.get(username, [])

                total_spent = sum(
                    float(o.get('total_amount') or 0)
                    for o in user_orders
                )
                total_purchases = len(user_orders)

                # Data da última compra confirmada
                last_purchase_at = ''
                if user_orders:
                    dates = [o.get('confirmed_at') or o.get(
                        'created_at') or '' for o in user_orders]
                    last_purchase_at = max(dates, default='')

                u['total_purchases'] = total_purchases
                u['total_spent'] = round(total_spent, 2)
                u['last_purchase_at'] = last_purchase_at
                u['last_active'] = last_purchase_at or u.get(
                    'created_at', '')
                processed.append(u)

            try:
                processed.sort(
                    key=lambda x: parse_dt(x.get('last_active')),
                    reverse=True
                )
            except Exception:
                pass

            return processed

        try:
            return await run_in_threadpool(_fetch)
        except Exception as e:
            logging.info(
                f"[DashboardService] Erro em get_buyers_list: {e}")
            return []
