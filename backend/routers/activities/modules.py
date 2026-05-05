"""
Router de Módulos e Lições.
IMPORTANT: Static routes must come BEFORE dynamic /{module_id} to avoid shadowing.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Optional

from routers.deps import get_current_user
from services.activity_service import ActivityService

router = APIRouter()


# ── Static routes first (before /{module_id}) ─────────────────────────────────

@router.get('/')
async def list_modules(
    level: Optional[str] = None, 
    user: dict = Depends(get_current_user),
    service: ActivityService = Depends()
):
    """Lista todos os módulos disponíveis com status de conclusão do usuário."""
    effective_level = level or user.get('level')
    return await service.list_modules(effective_level, user['username'])


@router.get('/admin/all')
async def admin_list_modules(service: ActivityService = Depends()):
    """Lista todos os módulos (admin)."""
    return await service.list_all_modules_admin()


@router.post('/admin/upload')
async def admin_upload_file(
    file: UploadFile = File(...),
    service: ActivityService = Depends()
):
    """Upload de arquivos para mÃ³dulos (PDF, PPT, DOC, etc)."""
    contents = await file.read()
    url = await service.upload_file(contents, file.filename, file.content_type)
    return {'url': url}


@router.post('/admin')
async def admin_create_module(data: dict, service: ActivityService = Depends()):
    """Cria um novo módulo."""
    return await service.save_module(data)


@router.post('/admin/generate-quiz')
async def admin_generate_quiz(data: dict, service: ActivityService = Depends()):
    """Gera um quiz via IA."""
    from services.quiz_service import QuizService

    qs = QuizService()
    return await qs.generate_dynamic_quiz(
        data.get('content_titles') or data.get('title', 'English Practice'),
        data.get('level', 'Intermediate'),
        num_questions=data.get('num_questions', 5)
    )


@router.post('/admin/generate-flashcards')
async def admin_generate_flashcards(data: dict, service: ActivityService = Depends()):
    """Gera flashcards via IA."""
    return await service.generate_flashcards(
        data.get('theme'),
        data.get('level', 'Intermediate'),
        module_id=data.get('module_id')
    )


@router.post('/admin/generate-mindmap')
async def admin_generate_mindmap(data: dict):
    """Gera um mapa mental via IA usando Markdown."""
    from services.llm import groq_chat
    prompt = (
        f"Create a hierarchical study mind map about '{data.get('theme')}' for an English learning module. "
        f"Level: {data.get('level', 'Intermediate')}. "
        "Use Markdown bulleted lists to represent the tree structure. "
        "Do NOT use markdown code blocks like ```markdown. Just return the text directly."
    )
    try:
        res = await groq_chat([{'role': 'user', 'content': prompt}])
        return {'markdown': res.strip()}
    except Exception as e:
        return {'markdown': f"Error generating mind map: {e}"}


# ── Dynamic routes (/{module_id} must come LAST) ──────────────────────────────

@router.put('/admin/{module_id}')
async def admin_update_module(
    module_id: str, data: dict, service: ActivityService = Depends()
):
    """Atualiza um módulo existente."""
    return await service.save_module(data, module_id)


@router.delete('/admin/{module_id}')
async def admin_delete_module(module_id: str, service: ActivityService = Depends()):
    """Exclui um módulo."""
    return await service.delete_module(module_id)


@router.get('/{module_id}')
async def get_module(module_id: str, service: ActivityService = Depends()):
    """Detalhes de um módulo específico."""
    module = await service.get_module_details(module_id)
    if not module:
        raise HTTPException(status_code=404, detail='Módulo não encontrado')
    return module


@router.get('/{module_id}/lessons')
async def list_lessons(module_id: str, service: ActivityService = Depends()):
    """Lista lições de um módulo."""
    module = await service.get_module_details(module_id)
    if not module:
        raise HTTPException(status_code=404, detail='Módulo não encontrado')
    return module.get('lessons', [])
