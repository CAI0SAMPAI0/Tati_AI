from __future__ import annotations

import logging

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi.concurrency import run_in_threadpool
from app.core.dependencies.db import get_db
from fastapi import Depends
from app.core.enums import normalize_level



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
                # Busca colunas incluindo streak_data
                users = (
                    self.db.table('users')
                    .select(
                        'username, name, email, level, focus, '
                        'created_at, role, streak_data'
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
            from datetime import datetime, timezone

            for u in users:
                username = u.get('username')
                if not username:
                    continue

                # Prioriza data da última mensagem, senão data de criação
                last_active_str = last_activity.get(username) or u.get('created_at', '')

                # Calcula dias de inatividade e nível de risco
                days_inactive = 0
                risk_level = "active"
                if last_active_str:
                    try:
                        last_active_dt = parse_dt(last_active_str)
                        now = datetime.now(timezone.utc) if last_active_dt.tzinfo else datetime.now()
                        delta = now - last_active_dt
                        days_inactive = max(0, delta.days)
                        if days_inactive > 14:
                            risk_level = "critical"
                        elif days_inactive > 7:
                            risk_level = "warning"
                    except Exception as date_err:
                        logging.info(f"[DashboardService] Erro ao processar data para {username}: {date_err}")

                st_data = u.get('streak_data') or {}
                if not isinstance(st_data, dict):
                    st_data = {}
                u['current_streak'] = st_data.get('current_streak', 0)
                u['longest_streak'] = st_data.get('longest_streak', 0)
                u['streak_freeze_count'] = st_data.get('streak_freeze_count', 0)

                u['is_staff'] = u.get('role') in staff_roles
                u['last_active'] = last_active_str
                u['days_inactive'] = days_inactive
                u['risk_level'] = risk_level

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
                        lvl = normalize_level(r.get('level'))
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
                    lvl = normalize_level(r.get('level'))
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
        from app.shared.services.upstash import cache_get, cache_set
        cache_key = f'user_stats:{username}'
        cached = await cache_get(cache_key)
        if cached:
            return cached

        def _fetch():
            try:
                user_res = self.db.table('users').select('xp_data, level, focus').eq(
                    'username', username).limit(1).execute()
                user_data = user_res.data[0] if user_res.data else {}
                xp_data = user_data.get('xp_data') or {}
                
                xp_val = xp_data.get('xp') or 0
                level_str = normalize_level(xp_data.get('level') or user_data.get('level') or 'A1')
                
                LEVELS_CONFIG = {
                    'A1': {'min': 0, 'max': 500},
                    'A2': {'min': 500, 'max': 1200},
                    'B1': {'min': 1200, 'max': 2500},
                    'B2': {'min': 2500, 'max': 4000},
                    'C1': {'min': 4000, 'max': 6000},
                    'C2': {'min': 6000, 'max': 999999},
                }
                l_conf = LEVELS_CONFIG.get(level_str, LEVELS_CONFIG['A1'])
                xp_in_level = max(0, xp_val - l_conf['min'])
                xp_needed = l_conf['max'] - l_conf['min']
                fallback_prog = min(100, int((xp_in_level / xp_needed) * 100)) if xp_needed > 0 else 0

                msg_res = self.db.table('messages').select(
                    'id', count='exact').eq('username', username).eq('role', 'user').execute()
                total_messages = msg_res.count or 0

                err_res = self.db.table('user_errors').select(
                    'id', count='exact').eq('username', username).execute()
                total_errors = err_res.count or 0

                return {
                    'xp': xp_val,
                    'total_xp': xp_data.get('total_xp_earned') or xp_val,
                    'level': level_str,
                    'level_progress': xp_data.get('level_progress') or fallback_prog,
                    'focus': user_data.get('focus', 'General English'),
                    'total_messages': total_messages,
                    'total_errors': total_errors
                }
            except Exception as e:
                logging.info(
                    f"[DashboardService] Erro em get_user_stats: {e}")
                return {}
        res = await run_in_threadpool(_fetch)
        if res:
            await cache_set(cache_key, res, ttl=180)  # 3 minutos de cache
        return res


    async def get_student_detail_analytics(self, username: str) -> Dict[str, Any]:
        """Retorna analíticos detalhados de progresso e engajamento do aluno."""
        def _fetch():
            # 1. Obter progresso por módulo
            modules = self.db.table('modules').select('id, title, order, flashcards').order('order').execute().data or []
            quizzes = self.db.table('quizzes').select('id, module_id, title').execute().data or []
            user_progress = self.db.table('user_progress').select('quiz_id, score').eq('username', username).execute().data or []
            
            completed_quiz_ids = {p['quiz_id'] for p in user_progress}
            
            # Busca submissões do usuário na tabela activity_submissions para ver se completou módulos de flashcards/outros
            try:
                submissions = self.db.table('activity_submissions')\
                    .select('module_id, activity_type')\
                    .eq('username', username)\
                    .execute()\
                    .data or []
                completed_module_ids = {s['module_id'] for s in submissions if s.get('module_id')}
            except Exception:
                completed_module_ids = set()
            
            # Agrupa quizzes por módulo
            quizzes_by_module = {}
            for q in quizzes:
                m_id = q.get('module_id')
                if m_id is not None:
                    quizzes_by_module.setdefault(m_id, []).append(q)
                    
            module_progress_list = []
            for m in modules:
                m_id = m['id']
                mod_quizzes = quizzes_by_module.get(m_id, [])
                total_quizzes = len(mod_quizzes)
                
                # Se o módulo tem quizzes, calculamos com base neles
                if total_quizzes > 0:
                    completed_count = sum(1 for q in mod_quizzes if q['id'] in completed_quiz_ids)
                    # Se não constar no user_progress, mas constar no activity_submissions como feito
                    if completed_count == 0 and m_id in completed_module_ids:
                        completed_count = total_quizzes
                    progress_pct = int((completed_count / total_quizzes) * 100)
                    type_label = "Quizzes"
                else:
                    # Módulos sem quizzes (ex: Decks de Flashcards, podcasts, lições de texto)
                    total_quizzes = 1
                    completed_count = 1 if m_id in completed_module_ids else 0
                    progress_pct = 100 if completed_count == 1 else 0
                    # Tenta inferir o tipo do módulo
                    if m.get('flashcards') and len(m.get('flashcards') or []) > 0:
                        type_label = "Flashcards"
                    else:
                        type_label = "Activity"
                    
                module_progress_list.append({
                    "module_id": m_id,
                    "title": m['title'],
                    "order": m.get('order', 0),
                    "total_quizzes": total_quizzes,
                    "completed_quizzes": completed_count,
                    "progress_pct": progress_pct,
                    "type_label": type_label
                })
                
            # 2. Obter tempo de estudo (últimos 7 dias)
            from datetime import date, timedelta
            start_date = date.today() - timedelta(days=6)
            since_iso = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc).isoformat()
            
            chart_data = []
            total_study_minutes = 0.0
            total_messages = 0
            total_activities = 0
            
            # Inicializa estrutura para os 7 dias
            days_map = {}
            for i in range(7):
                d = start_date + timedelta(days=i)
                d_str = d.isoformat()
                days_map[d_str] = {
                    "date": d_str,
                    "day_name": d.strftime('%a'),
                    "study_minutes": 0.0,
                    "messages_sent": 0,
                    "activities_completed": 0
                }
                
            try:
                # Busca sessões de estudo da tabela study_sessions
                sessions = self.db.table('study_sessions')\
                    .select('created_at, duration_minutes, activity_type')\
                    .eq('username', username)\
                    .gte('created_at', since_iso)\
                    .execute()\
                    .data or []
                
                for s in sessions:
                    raw_dt = s.get('created_at')
                    if raw_dt:
                        try:
                            dt = parse_dt(raw_dt)
                            d_str = dt.date().isoformat()
                            if d_str in days_map:
                                days_map[d_str]["study_minutes"] += float(s.get('duration_minutes') or 0.0)
                                days_map[d_str]["activities_completed"] += 1
                        except Exception:
                            pass
            except Exception as e:
                logging.info(f"[DashboardService] Erro ao buscar study_sessions para analíticos: {e}")
                
            try:
                # Busca mensagens da tabela messages
                messages_list = self.db.table('messages')\
                    .select('created_at, date')\
                    .eq('username', username)\
                    .eq('role', 'user')\
                    .gte('created_at', since_iso)\
                    .execute()\
                    .data or []
                
                for m in messages_list:
                    raw_dt = m.get('created_at') or m.get('date')
                    if raw_dt:
                        try:
                            dt = parse_dt(raw_dt)
                            d_str = dt.date().isoformat()
                            if d_str in days_map:
                                days_map[d_str]["messages_sent"] += 1
                        except Exception:
                            pass
            except Exception as e:
                logging.info(f"[DashboardService] Erro ao buscar mensagens para analíticos: {e}")
                
            # Consolida resultados
            for d_str in sorted(days_map.keys()):
                d_data = days_map[d_str]
                # Estima tempo de chat: cada mensagem enviada conta como 1.5 minutos de leitura/escrita ativa
                chat_est_minutes = d_data["messages_sent"] * 1.5
                d_data["study_minutes"] = round(d_data["study_minutes"] + chat_est_minutes, 1)
                
                total_study_minutes += d_data["study_minutes"]
                total_messages += d_data["messages_sent"]
                total_activities += d_data["activities_completed"]
                chart_data.append(d_data)
                
            avg_study_minutes = round(total_study_minutes / 7, 1)
            
            return {
                "module_progress": module_progress_list,
                "study_time_chart": chart_data,
                "summary": {
                    "avg_study_minutes_daily": avg_study_minutes,
                    "total_study_minutes_weekly": round(total_study_minutes, 1),
                    "total_messages_weekly": total_messages,
                    "total_activities_weekly": total_activities
                }
            }
        return await run_in_threadpool(_fetch)


    async def nudge_student(self, username: str, text: str) -> dict:
        """Envia uma mensagem de nudge para o aluno via chat, push e email."""
        from datetime import datetime, timezone
        
        def _execute():
            # 1. Encontra a última conversa do aluno para associar a mensagem
            convs = self.db.table('conversations')\
                .select('id')\
                .eq('username', username)\
                .order('updated_at', desc=True)\
                .limit(1)\
                .execute()\
                .data or []
            
            if convs:
                conv_id = convs[0]['id']
            else:
                # Cria uma nova conversa se o aluno não tiver nenhuma
                new_conv = {
                    'username': username,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat(),
                }
                res_conv = self.db.table('conversations').insert(new_conv).execute()
                conv_id = res_conv.data[0]['id'] if res_conv.data else None
                
            if not conv_id:
                return {"success": False, "error": "Could not identify/create conversation"}
                
            # 2. Insere a mensagem no chat com o papel 'assistant' (Teacher Tati)
            now = datetime.now()
            msg = {
                'session_id': conv_id,
                'username': username,
                'role': 'assistant',
                'content': text,
                'date': now.strftime('%Y-%m-%d'),
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            self.db.table('messages').insert(msg).execute()
            self.db.table('conversations').update({
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).eq('id', conv_id).execute()
            
            return {"success": True}
            
        res = await run_in_threadpool(_execute)
        if not res.get("success"):
            return res
            
        # 3. Dispara a notificação push e email universalmente
        try:
            from app.modules.notifications.services.notification_dispatcher import dispatch_universal_notification
            await dispatch_universal_notification(
                username,
                title="Teacher Tati 🍎",
                body=text,
                url="/chat"
            )
        except Exception as push_err:
            logging.warning(f"[DashboardService] Erro ao enviar push/email nudge: {push_err}")
            
        return {"success": True}


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
                    'category').eq('username', username).execute()
                data = res.data or []
                counts = {}
                for row in data:
                    cat = row.get('category') or 'general'
                    counts[cat] = counts.get(cat, 0) + 1
                
                grouped = [{'category': k, 'count': v} for k, v in counts.items()]
                grouped.sort(key=lambda x: x['count'], reverse=True)
                return {'errors': grouped}
            except Exception:
                return {'errors': []}
        return await run_in_threadpool(_fetch)

    async def get_recommendations(
            self,
            username: str,
            lang: str = 'en-US') -> dict:
        """Retorna interesses mapeados e recomendações pedagógicas via IA."""
        from app.modules.chat.services.llm import groq_chat_json
        
        def _fetch_messages():
            try:
                res = self.db.table('messages')\
                    .select('content')\
                    .eq('username', username)\
                    .eq('role', 'user')\
                    .order('created_at', desc=True)\
                    .limit(30)\
                    .execute()
                return [m.get('content', '') for m in res.data or []]
            except Exception:
                return []
                
        user_msgs = await run_in_threadpool(_fetch_messages)
        context = " | ".join(user_msgs)[:2000]
        
        prompt = (
            f"Analyze the following recent English messages of student '{username}' to identify their personal/professional interests/hobbies, "
            f"and generate 3 tailored pedagogical recommendations to improve their English.\n"
            f"Student Messages: {context}\n\n"
            "Return strictly a JSON object with this exact shape (hobbies/interests should be short tags, and everything MUST be in English):\n"
            "{\n"
            "  \"interests\": [\"Travel\", \"Technology\", \"Career\"],\n"
            "  \"recommendations\": [\n"
            "    {\"recommendation\": \"Practice past tenses\", \"description\": \"I noticed struggles using the Simple Past when describing your previous trips. Try focusing on past events in your next chat.\"},\n"
            "    {\"recommendation\": \"Business English focus\", \"description\": \"Since you use English for tech meetings, try practicing corporate terms like 'milestone', 'deliverable', and 'alignment'.\"}\n"
            "  ]\n"
            "}\n"
            "If the message history is empty, return generic but useful recommendations and interests like 'Conversation', 'Grammar'."
        )
        
        try:
            result = await groq_chat_json([{'role': 'user', 'content': prompt}])
            if result and isinstance(result, dict) and 'interests' in result and 'recommendations' in result:
                return result
        except Exception as e:
            logging.info(f"[DashboardService] Erro ao gerar interesses/recomendações via IA: {e}")
            
        # Fallback se a IA falhar ou retornar nulo
        return {
            'interests': ['General', 'Grammar', 'Vocabulary'],
            'recommendations': [
                {
                    'recommendation': 'Focus on Conversation',
                    'description': 'Practice more conversation on topics of your daily life with Tati.'
                },
                {
                    'recommendation': 'Grammar Review',
                    'description': 'Watch short videos about basic grammar and try to apply them in the chat.'
                },
                {
                    'recommendation': 'Active Vocabulary',
                    'description': 'Try using new words from your vocabulary list in your daily conversations.'
                }
            ]
        }

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
