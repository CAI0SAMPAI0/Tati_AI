from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
 
from core.config import settings
from core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )
    return {"username": payload["sub"], "role": payload.get("role", "student")}
 
 
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
    
require_staff = RoleChecker("professor", "professora", "programador", "Tatiana", "Tati")