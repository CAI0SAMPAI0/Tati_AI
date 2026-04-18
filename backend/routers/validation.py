"""
Router para validação de documentos (CPF, CNPJ, internacionais) e informações de localização.
"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional

from services.document_validator import validate_document_auto, identify_document, validate_cpf, validate_cnpj
from services.geolocation import get_user_location_info, is_business_day_local, calc_due_date_local
from datetime import date

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class DocumentValidationRequest(BaseModel):
    document: str
    country_code: Optional[str] = None  # 'BR', 'US', 'GB', 'CA', etc.


class DocumentValidationResponse(BaseModel):
    valid: bool
    type: Optional[str]  # 'cpf', 'cnpj', 'ssn', etc.
    country: Optional[str]
    formatted: str
    message: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/validate-document", response_model=DocumentValidationResponse)
async def validate_document(body: DocumentValidationRequest):
    """
    Valida um documento de identificação.
    Suporta CPF, CNPJ (Brasil), SSN (EUA), NINO (UK), SIN (Canadá).
    Se country_code for fornecido, valida especificamente para aquele país.
    Caso contrário, tenta detecção automática.
    """
    if body.country_code:
        # Validação específica por país
        from services.document_validator import validate_international_document
        result = validate_international_document(body.document, body.country_code)
        return DocumentValidationResponse(**result)
    
    # Detecção automática
    result = validate_document_auto(body.document)
    return DocumentValidationResponse(**result)


@router.get("/validate-document/{document}")
async def validate_document_get(document: str):
    """
    Valida documento via GET (útil para validação em tempo real no frontend).
    """
    result = validate_document_auto(document)
    return result


@router.get("/location-info")
async def get_location_info(request: Request):
    """
    Retorna informações de localização do usuário baseado no IP.
    Inclui: país, timezone, se hoje é dia útil, próximo dia útil, etc.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    # Para localhost/127.0.0.1, usa Brasil como padrão
    if client_ip in ("127.0.0.1", "localhost", "::1"):
        today = date.today()
        return {
            'country': 'BR',
            'timezone': 'America/Sao_Paulo',
            'today': today.isoformat(),
            'is_business_day': is_business_day_local(today, 'BR'),
            'next_business_day': calc_due_date_local(today, 5, 'BR').isoformat(),
            'note': 'Localhost - usando Brasil como padrão',
        }
    
    return await get_user_location_info(client_ip)


@router.get("/is-business-day")
async def check_business_day(
    year: int = date.today().year,
    month: int = date.today().month,
    day: int = date.today().day,
    country: str = 'BR',
):
    """
    Verifica se uma data específica é dia útil para um determinado país.
    """
    try:
        target_date = date(year, month, day)
    except ValueError:
        return {"error": "Data inválida"}
    
    is_bday = is_business_day_local(target_date, country)
    next_bday = target_date if is_bday else None
    
    if not is_bday:
        # Encontra o próximo dia útil
        from services.geolocation import next_business_day_local
        next_bday = next_business_day_local(target_date, country)
    
    return {
        'date': target_date.isoformat(),
        'country': country,
        'is_business_day': is_bday,
        'next_business_day': next_bday.isoformat() if next_bday else None,
    }
