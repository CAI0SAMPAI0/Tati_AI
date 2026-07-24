import logging
from typing import Any

from app.core.dependencies.db import get_db
from app.shared.services.upstash import cache_get, cache_set
from fastapi import Depends
from fastapi.concurrency import run_in_threadpool


class TrophyService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find("Depends") != -1:
            from app.core.database import get_client

            self.db = get_client()
        else:
            self.db = db

    async def get_user_trophies(self, username: str) -> list[dict[str, Any]]:
        cache_key = f"trophies:{username}"
        cached = await cache_get(cache_key)
        if cached:
            return cached

        def _fetch():
            res = (
                self.db.table("user_trophies")
                .select("earned_at, trophies(name, description, icon, category)")
                .eq("username", username)
                .order("earned_at", desc=True)
                .execute()
            )
            trophies = []
            for row in res.data:
                t = row.get("trophies", {})
                trophies.append(
                    {
                        "title": t.get("name"),
                        "description": t.get("description"),
                        "icon": t.get("icon"),
                        "category": t.get("category"),
                        "earned_at": row.get("earned_at"),
                    }
                )
            return trophies

        trophies = await run_in_threadpool(_fetch)
        await cache_set(cache_key, trophies, ttl=300)
        return trophies

    async def list_achievements(self, username: str) -> list[dict[str, Any]]:
        """Retorna todos os troféus do sistema com o status de desbloqueio do usuário."""
        # Mapeamento completo para garantir inglês na interface
        TRANSLATIONS = {
            # Quizzes
            "Primeiro Quiz": "First Quiz",
            "Quizzer Iniciante": "Novice Quizzer",
            "Quizzer": "Active Quizzer",
            "Quizzer Avançado": "Advanced Quizzer",
            "Mestre dos Quizzes": "Quiz Master",
            "Mestre Supremo": "Supreme Master",
            "Perfeccionista": "Perfectionist",
            # Streaks
            "Primeiro Dia": "First Day",
            "Ofensiva de 3 Dias": "3-Day Streak",
            "Ofensiva de 7 Dias": "7-Day Streak",
            "Ofensiva de 14 Dias": "14-Day Streak",
            "Ofensiva de 30 Dias": "30-Day Streak",
            "Ofensiva de 60 Dias": "60-Day Streak",
            "Ofensiva de 100 Dias": "100-Day Streak",
            "Ofensiva de 365 Dias": "365-Day Streak",
            "Sempre Alerta": "Always Alert",
            # Milestones & Messages
            "Primeira Mensagem": "First Message",
            "100 Mensagens": "100 Messages",
            "500 Mensagens": "500 Messages",
            "Primeira Simulação": "First Simulation",
            "Ator Iniciante": "Novice Actor",
            "Estrela de Simulação": "Simulation Star",
            "Explorador": "Explorer",
            "Madrugador": "Early Bird",
            "Coruja": "Night Owl",
            "Final de Semana": "Weekend Warrior",
            # Social
            "Popular": "Popular",
            "Comunicador": "Communicator",
            "Falante": "Talkative",
            "Social": "Social",
            "Conversador": "Chatty Student",
            # Credits & Tycoon
            "Primeiro Crédito": "First Credit",
            "Economizador": "Saver",
            "Colecionador": "Collector",
            "Rico": "Wealthy",
            "Magnata": "Tycoon",
            # Time
            "Primeira Hora": "First Hour",
            "Mestre do Tempo": "Time Master",
            "Tempo Supremo": "Supreme Time",
            "Viajante do Tempo": "Time Traveler",
            # Vocabulary
            "Vocabulário 10": "Vocabulary 10",
            "Vocabulário 50": "Vocabulary 50",
            "Vocabulário 100": "Vocabulary 100",
            "Poliglota": "Polyglot",
            "Dicionário Vivo": "Living Dictionary",
            # Goals & Ranking
            "Primeira Meta": "First Goal",
            "Focado": "Focused",
            "Objetivo": "Goal Getter",
            "Top 10": "Top 10",
            "Top 3": "Top 3",
            "Campeão": "Champion",
            # Categorias
            "questions": "Questions",
            "streak": "Streak",
            "specialist": "Specialist",
            "milestones": "Milestones",
            "social": "Social",
            "credits": "Credits",
            "time": "Time",
            "vocabulary": "Vocabulary",
            "goals": "Goals",
            "ranking": "Ranking",
        }

        def _fetch():
            # 1. Busca todos os troféus cadastrados
            all_trophies = self.db.table("trophies").select("*").execute().data or []

            # 2. Busca troféus conquistados pelo usuário
            earned = (
                self.db.table("user_trophies")
                .select("trophy_id")
                .eq("username", username)
                .execute()
                .data
                or []
            )
            earned_ids = {t["trophy_id"] for t in earned}

            # 3. Formata para o frontend
            result = []
            is_programmer = (
                username.lower() in ["caio", "caio007", "caio.sampaio"]
                or "caio" in username.lower()
            )
            for t in all_trophies:
                name = t["name"]
                cat = t["category"]
                result.append(
                    {
                        "id": t["id"],
                        "title": TRANSLATIONS.get(name, name),
                        "description": t["description"],
                        "icon": t["icon"],
                        "category": TRANSLATIONS.get(cat, cat),
                        "unlocked": True if is_programmer else (t["id"] in earned_ids),
                    }
                )
            return result

        return await run_in_threadpool(_fetch)

    async def check_and_award_trophies(self, username: str) -> list[dict[str, Any]]:
        def _check():
            progress = (
                self.db.table("user_progress")
                .select("id")
                .eq("username", username)
                .execute()
                .data
                or []
            )
            total_done = len(progress)
            existing = (
                self.db.table("user_trophies")
                .select("trophy_id")
                .eq("username", username)
                .execute()
                .data
                or []
            )
            existing_ids = {t["trophy_id"] for t in existing}
            all_trophies = (
                self.db.table("trophies").select("id, name, icon").execute().data or []
            )
            trophy_map = {t["name"]: t for t in all_trophies}

            earned = []
            definitions = [
                {"name": "First Quiz", "req": 1},
                {"name": "Novice Quizzer", "req": 5},
                {"name": "Active Quizzer", "req": 10},
                {"name": "Quiz Master", "req": 50},
            ]
            for d in definitions:
                t_info = trophy_map.get(d["name"])
                if (
                    t_info
                    and t_info["id"] not in existing_ids
                    and total_done >= d["req"]
                ):
                    self.db.table("user_trophies").insert(
                        {"username": username, "trophy_id": t_info["id"]}
                    ).execute()
                    from app.modules.notifications.services.notifications import (
                        notify_trophy_earned,
                    )

                    notify_trophy_earned(username, t_info["name"], t_info["icon"])
                    earned.append({"title": t_info["name"], "icon": t_info["icon"]})
            return earned

        return await run_in_threadpool(_check)

    async def award_specialist_badge(self, username: str, topic_title: str):
        """Atribui uma badge de especialista baseada em um tópico específico concluído."""

        def _award():
            # 1. Cria ou recupera a definição do troféu de especialista
            badge_name = f"Specialist: {topic_title}"

            # Verifica se já existe a definição na tabela global de
            # troféus
            t_res = (
                self.db.table("trophies")
                .select("id, icon")
                .eq("name", badge_name)
                .execute()
                .data
            )
            if t_res:
                trophy_id = t_res[0]["id"]
                icon = t_res[0]["icon"]
            else:
                # Cria uma nova definição de badge dinâmica
                new_t = {
                    "name": badge_name,
                    "description": f"Mastered the topic: {topic_title}",
                    "icon": "🎓",
                    "category": "specialist",
                }
                insert_res = self.db.table("trophies").insert(new_t).execute().data
                if not insert_res:
                    return
                trophy_id = insert_res[0]["id"]
                icon = "🎓"

            # 2. Atribui ao usuário se não tiver
            existing = (
                self.db.table("user_trophies")
                .select("id")
                .eq("username", username)
                .eq("trophy_id", trophy_id)
                .execute()
                .data
            )
            if not existing:
                self.db.table("user_trophies").insert(
                    {"username": username, "trophy_id": trophy_id}
                ).execute()
                from app.modules.notifications.services.notifications import (
                    notify_trophy_earned,
                )

                notify_trophy_earned(username, badge_name, icon)
                logging.info(
                    f"[Trophy] Awarded Specialist Badge: {topic_title} to {username}"
                )

        await run_in_threadpool(_award)


