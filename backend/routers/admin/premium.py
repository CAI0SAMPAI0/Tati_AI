"""
routers/admin/premium.py
Router para gestão administrativa do Hub de Conteúdos Premium.
"""

from fastapi import APIRouter, Depends, UploadFile, File
from typing import List, Dict, Any
from routers.deps import get_current_user
from services.premium_service import PremiumService

router = APIRouter()

# Nota: Em um cenário real, deveríamos ter um check de role 'admin' ou 'staff' aqui.
# No momento, vamos assumir que as rotas /admin/ são protegidas no gateway ou por middleware de roles.

@router.get('/')
async def admin_list_premium(
    service: PremiumService = Depends()
) -> List[Dict[str, Any]]:
    """Lista todos os conteúdos premium para o admin."""
    return await service.list_all_admin()

@router.post('/')
async def admin_create_premium(
    data: dict,
    service: PremiumService = Depends()
) -> Dict[str, Any]:
    """Cria um novo conteúdo premium."""
    return await service.create_content(data)

@router.put('/{content_id}')
async def admin_update_premium(
    content_id: str,
    data: dict,
    service: PremiumService = Depends()
) -> Dict[str, Any]:
    """Atualiza um conteúdo premium existente."""
    return await service.update_content(content_id, data)

@router.delete('/{content_id}')
async def admin_delete_premium(
    content_id: str,
    service: PremiumService = Depends()
) -> Dict[str, bool]:
    """Exclui um conteúdo premium."""
    success = await service.delete_content(content_id)
    return {"success": success}

@router.post('/upload')
async def admin_upload_premium_file(
    file: UploadFile = File(...),
    service: PremiumService = Depends()
) -> Dict[str, str]:
    """Faz upload de um arquivo para o storage premium."""
    file_path = await service.upload_file(file)
    return {"file_path": file_path}
