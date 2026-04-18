"""
Serviço de validação e identificação de documentos (CPF, CNPJ e formatos internacionais).
Inclui validação algorítmica e detecção de tipo de documento.
"""
import re
from typing import Optional


# ── Helpers de validação ──────────────────────────────────────────────────────

def _multiply_and_sum(digits: list[int], weights: list[int]) -> int:
    """Multiplica dígitos pelos pesos e soma os resultados."""
    return sum(d * w for d, w in zip(digits, weights))


def _calculate_digit(digits: list[int], weights: list[int]) -> int:
    """Calcula um dígito verificador (CPF/CNPJ)."""
    total = _multiply_and_sum(digits, weights)
    remainder = total % 11
    return 0 if remainder < 2 else 11 - remainder


# ── Validação de CPF ──────────────────────────────────────────────────────────

def validate_cpf(cpf: str) -> bool:
    """
    Valida CPF brasileiro (xxx.xxx.xxx-xx).
    Retorna True se for válido algoritmica e formalmente.
    """
    # Limpa formatação
    cpf = re.sub(r'[^\d]', '', cpf)
    
    # Verificações básicas
    if len(cpf) != 11:
        return False
    
    # Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)
    if cpf == cpf[0] * 11:
        return False
    
    # Verifica primeiro dígito verificador
    digits = [int(d) for d in cpf[:9]]
    weights1 = list(range(10, 1, -1))  # [10, 9, 8, 7, 6, 5, 4, 3, 2]
    digit1 = _calculate_digit(digits, weights1)
    
    if int(cpf[9]) != digit1:
        return False
    
    # Verifica segundo dígito verificador
    digits.append(digit1)
    weights2 = list(range(11, 1, -1))  # [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    digit2 = _calculate_digit(digits, weights2)
    
    return int(cpf[10]) == digit2


# ── Validação de CNPJ ─────────────────────────────────────────────────────────

def validate_cnpj(cnpj: str) -> bool:
    """
    Valida CNPJ brasileiro (xx.xxx.xxx/xxxx-xx).
    Retorna True se for válido algoritmica e formalmente.
    """
    # Limpa formatação
    cnpj = re.sub(r'[^\d]', '', cnpj)
    
    # Verificações básicas
    if len(cnpj) != 14:
        return False
    
    # Rejeita CNPJs com todos os dígitos iguais
    if cnpj == cnpj[0] * 14:
        return False
    
    # Separa dígitos base e verifica primeiro dígito verificador
    digits = [int(d) for d in cnpj[:12]]
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    digit1 = _calculate_digit(digits, weights1)
    
    if int(cnpj[12]) != digit1:
        return False
    
    # Verifica segundo dígito verificador
    digits.append(digit1)
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    digit2 = _calculate_digit(digits, weights2)
    
    return int(cnpj[13]) == digit2


# ── Identificação do tipo de documento ────────────────────────────────────────

def identify_document(doc: str) -> Optional[str]:
    """
    Identifica o tipo de documento baseado no formato e tamanho.
    Retorna: 'cpf', 'cnpj', ou None se não identificar.
    """
    doc = re.sub(r'[^\d]', '', doc)
    
    if len(doc) == 11:
        return 'cpf' if validate_cpf(doc) else None
    elif len(doc) == 14:
        return 'cnpj' if validate_cnpj(doc) else None
    
    return None


# ── Validação de documentos internacionais ────────────────────────────────────

def validate_us_ssn(ssn: str) -> bool:
    """
    Valida Social Security Number (EUA) no formato XXX-XX-XXXX.
    Validação básica de formato (não verifica se existe no SSA).
    """
    ssn = re.sub(r'[^\d]', '', ssn)
    
    if len(ssn) != 9:
        return False
    
    # Verificações básicas da SSA
    area = int(ssn[:3])
    group = int(ssn[3:5])
    serial = int(ssn[5:])
    
    # Área não pode ser 000, 666, ou 900-999
    if area == 0 or area == 666 or area >= 900:
        return False
    
    # Grupo e serial não podem ser 00 ou 0000
    if group == 0 or serial == 0:
        return False
    
    return True


def validate_uk_nino(nino: str) -> bool:
    """
    Valida UK National Insurance Number (formato básico).
    Formato: AA 12 34 56 A
    """
    nino = re.sub(r'[\s]', '', nino).upper()
    
    # Padrão regex para NINO
    pattern = r'^[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$'
    
    # Prefixos inválidos
    invalid_prefixes = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ']
    prefix = nino[:2]
    
    if not re.match(pattern, nino):
        return False
    
    if prefix in invalid_prefixes:
        return False
    
    return True


