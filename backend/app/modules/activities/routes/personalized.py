import logging

"""
Router para atividades personalizadas.

Sprint 20: a geração automática de "AI Exercises" a partir dos erros do
aluno foi removida. O endpoint ainda retorna o módulo Personalized Practice
e seus quizzes virtuais CEFR publicados.
"""

import asyncio
from datetime import datetime, timezone

from app.core.database import get_client
from app.core.dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

router = APIRouter()

PERSONALIZED_MODULE_ID = "00000000-0000-0000-0000-000000000001"


@router.get("/personalized")
async def get_personalized_module(current_user: dict = Depends(get_current_user)):
    """
    Retorna o módulo de práticas personalizadas do aluno.
    Garante frequência: 1 por dia, priorizando revisões semanais/mensais.
    """
    username = current_user["username"]
    db = get_client()

    try:
        now = datetime.now(timezone.utc)
        # Sprint 20: a geração automática de "AI Exercises" a partir dos erros
        # do aluno foi removida. Este endpoint agora apenas retorna o módulo
        # personalizado e seus quizzes virtuais CEFR (sem criar novos quizzes).

    except Exception as e:
        logging.info(f"[PersonalizedRouter] Erro na lógica de frequência: {e}")

    # 3. Retorna o módulo e seus quizzes (Otimizado com asyncio.gather conforme Sprint 2)
    try:
        # Agrupa as consultas independentes para execução paralela
        tasks = [
            run_in_threadpool(
                lambda: db.table("modules")
                .select("*")
                .eq("id", PERSONALIZED_MODULE_ID)
                .execute()
            ),
            run_in_threadpool(
                lambda: db.table("quizzes")
                .select("*")
                .eq("module_id", PERSONALIZED_MODULE_ID)
                .eq("username", username)
                .order("created_at", desc=True)
                .limit(15)
                .execute()
            ),
            run_in_threadpool(
                lambda: db.table("users")
                .select("level")
                .eq("username", username)
                .single()
                .execute()
            ),
            run_in_threadpool(
                lambda: db.table("activity_submissions")
                .select("metadata")
                .eq("username", username)
                .eq("activity_type", "quiz")
                .execute()
            ),
        ]

        res_mod, res_quiz, res_user, res_subs = await asyncio.gather(*tasks)

        module = res_mod.data[0] if res_mod.data else None
        if not module:
            module = {
                "id": PERSONALIZED_MODULE_ID,
                "title": "Personalized Practice",
                "description": "CEFR practice exercises filtered by your level.",
                "quizzes": [],
            }

        quizzes = res_quiz.data or []
        user_level = (
            res_user.data.get("level", "B1") if (res_user and res_user.data) else "B1"
        )

        # Usa normalize_level + janela CEFR para buscar conteúdo adjacente
        from app.core.enums import cefr_window, normalize_level

        cefr_levels = cefr_window(normalize_level(user_level), radius=1)

        # Busca exercícios CEFR publicados (depende do nível, então roda após o gather inicial)
        cefr_res = await run_in_threadpool(
            lambda: db.table("cefr_exercises")
            .select("*")
            .in_("level", cefr_levels)
            .eq("is_published", True)
            .execute()
        )
        cefr_rows = cefr_res.data or []

        # 4. Agrupa por tópico
        import re
        from collections import defaultdict

        grouped = defaultdict(list)
        for row in cefr_rows:
            topic = row.get("topic") or "General Practice"
            grouped[topic].append(row)

        # 5. Processa histórico de submissões
        completed_quiz_ids = set()
        for s in res_subs.data or []:
            meta = s.get("metadata")
            if meta and isinstance(meta, dict) and meta.get("quiz_id"):
                completed_quiz_ids.add(meta.get("quiz_id"))

        # 6. Cria quizzes virtuais
        virtual_quizzes = []
        for topic, items in grouped.items():
            level_str = items[0]["level"]
            topic_slug = re.sub(r"[^a-zA-Z0-9]", "_", topic.lower())
            quiz_id = f"cefr_{level_str}_{topic_slug}"

            is_done = quiz_id in completed_quiz_ids

            virtual_quizzes.append(
                {
                    "id": quiz_id,
                    "title": f"CEFR {level_str}: {topic}",
                    "description": f"Exercises about {topic}.",
                    "module_id": PERSONALIZED_MODULE_ID,
                    "username": username,
                    "status": "done" if is_done else "new",
                    "created_at": items[0].get("created_at") or now.isoformat(),
                }
            )

        # 7. Mescla quizzes reais (personalizados por erros) e virtuais (CEFR)
        all_quizzes = quizzes + virtual_quizzes
        # Ordena por data de criação descrescente
        all_quizzes.sort(key=lambda x: x.get("created_at") or "", reverse=True)

        module["quizzes"] = all_quizzes
        return module

    except Exception as e:
        logging.info(f"[PersonalizedRouter] Erro no fetch otimizado: {e}")
        raise HTTPException(
            status_code=500, detail="Erro ao carregar atividades personalizadas"
        )
