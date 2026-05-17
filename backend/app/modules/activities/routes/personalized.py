"""
Router para atividades personalizadas geradas por IA.
"""

from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies.auth import get_current_user
from app.core.database import get_client
from app.modules.activities.services.error_log_service import error_log_service
from app.modules.activities.services.exercise_generator import exercise_generator_service
from fastapi.concurrency import run_in_threadpool
import asyncio
import uuid
import calendar
from datetime import datetime, timezone, timedelta

router = APIRouter()

PERSONALIZED_MODULE_ID = '00000000-0000-0000-0000-000000000001'

@router.get('/personalized')
async def get_personalized_module(current_user: dict = Depends(get_current_user)):
    """
    Retorna o módulo de práticas personalizadas do aluno.
    Garante frequência: 1 por dia, priorizando revisões semanais/mensais.
    """
    username = current_user['username']
    db = get_client()

    try:
        now = datetime.now(timezone.utc)
        # Usamos uma janela de 20 horas para considerar "hoje", evitando problemas de timezone
        today_window = now - timedelta(hours=20)
        
        # 1. Verificações de existência para evitar duplicidade
        # Busca quizzes recentes (últimas 20h)
        res_recent = db.table('quizzes').select('id', 'title').eq('module_id', PERSONALIZED_MODULE_ID).eq('username', username).gte('created_at', today_window.isoformat()).execute()
        recent_quizzes = res_recent.data or []
        
        has_daily = any('Daily Practice' in q['title'] for q in recent_quizzes)
        has_weekly = any('Weekly Review' in q['title'] for q in recent_quizzes)
        has_monthly = any('Monthly Review' in q['title'] for q in recent_quizzes)
        
        # Se já tem qualquer um hoje, não precisamos de mais nada
        has_anything_today = len(recent_quizzes) > 0

        # Geração em curso (lock ativo)
        res_active = db.table('user_exercise_attempts').select('id').eq('username', username).eq('status', 'generating').eq('module_id', PERSONALIZED_MODULE_ID).execute()
        has_active_generation = (len(res_active.data) if res_active.data else 0) > 0

        # 2. Lógica de priorização
        target_type = None
        ex_title = None

        is_saturday = now.weekday() == 5
        last_day = calendar.monthrange(now.year, now.month)[1]
        is_last_day = now.day == last_day

        if not has_anything_today and not has_active_generation:
            if is_last_day and not has_monthly:
                target_type = 'monthly'
                ex_title = f"Monthly Review - {now.strftime('%B %Y')}"
            elif is_saturday and not has_weekly:
                target_type = 'weekly'
                ex_title = f"Weekly Review - {now.strftime('%m/%d')}"
            elif not has_daily:
                target_type = 'daily'
                ex_title = f"Daily Practice - {now.strftime('%m/%d')}"

        if target_type:
            # Trava a geração com um lock no banco
            lock_id = str(uuid.uuid4())
            try:
                db.table('user_exercise_attempts').insert({
                    'id': lock_id,
                    'username': username,
                    'status': 'generating',
                    'module_id': PERSONALIZED_MODULE_ID,
                    'activity_type': f'pattern_based_{target_type}'
                }).execute()

                print(f"[Personalized] Iniciando geração de {target_type} para {username}...")
                
                # Busca os erros reais do aluno
                targets = await error_log_service._get_training_targets(username)
                if targets:
                    asyncio.create_task(
                        exercise_generator_service.generate_exercises_from_targets(
                            username, 
                            targets, 
                            title=ex_title,
                            attempt_id=lock_id
                        )
                    )
                else:
                    # Se não há erros para praticar, limpa o lock
                    db.table('user_exercise_attempts').delete().eq('id', lock_id).execute()
            except Exception as e:
                print(f"[PersonalizedRouter] Erro ao inserir lock (provável concorrência): {e}")

    except Exception as e:
        print(f"[PersonalizedRouter] Erro na lógica de frequência: {e}")

    # 3. Retorna o módulo e seus quizzes
    def _fetch():
        try:
            res_mod = db.table('modules').select('*').eq('id', PERSONALIZED_MODULE_ID).execute()
            module = res_mod.data[0] if res_mod.data else None
            
            if not module:
                return {
                    'id': PERSONALIZED_MODULE_ID,
                    'title': 'Personalized Practice',
                    'description': 'AI-generated exercises based on your history.',
                    'quizzes': []
                }
            
            # Quizzes do usuário (limita aos últimos 15 para não poluir)
            quizzes = db.table('quizzes').select('*').eq('module_id', PERSONALIZED_MODULE_ID).eq('username', username).order('created_at', desc=True).limit(15).execute().data or []
            module['quizzes'] = quizzes
            return module
        except Exception as e:
            print(f"[PersonalizedRouter] Erro no fetch: {e}")
            return None

    result = await run_in_threadpool(_fetch)
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao carregar atividades personalizadas")
    
    return result
