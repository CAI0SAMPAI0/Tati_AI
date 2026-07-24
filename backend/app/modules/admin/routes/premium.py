"""
routers/admin/premium.py
Router para gestão administrativa do Hub de Conteúdos Premium.
"""

from typing import Any

from app.core.dependencies.auth import require_staff
from app.modules.activities.services.premium_service import PremiumService
from fastapi import APIRouter, Depends, File, UploadFile

router = APIRouter()


@router.get("/")
async def admin_list_premium(
    service: PremiumService = Depends(), user=Depends(require_staff)
) -> list[dict[str, Any]]:
    """Lista todos os conteúdos premium para o admin."""
    return await service.list_all_admin()


@router.post("/")
async def admin_create_premium(
    data: dict, service: PremiumService = Depends(), user=Depends(require_staff)
) -> dict[str, Any]:
    """Cria um novo conteúdo premium."""
    return await service.create_content(data)


@router.put("/{content_id}")
async def admin_update_premium(
    content_id: str,
    data: dict,
    service: PremiumService = Depends(),
    user=Depends(require_staff),
) -> dict[str, Any]:
    """Atualiza um conteúdo premium existente."""
    return await service.update_content(content_id, data)


@router.delete("/{content_id}")
async def admin_delete_premium(
    content_id: str, service: PremiumService = Depends(), user=Depends(require_staff)
) -> dict[str, bool]:
    """Exclui um conteúdo premium."""
    success = await service.delete_content(content_id)
    return {"success": success}


@router.delete("/purchases/{username}")
async def admin_reset_user_purchases(
    username: str,
    user=Depends(require_staff),
) -> dict[str, Any]:
    """Remove compras e pedidos do hub para um usuário (testes)."""
    from app.core.database import get_client

    db = get_client()
    db.table("premium_purchases").delete().eq("username", username).execute()
    orders = (
        db.table("orders").select("id").eq("username", username).execute().data or []
    )
    for order in orders:
        db.table("order_items").delete().eq("order_id", order["id"]).execute()
    db.table("orders").delete().eq("username", username).execute()
    return {"ok": True, "username": username}


@router.post("/upload")
async def admin_upload_premium_file(
    file: UploadFile = File(...),
    service: PremiumService = Depends(),
    user=Depends(require_staff),
) -> dict[str, str]:
    """Faz upload de um arquivo para o storage premium."""
    file_path = await service.upload_file(file)
    return {"file_path": file_path}
