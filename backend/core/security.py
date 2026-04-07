import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone
 
import bcrypt
from jose import jwt
 
from core.config import settings

# jwt
def create_access_token(data: dict, expires_minutes: int | None = None) -> str:
    expires = expires_minutes or settings.access_token_expire_minutes
    payload = {**data, 'exp': datetime.now(timezone.utc) + timedelta(minutes=expires)}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> dict | None:
    from jose import JWTError
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    
# Password hashing and verification
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
def verify_password(password: str, stored: str) -> bool:
    if stored == "google_authenticated":
        return False
    if stored.startswith("$2"):
        return bcrypt.checkpw(password.encode(), stored.encode())
    # sha256 fallback (legacy)
    return hashlib.sha256(password.encode()).hexdigest() == stored

# Temporary password

_SAFE_ALPHABET = "".join(
    c for c in string.ascii_letters + string.digits if c not in "0OlI1"
)

def generate_temp_password(length: int = 12) -> str:
    return "".join(secrets.choice(_SAFE_ALPHABET) for _ in range(length))