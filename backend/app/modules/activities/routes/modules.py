"""
Router de Módulos e Lições.
IMPORTANT: Static routes must come BEFORE dynamic /{module_id} to avoid shadowing.
"""


from app.core.dependencies.auth import get_current_user, require_staff
from app.core.enums import normalize_level
from app.core.exceptions import ContentNotFoundError
from app.core.task_manager import delegate_to_worker_if_needed, run_task_in_background
from app.modules.activities.services.activity_service import ActivityService
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Request,
    UploadFile,
)

router = APIRouter()


@router.get("/")
async def list_modules(
    level: str | None = None,
    user: dict = Depends(get_current_user),
    service: ActivityService = Depends(),
):
    """Lista todos os módulos disponíveis com status de conclusão do usuário."""
    is_staff = user.get("is_staff", False)
    if is_staff and (not level or level == "All" or level == "ALL"):
        effective_level = None
    else:
        effective_level = level or user.get("level")
    return await service.list_modules(
        effective_level, user["username"], is_staff=is_staff
    )


@router.get("/weekly-goal")
async def get_weekly_goal(
    user: dict = Depends(get_current_user), service: ActivityService = Depends()
):
    """Retorna as tarefas pendentes para o Weekly Goal do aluno."""
    return await service.get_weekly_tasks(user["username"])


# ── Admin Static Routes (Order matters) ───────────────────────────────


@router.post("/admin/generate-quiz")
async def admin_generate_quiz(
    data: dict,
    background_tasks: BackgroundTasks,
    request: Request,
    user: dict = Depends(require_staff),
):
    """Gera um quiz via IA em background."""
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res

    from app.modules.activities.tasks import generate_quiz_task

    topic = data.get("content_titles") or data.get("title", "English Practice")
    level = normalize_level(data.get("level"), default="B1")
    num_questions = data.get("num_questions", 5)

    task_id = run_task_in_background(
        background_tasks,
        generate_quiz_task,
        topic=topic,
        level=level,
        num_questions=num_questions,
        username=user["username"],
    )
    return {"success": True, "task_id": task_id}


@router.post("/admin/generate-flashcards")
async def admin_generate_flashcards(
    data: dict,
    background_tasks: BackgroundTasks,
    request: Request,
    user: dict = Depends(require_staff),
):
    """Gera flashcards via IA em background."""
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res

    from app.modules.activities.tasks import generate_flashcards_task

    theme = data.get("theme")
    level = normalize_level(data.get("level"), default="B1")
    module_id = data.get("module_id")

    task_id = run_task_in_background(
        background_tasks,
        generate_flashcards_task,
        theme=theme,
        level=level,
        module_id=module_id,
        username=user["username"],
    )
    return {"success": True, "task_id": task_id}


@router.post("/admin/upload")
async def admin_upload_file(
    file: UploadFile = File(...), service: ActivityService = Depends()
):
    """Upload de arquivos para mÃ³dulos (PDF, PPT, DOC, etc)."""
    contents = await file.read()
    url = await service.upload_file(contents, file.filename, file.content_type)
    return {"url": url}


@router.get("/admin/all")
async def admin_list_modules(service: ActivityService = Depends()):
    """Lista todos os módulos (admin)."""
    return await service.list_all_modules_admin()


@router.post("/admin")
async def admin_create_module(data: dict, service: ActivityService = Depends()):
    """Cria um novo módulo."""
    return await service.save_module(data)


# ── Dynamic routes (/{module_id} must come LAST) ──────────────────────


@router.put("/admin/{module_id}")
async def admin_update_module(
    module_id: str, data: dict, service: ActivityService = Depends()
):
    """Atualiza um módulo existente."""
    return await service.save_module(data, module_id)


@router.delete("/admin/{module_id}")
async def admin_delete_module(module_id: str, service: ActivityService = Depends()):
    """Exclui um módulo."""
    return await service.delete_module(module_id)


@router.get("/{module_id}")
async def get_module(module_id: str, service: ActivityService = Depends()):
    """Detalhes de um módulo específico."""
    module = await service.get_module_details(module_id)
    if not module:
        raise ContentNotFoundError(detail="Módulo não encontrado")
    return module


@router.get("/{module_id}/lessons")
async def list_lessons(module_id: str, service: ActivityService = Depends()):
    """Lista lições de um módulo."""
    module = await service.get_module_details(module_id)
    if not module:
        raise ContentNotFoundError(detail="Módulo não encontrado")
    return module.get("lessons", [])
