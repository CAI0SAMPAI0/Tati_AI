"""
core/enums.py
Enums centralizados do projeto Teacher Tati AI.
"""

from enum import Enum


class CEFRLevel(str, Enum):
    """
    Padrão CEFR oficial de níveis de proficiência em inglês.
    Todos os módulos devem usar este enum para garantir consistência.
    """

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


# Mapeamento canônico de aliases legados para o padrão CEFR
LEVEL_ALIAS_MAP: dict[str, str] = {
    # CEFR direto (case-insensitive)
    "a1": "A1",
    "a2": "A2",
    "b1": "B1",
    "b2": "B2",
    "c1": "C1",
    "c2": "C2",
    # Nomes legados por extenso
    "beginner": "A1",
    "iniciante": "A1",
    "pre-intermediate": "A2",
    "pre intermediate": "A2",
    "pre_intermediate": "A2",
    "pre-intermediario": "A2",
    "pre intermediario": "A2",
    "intermediate": "B1",
    "intermediario": "B1",
    # *** Regra de Migração PRD: Business English → C1 ***
    "business english": "C1",
    "business": "C1",
    "ingles para negocios": "C1",
    # Outros legados
    "advanced": "C1",
    "avancado": "C1",
    "upper intermediate": "B2",
    "upper-intermediate": "B2",
    "mastery": "C2",
    "proficiency": "C2",
}

# Labels descritivos para exibição ao usuário
CEFR_LABELS: dict[str, str] = {
    "A1": "A1 – Beginner",
    "A2": "A2 – Pre-Intermediate",
    "B1": "B1 – Intermediate",
    "B2": "B2 – Upper-Intermediate",
    "C1": "C1 – Advanced",
    "C2": "C2 – Mastery / Proficiency",
}

# Ordem numérica (útil para comparação de progressão)
CEFR_ORDER: list[str] = ["A1", "A2", "B1", "B2", "C1", "C2"]


def normalize_level(raw: str | None, default: str = "A1") -> str:
    """
    Normaliza qualquer string de nível (legado ou CEFR) para o código
    CEFR canônico (ex: 'Business English' → 'C1', 'beginner' → 'A1').
    Retorna `default` se não reconhecido.
    """
    if not raw:
        return default
    key = str(raw).strip().lower().replace("_", " ").replace("-", " ")
    key = " ".join(key.split())
    result = LEVEL_ALIAS_MAP.get(key)
    if result:
        return result
    # Tenta match direto maiúsculas (ex: 'B2')
    upper = raw.strip().upper()
    if upper in CEFR_ORDER:
        return upper
    return default


def cefr_window(cefr_code: str, radius: int = 1) -> list[str]:
    """
    Retorna uma janela de níveis ao redor do código CEFR fornecido.
    Útil para mostrar conteúdo adjacente ao nível do aluno.
    Ex: cefr_window('B1', 1) → ['A2', 'B1', 'B2']
    """
    code = normalize_level(cefr_code)
    idx = CEFR_ORDER.index(code) if code in CEFR_ORDER else 1
    start = max(0, idx - radius)
    end = min(len(CEFR_ORDER), idx + radius + 1)
    return CEFR_ORDER[start:end]
