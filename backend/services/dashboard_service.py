"""
services/dashboard_service.py
Serviço centralizado para o Dashboard Admin.
Implementa queries reais ao banco de dados em vez de dados hardcoded.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi.concurrency import run_in_threadpool
from services.database import get_client


class DashboardService:
    """Serviço de dados para o painel administrativo."""

    def __init__(self) -> None:
        self.db = get_client()

    # ── Estatísticas rápidas ─────────────────────────────────────────────────

    async def get_quick_stats(self) -> Dict[str, Any]:
        """Estatísticas rápidas para o overview do dashboard."""

        def _fetch() -> Dict[str, Any]:
            today = date.today().isoformat()

            res_users = self.db.table('users').select('username', count='exact').execute()
            total_students = res_users.count if res_users.count is not None else len(res_users.data)

            res_msgs = (
                self.db.table('messages')
                .select('id', count='exact')
                .gte('created_at', today)
                .eq('role', 'user')
                .execute()
            )
            messages_today = res_msgs.count if res_msgs.count is not None else 0

            # Usuários que enviaram ao menos 1 mensagem hoje
            active_rows = (
                self.db.table('messages')
                .select('username')
                .gte('created_at', today)
                .eq('role', 'user')
                .execute()
                .data
                or []
            )
            active_today = len({r['username'] for r in active_rows})

            return {
                'total_students': total_students or 0,
                'total_messages': messages_today or 0,
                'active_today': active_today,
            }

        return await run_in_threadpool(_fetch)

    # ── Lista de alunos ──────────────────────────────────────────────────────

    async def get_students_list(self) -> List[Dict[str, Any]]:
        """Lista alunos com metadados completos."""

        def _fetch() -> List[Dict[str, Any]]:
            # Tentativa de busca com avatar_url
            try:
                users = (
                    self.db.table('users')
                    .select(
                        'username, name, email, level, focus, profile, '
                        'created_at, role, streak_data, avatar_url'
                    )
                    .order('created_at', desc=True)
                    .limit(200)
                    .execute()
                    .data
                    or []
                )
            except Exception as e:
                # Fallback se a coluna avatar_url não existir (erro 42703)
                if 'avatar_url' in str(e):
                    print("[DashboardService] Coluna 'avatar_url' não encontrada. Usando fallback via 'profile'.")
                    users = (
                        self.db.table('users')
                        .select(
                            'username, name, email, level, focus, profile, '
                            'created_at, role, streak_data'
                        )
                        .order('created_at', desc=True)
                        .limit(200)
                        .execute()
                        .data
                        or []
                    )
                else:
                    raise e

            # Contagem de mensagens por usuário (batch)
            msg_rows = (
                self.db.table('messages')
                .select('username')
                .eq('role', 'user')
                .execute()
                .data
                or []
            )
            msg_count: Dict[str, int] = {}
            for r in msg_rows:
                u = r.get('username', '')
                msg_count[u] = msg_count.get(u, 0) + 1

            # Última atividade por usuário
            last_rows = (
                self.db.table('messages')
                .select('username, created_at')
                .eq('role', 'user')
                .order('created_at', desc=True)
                .limit(1000)
                .execute()
                .data
                or []
            )
            last_active: Dict[str, str] = {}
            for r in last_rows:
                u = r.get('username', '')
                if u not in last_active:
                    last_active[u] = r.get('created_at', '')

            for user in users:
                uname = user.get('username', '')
                user['total_messages'] = msg_count.get(uname, 0)
                user['last_active'] = last_active.get(uname)
                
                # Sincroniza avatar_url da coluna top-level ou do JSON profile
                avatar = user.get('avatar_url')
                if not avatar:
                    avatar = (user.get('profile') or {}).get('avatar_url', '')
                user['avatar_url'] = avatar

            return users

        return await run_in_threadpool(_fetch)

    # ── Atualizar aluno ──────────────────────────────────────────────────────

    async def update_student(
        self, username: str, level: Optional[str] = None, custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Atualiza nível e/ou prompt customizado de um aluno."""

        def _update() -> Dict[str, Any]:
            payload: Dict[str, Any] = {
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            if level is not None:
                payload['level'] = level
            if custom_prompt is not None:
                payload['custom_prompt'] = custom_prompt

            result = (
                self.db.table('users')
                .update(payload)
                .eq('username', username)
                .execute()
            )
            return result.data[0] if result.data else {}

        return await run_in_threadpool(_update)

    # ── Reports / Overview ───────────────────────────────────────────────────

    async def get_reports_overview(self) -> Dict[str, Any]:
        """Retorna dados reais para a seção de relatórios."""

        def _fetch() -> Dict[str, Any]:
            today = date.today()

            # Total de alunos
            res_users = self.db.table('users').select('username', count='exact').execute()
            total_students = res_users.count if res_users.count is not None else 0

            # Total de mensagens
            res_total_msgs = (
                self.db.table('messages')
                .select('id', count='exact')
                .eq('role', 'user')
                .execute()
            )
            total_messages = res_total_msgs.count if res_total_msgs.count is not None else 0

            # Ativos hoje
            today_str = today.isoformat()
            active_rows = (
                self.db.table('messages')
                .select('username')
                .gte('created_at', today_str)
                .eq('role', 'user')
                .execute()
                .data
                or []
            )
            active_today = len({r['username'] for r in active_rows})

            # Atividade semanal (últimos 7 dias, segunda=0 ... domingo=6)
            weekly: List[int] = [0] * 7
            start_week = today - timedelta(days=6)
            week_rows = (
                self.db.table('messages')
                .select('created_at')
                .eq('role', 'user')
                .gte('created_at', start_week.isoformat())
                .execute()
                .data
                or []
            )
            for r in week_rows:
                raw = r.get('created_at', '')
                try:
                    # Aceita ISO com ou sem timezone
                    dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
                    # Índice: 0 = 6 dias atrás, 6 = hoje
                    idx = (dt.date() - start_week).days
                    if 0 <= idx <= 6:
                        weekly[idx] += 1
                except Exception:
                    pass

            # Distribuição de níveis
            level_rows = (
                self.db.table('users')
                .select('level')
                .execute()
                .data
                or []
            )
            level_dist: Dict[str, int] = {}
            for r in level_rows:
                lv = r.get('level') or 'Unknown'
                level_dist[lv] = level_dist.get(lv, 0) + 1

            return {
                'total_students': total_students,
                'total_messages': total_messages,
                'active_today': active_today,
                'weekly_activity': weekly,
                'level_distribution': level_dist,
            }

        return await run_in_threadpool(_fetch)

    # ── Análise de erros gramaticais ────────────────────────────────────────

    async def get_grammar_errors(self, username: str, lang: str = 'en-US') -> Dict[str, Any]:
        """Analisa mensagens do aluno e extrai erros gramaticais recorrentes (English Only)."""
        from services.llm import groq_chat

        def _fetch_messages() -> str:
            rows = (
                self.db.table('messages')
                .select('content')
                .eq('username', username)
                .eq('role', 'user')
                .order('created_at', desc=True)
                .limit(30)
                .execute()
                .data
                or []
            )
            return ' | '.join(r.get('content', '') for r in rows)

        messages_text = await run_in_threadpool(_fetch_messages)
        if not messages_text.strip():
            return {'errors': []}

        prompt = (
            f'Analyze these English messages from a student and list the top grammar errors. '
            f'Return JSON: [{{"category": "...", "count": N, "example": "..."}}]. '
            f'Language: English. Messages: {messages_text[:1500]}'
        )
        try:
            import json
            import re
            raw = await groq_chat([{'role': 'user', 'content': prompt}])
            match = re.search(r'\[.*\]', raw, re.DOTALL)
            errors = json.loads(match.group(0)) if match else []
            return {'errors': errors}
        except Exception as exc:
            print(f'[Dashboard] Erro ao analisar erros gramaticais: {exc}')
            return {'errors': []}

    # ── Recomendações de interesses ─────────────────────────────────────────

    async def get_recommendations(self, username: str, lang: str = 'pt-BR') -> Dict[str, Any]:
        """Analisa histórico e retorna interesses + recomendações pedagógicas."""
        from services.llm import groq_chat

        def _fetch_messages() -> str:
            rows = (
                self.db.table('messages')
                .select('content')
                .eq('username', username)
                .eq('role', 'user')
                .order('created_at', desc=True)
                .limit(20)
                .execute()
                .data
                or []
            )
            return ' '.join(r.get('content', '') for r in rows)

        messages_text = await run_in_threadpool(_fetch_messages)
        if not messages_text.strip():
            return {'interests': [], 'recommendations': []}

        prompt = (
            f'Based on these student messages, identify their interests and give 3 practical '
            f'pedagogical recommendations. '
            f'Return JSON: {{"interests": [...], "recommendations": [...]}}. '
            f'Language: {lang}. Messages: {messages_text[:1200]}'
        )
        try:
            import json
            import re
            raw = await groq_chat([{'role': 'user', 'content': prompt}])
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            data = json.loads(match.group(0)) if match else {}
            return {
                'interests': data.get('interests', []),
                'recommendations': data.get('recommendations', []),
            }
        except Exception as exc:
            print(f'[Dashboard] Erro ao gerar recomendações: {exc}')
            return {'interests': [], 'recommendations': []}

    # ── Simulações (admin) ───────────────────────────────────────────────────

    async def get_all_simulations(self) -> List[Dict[str, Any]]:
        """Lista todas as simulações registradas (templates para o admin)."""
        from services.simulation import DEFAULT_SIMULATIONS

        def _fetch() -> List[Dict[str, Any]]:
            try:
                result = (
                    self.db.table('simulations')
                    .select('*')
                    .order('created_at', desc=True)
                    .limit(200)
                    .execute()
                    .data
                )
                db_data = result or []
                
                # Mescla com os padrões fixos por slug
                scenarios_by_slug = {s['slug']: s for s in DEFAULT_SIMULATIONS}
                for s in db_data:
                    scenarios_by_slug[s['slug']] = s
                    
                return list(scenarios_by_slug.values())
            except Exception as e:
                print(f'[DashboardService] Erro ao buscar simulações: {e}')
                return DEFAULT_SIMULATIONS

        return await run_in_threadpool(_fetch)

    # ── Dificuldades (legado) ────────────────────────────────────────────────

    async def get_difficulties_stats(self) -> Dict[str, Any]:
        """Mantido para compatibilidade — retorna distribuição de níveis."""
        overview = await self.get_reports_overview()
        return overview.get('level_distribution', {})

    async def get_user_stats(self, username: str) -> Dict[str, Any]:
        """Retorna estatísticas detalhadas para o perfil do próprio aluno."""

        def _fetch_msgs() -> int:
            res_msgs = (
                self.db.table('messages')
                .select('id', count='exact')
                .eq('username', username)
                .eq('role', 'user')
                .execute()
            )
            return res_msgs.count or 0

        total_messages = await run_in_threadpool(_fetch_msgs)

        # Streak e Troféus via GamificationService (fonte oficial)
        from services.gamification_service import GamificationService
        gs = GamificationService()
        gamification_data = await gs.get_streak_data(username)
        xp_data = await gs.get_user_xp(username)

        return {
            'total_messages': total_messages,
            'total_xp': xp_data.get('xp', 0),
            'level': xp_data.get('level', 'A1'),
            'level_progress': xp_data.get('level_progress', 0),
            'xp_to_next': xp_data.get('xp_to_next', 500),
            'trophies_earned': gamification_data.get('trophies_earned', 0),
            'current_streak': gamification_data.get('current_streak', 0),
            'longest_streak': gamification_data.get('longest_streak', 0),
            'hours_saved': gamification_data.get('hours_saved', 0),
            'total_questions': gamification_data.get('total_questions', 0),
        }
    async def generate_simulation(self, topic: str, level: str, instructions: str = '') -> Dict[str, Any]:
        """Gera um cenário completo de simulação via IA."""
        from services.llm import groq_chat
        import json
        import re

        prompt = (
            f'Crie um cenário de simulação de conversa em inglês sobre "{topic}". '
            f'Nível: {level}. Instruções extras: {instructions}. '
            f'REGRAS CRÍTICAS:\n'
            f'1. A IA deve se chamar TATI ou Tatiana Duarte em todos os cenários.\n'
            f'2. O system_prompt DEVE incluir: "You are Tati, [personagem do cenário]".\n'
            f'3. O greeting DEVE começar com: "Hi, I am Tati." ou similar.\n\n'
            f'Retorne JSON: {{"name": "...", "description": "...", "greeting": "...", "system_prompt": "..."}}. '
            f'O greeting deve ser a primeira frase da IA. O system_prompt deve definir a persona da IA.'
        )
        try:
            raw = await groq_chat([{'role': 'user', 'content': prompt}])
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            data = json.loads(match.group(0)) if match else {}
            
            # Limpeza de dados para evitar erro de coluna inexistente
            allowed_fields = {'name', 'slug', 'description', 'icon', 'difficulty', 'system_prompt', 'is_active'}
            filtered_data = {k: v for k, v in data.items() if k in allowed_fields}
            
            # Garantir campos obrigatórios
            if 'system_prompt' not in filtered_data or not filtered_data['system_prompt']:
                filtered_data['system_prompt'] = f"You are a helpful assistant for the scenario {filtered_data.get('name', topic)}."
            
            if 'difficulty' not in filtered_data:
                filtered_data['difficulty'] = level.lower()
            
            if 'description' not in filtered_data:
                filtered_data['description'] = f"Prática de conversação sobre {topic}"

            # Salva no banco
            res = self.db.table('simulations').insert(filtered_data).execute()
            return res.data[0] if res.data else {}
        except Exception as e:
            print(f'[DashboardService] Erro ao gerar simulação: {e}')
            return {}

