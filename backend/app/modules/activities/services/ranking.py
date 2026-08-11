import logging

"""
Serviço de Ranking de Alunos.
"""

from datetime import datetime, timezone

from app.core.database import get_client
from app.core.enums import CEFR_ORDER, normalize_level

# REGRAS DE PONTUAÇÃO EXATAS
ACTION_POINTS = {
    "quiz": 7,
    "flashcard": 3,
    "message": 8,
    "simulation": 10,
}


def _empty_stats(username: str, user_map: dict, level_map: dict) -> dict:
    return {
        "username": username,
        "name": user_map.get(username) or username,
        "level": normalize_level((level_map or {}).get(username)),
        "avatar_url": None,
        "score": 0,
        "messages": 0,
        "quizzes": 0,
        "flashcards": 0,
        "simulations": 0,
    }


def _activity_scores(db) -> dict[str, int]:
    """Soma, por usuário, os pontos das atividades concluídas.

    Fonte da pontuação da competição: submissões marcadas como 'done'
    (via modal) somadas aos pontos legados preservados de quando o
    ranking era baseado em engajamento (armazenados em
    `users.xp_data.legacy_competition_points`).
    """
    from app.modules.activities.services.gamification_service import (
        GamificationService,
    )

    rows = (
        db.table("activity_submissions")
        .select("username, score, metadata")
        .execute()
        .data
        or []
    )
    scores: dict[str, int] = {}
    for r in rows:
        meta = r.get("metadata") or {}
        if int(r.get("score", 0) or 0) <= 0:
            continue
        if str(meta.get("status") or "").lower() == "pending":
            continue
        pts = meta.get("points_awarded")
        if pts is None:
            pts = GamificationService.ACTIVITY_POINTS.get(
                str(meta.get("category") or "").lower().strip(), 0
            )
        pts = int(pts or 0)
        if pts:
            scores[r["username"]] = scores.get(r["username"], 0) + pts

    # Pontos legados (ranking antigo por engajamento) preservados por usuário
    try:
        users_rows = (
            db.table("users").select("username, xp_data").execute().data or []
        )
    except Exception:
        users_rows = []
    for u in users_rows:
        xp_data = u.get("xp_data") or {}
        legacy = int(
            (xp_data or {}).get("legacy_competition_points", 0) or 0
        )
        if legacy:
            scores[u["username"]] = scores.get(u["username"], 0) + legacy

    return scores


def get_ranking_data(username: str) -> dict:
    db = get_client()
    now = datetime.now(timezone.utc)
    start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        from app.core.config import settings

        staff_usernames = set(settings.staff_roles)
        access = (
            db.table("student_access").select("username, role").execute().data or []
        )
        for a in access:
            if a.get("role") in ("professor", "professora", "programador", "admin"):
                staff_usernames.add(a["username"])

        # Busca dados de sessões e mensagens
        actions = (
            db.table("study_sessions")
            .select("username, activity_type")
            .gte("created_at", start_month.isoformat())
            .execute()
            .data
            or []
        )
        messages = (
            db.table("messages")
            .select("username")
            .eq("role", "user")
            .gte("created_at", start_month.isoformat())
            .execute()
            .data
            or []
        )

        stats = {}

        for a in actions:
            u = a.get("username")
            if not u or u in staff_usernames:
                continue
            if u not in stats:
                stats[u] = _empty_stats(u, {}, {})

            atype = a.get("activity_type")
            if atype in ACTION_POINTS:
                stats[u]["score"] += ACTION_POINTS[atype]
                if atype in ["quiz", "flashcard", "message", "simulation"]:
                    stats[u][f"{atype}s"] += 1

        for m in messages:
            u = m.get("username")
            if not u or u in staff_usernames:
                continue
            if u not in stats:
                stats[u] = _empty_stats(u, {})
            stats[u]["score"] += ACTION_POINTS["message"]
            stats[u]["messages"] += 1

        # Tenta buscar nomes e níveis reais para todos no stats
        if stats:
            usernames = list(stats.keys())
            users = (
                db.table("users")
                .select("username, name, level, avatar_url, profile")
                .in_("username", usernames)
                .execute()
                .data
                or []
            )
            for u_info in users:
                uname = u_info.get("username")
                if uname in stats:
                    stats[uname]["name"] = u_info.get("name") or uname
                    stats[uname]["level"] = normalize_level(u_info.get("level"))
                    stats[uname]["avatar_url"] = u_info.get("avatar_url") or (
                        u_info.get("profile") or {}
                    ).get("avatar_url")
        ranking = sorted(stats.values(), key=lambda x: x["score"], reverse=True)

        return {
            "top15": ranking[:15],
            "my_position": next(
                (i + 1 for i, x in enumerate(ranking) if x["username"] == username), 0
            ),
            "winners": [],
        }
    except Exception as e:
        logging.info(f"[Ranking] Erro: {e}")
        return {"top15": [], "my_position": 0, "winners": []}


def get_ranking_by_level(username: str) -> dict:
    """Retorna o ranking por nível, baseado nos pontos de atividades concluídas."""
    db = get_client()

    try:
        from app.core.config import settings

        # 1. Usuários e níveis, excluindo staff por role real
        try:
            all_users = (
                db.table("users")
                .select("username, name, level, avatar_url, profile")
                .execute()
                .data
                or []
            )
        except Exception:
            all_users = (
                db.table("users")
                .select("username, name, level, profile")
                .execute()
                .data
                or []
            )
        staff_usernames = set(settings.staff_roles)
        access = (
            db.table("student_access").select("username, role").execute().data or []
        )
        for a in access:
            if a.get("role") in ("professor", "professora", "programador", "admin"):
                staff_usernames.add(a.get("username"))
        all_users = [
            u
            for u in all_users
            if (u.get("username") and u.get("username") not in staff_usernames)
        ]

        user_level_map = {
            u["username"]: normalize_level(u.get("level")) for u in all_users
        }

        # 2. Pontos de atividades concluídas por usuário
        scores = _activity_scores(db)

        # 3. Monta estatísticas por nível
        result: dict[str, list] = {code: [] for code in CEFR_ORDER}
        for u in all_users:
            uname = u["username"]
            lvl = user_level_map[uname]
            result.setdefault(lvl, []).append(
                {
                    "username": uname,
                    "name": u.get("name") or uname,
                    "level": lvl,
                    "avatar_url": u.get("avatar_url")
                    or (u.get("profile") or {}).get("avatar_url"),
                    "score": scores.get(uname, 0),
                }
            )

        # Ordena cada categoria e limita ao TOP 10
        for cat in result:
            result[cat] = sorted(result[cat], key=lambda x: x["score"], reverse=True)[
                :10
            ]

        return result
    except Exception as e:
        import traceback

        traceback.print_exc()
        logging.info(f"[Ranking] Erro by level: {e}")
        return {code: [] for code in CEFR_ORDER}