def check_chat_trophies(username: str):
    """Função legada/auxiliar para o chat disparar checagem em background."""
    from app.core.database import get_client

    db = get_client()
    # Lógica simplificada para checagem rápida
    # Poderia chamar TrophyService().check_and_award_trophies mas aqui é
    # síncrono para run_in_threadpool
    progress = (
        db.table("messages")
        .select("id", count="exact")
        .eq("username", username)
        .eq("role", "user")
        .execute()
        .count
    )
    if progress and progress >= 10:
        # Tenta dar o troféu de "Conversador"
        t = (
            db.table("trophies")
            .select("id, name, icon")
            .eq("name", "Chatty Student")
            .execute()
            .data
        )
        if t:
            existing = (
                db.table("user_trophies")
                .select("id")
                .eq("username", username)
                .eq("trophy_id", t[0]["id"])
                .execute()
                .data
            )
            if not existing:
                db.table("user_trophies").insert(
                    {"username": username, "trophy_id": t[0]["id"]}
                ).execute()
                from app.modules.notifications.services.notifications import (
                    notify_trophy_earned,
                )

                notify_trophy_earned(username, t[0]["name"], t[0]["icon"])
                logging.info(f"[Trophy] Awarded Chatty Student to {username}")


def check_streak_trophies(username: str, longest_streak: int):
    """Verifica troféus baseados em dias consecutivos (streak)."""
    from app.core.database import get_client

    db = get_client()

    # Mapeamento de marcos de streak para nomes de troféus
    milestones = [
        (7, "Week Warrior"),
        (30, "Monthly Master"),
        (100, "Diamond Learner"),
        (365, "Year Champion"),
    ]

    for days, trophy_name in milestones:
        if longest_streak >= days:
            # Busca ID do troféu
            t = (
                db.table("trophies")
                .select("id, name, icon")
                .eq("name", trophy_name)
                .execute()
                .data
            )
            if t:
                # Verifica se já possui
                existing = (
                    db.table("user_trophies")
                    .select("id")
                    .eq("username", username)
                    .eq("trophy_id", t[0]["id"])
                    .execute()
                    .data
                )
                if not existing:
                    db.table("user_trophies").insert(
                        {"username": username, "trophy_id": t[0]["id"]}
                    ).execute()
                    from app.modules.notifications.services.notifications import (
                        notify_trophy_earned,
                    )

                    notify_trophy_earned(username, t[0]["name"], t[0]["icon"])
                    logging.info(f"[Trophy] Awarded {trophy_name} to {username}")