def validate_canadian_sin(sin: str) -> bool:
    """
    Valida Canadian Social Insurance Number (9 dígitos).
    Usa algoritmo Luhn modificado específico do Canadá.
    """
    sin = re.sub(r'[^\d]', '', sin)
    
    if len(sin) != 9:
        return False
    
    # Algoritmo específico do SIN canadense
    # Posições: 1 2 3 4 5 6 7 8 9
    # Multiplicar posições pares (2,4,6,8) por 2
    total = 0
    for i in range(9):
        digit = int(sin[i])
        if i % 2 == 1:  # Índices 1,3,5,7 (posições 2,4,6,8)
            digit *= 2
            if digit > 9:
                digit = digit - 9  # Soma dos dígitos (ex: 14 → 1+4=5)
        total += digit
    
    return total % 10 == 0


def validate_international_document(doc: str, country_code: str = 'BR') -> dict:
    """
    Valida documento de identificação baseado no código do país.
    
    Retorna dict com:
    - valid: bool
    - type: str (cpf, cnpj, ssn, nino, sin, etc.)
    - formatted: str (formatado)
    - message: str (mensagem de erro ou sucesso)
    """
    doc = doc.strip()
    
    validators = {
        'BR': [
            ('cpf', validate_cpf, format_cpf),
            ('cnpj', validate_cnpj, format_cnpj),
        ],
        'US': [
            ('ssn', validate_us_ssn, format_us_ssn),
        ],
        'GB': [
            ('nino', validate_uk_nino, lambda x: x),
        ],
        'CA': [
            ('sin', validate_canadian_sin, format_ca_sin),
        ],
    }
    
    country_validators = validators.get(country_code.upper(), validators['BR'])
    
    for doc_type, validate_func, format_func in country_validators:
        if validate_func(doc):
            return {
                'valid': True,
                'type': doc_type,
                'formatted': format_func(doc),
                'message': f'{doc_type.upper()} válido',
            }
    
    return {
        'valid': False,
        'type': None,
        'formatted': doc,
        'message': f'Documento inválido para o país {country_code.upper()}',
    }


# ── Funções de formatação ─────────────────────────────────────────────────────

def format_cpf(cpf: str) -> str:
    """Formata CPF: xxx.xxx.xxx-xx"""
    cpf = re.sub(r'[^\d]', '', cpf)
    if len(cpf) != 11:
        return cpf
    return f'{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}'


def format_cnpj(cnpj: str) -> str:
    """Formata CNPJ: xx.xxx.xxx/xxxx-xx"""
    cnpj = re.sub(r'[^\d]', '', cnpj)
    if len(cnpj) != 14:
        return cnpj
    return f'{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}'


def format_us_ssn(ssn: str) -> str:
    """Formata US SSN: XXX-XX-XXXX"""
    ssn = re.sub(r'[^\d]', '', ssn)
    if len(ssn) != 9:
        return ssn
    return f'{ssn[:3]}-{ssn[3:5]}-{ssn[5:]}'


def format_ca_sin(sin: str) -> str:
    """Formata Canadian SIN: XXX XXX XXX"""
    sin = re.sub(r'[^\d]', '', sin)
    if len(sin) != 9:
        return sin
    return f'{sin[:3]} {sin[3:6]} {sin[6:]}'


# ── Validação unificada (auto-detect) ─────────────────────────────────────────

def validate_document_auto(doc: str) -> dict:
    """
    Tenta validar o documento automaticamente, detectando o tipo.
    Ordem de verificação: CPF → CNPJ → SSN → NINO → SIN
    """
    doc_clean = re.sub(r'[^\d]', '', doc)
    
    # Tenta CPF brasileiro
    if len(doc_clean) == 11 and validate_cpf(doc_clean):
        return {
            'valid': True,
            'type': 'cpf',
            'country': 'BR',
            'formatted': format_cpf(doc_clean),
            'message': 'CPF válido',
        }
    
    # Tenta CNPJ brasileiro
    if len(doc_clean) == 14 and validate_cnpj(doc_clean):
        return {
            'valid': True,
            'type': 'cnpj',
            'country': 'BR',
            'formatted': format_cnpj(doc_clean),
            'message': 'CNPJ válido',
        }
    
    # Tenta SSN americano
    if len(doc_clean) == 9 and validate_us_ssn(doc_clean):
        return {
            'valid': True,
            'type': 'ssn',
            'country': 'US',
            'formatted': format_us_ssn(doc_clean),
            'message': 'SSN válido',
        }
    
    # Tenta Canadian SIN
    if len(doc_clean) == 9 and validate_canadian_sin(doc_clean):
        return {
            'valid': True,
            'type': 'sin',
            'country': 'CA',
            'formatted': format_ca_sin(doc_clean),
            'message': 'SIN válido',
        }
    
    # Tenta UK NINO (pode ter letras)
    if validate_uk_nino(doc.strip()):
        return {
            'valid': True,
            'type': 'nino',
            'country': 'GB',
            'formatted': doc.strip().upper(),
            'message': 'NINO válido',
        }
    
    return {
        'valid': False,
        'type': None,
        'country': None,
        'formatted': doc,
        'message': 'Documento inválido ou não reconhecido',
    }
