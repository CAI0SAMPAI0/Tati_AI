from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
 
from core.config import settings
from core.security import decode_token

from services.database import get_client

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )
    
    username = payload["sub"]
    db = get_client()
    # Exclui explicitamente o campo 'avatar' da consulta
    rows = db.table("users").select("*").eq("username", username).limit(1).execute().data
    
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado",
        )
        
    return rows[0]

def check_access(user: dict = Depends(get_current_user)):
    """Verifica se o usuário tem acesso premium ou é isento."""
    if user.get("is_exempt") or user.get("is_premium_active"):
        return user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acesso premium necessário. Escolha um plano em seu perfil."
    )
 
 
class RoleChecker:
    def __init__(self, *allowed_roles: str) -> None:
        self.allowed_roles = set(allowed_roles)
 
    def __call__(self, user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: permissão insuficiente",
            )
        return user
    
require_staff = RoleChecker("professor", "professora", "programador", "Tatiana", "Tati", "Professora", "Programador", "admin", "Admin")
