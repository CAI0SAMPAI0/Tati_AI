"""
Serviço de Challenge Semanal de Pronúncia.
Oferece 5 palavras por semana para prática de pronúncia.
"""
from datetime import datetime, timezone
from services.database import get_client
import hashlib

# Banco de palavras por dificuldade
WORD_BANK = {
    "beginner": [
        {"word": "thought", "phonetic": "/θɔːt/", "translation": "pensamento"},
        {"word": "through", "phonetic": "/θruː/", "translation": "através"},
        {"word": "three", "phonetic": "/θriː/", "translation": "três"},
        {"word": "birthday", "phonetic": "/ˈbɜːrθdeɪ/", "translation": "aniversário"},
        {"word": "with", "phonetic": "/wɪð/", "translation": "com"},
        {"word": "this", "phonetic": "/ðɪs/", "translation": "isto"},
        {"word": "mother", "phonetic": "/ˈmʌðər/", "translation": "mãe"},
        {"word": "breathe", "phonetic": "/briːð/", "translation": "respirar"},
    ],
    "intermediate": [
        {"word": "thorough", "phonetic": "/ˈθʌrə/", "translation": "minucioso"},
        {"word": "strengths", "phonetic": "/streŋkθs/", "translation": "pontos fortes"},
        {"word": "rural", "phonetic": "/ˈrʊrəl/", "translation": "rural"},
        {"word": "squirrel", "phonetic": "/ˈskwɜːrəl/", "translation": "esquilo"},
        {"word": "colonel", "phonetic": "/ˈkɜːrnəl/", "translation": "coronel"},
        {"word": "anemone", "phonetic": "/əˈneməni/", "translation": "anêmona"},
        {"word": "specific", "phonetic": "/spəˈsɪfɪk/", "translation": "específico"},
        {"word": "statistics", "phonetic": "/stəˈtɪstɪks/", "translation": "estatísticas"},
    ],
    "advanced": [
        {"word": "sixth", "phonetic": "/sɪksθ/", "translation": "sexto"},
        {"word": "twelfth", "phonetic": "/twelfθ/", "translation": "décimo segundo"},
        {"word": "hypothesis", "phonetic": "/haɪˈpɒθəsɪs/", "translation": "hipótese"},
        {"word": "phenomenon", "phonetic": "/fɪˈnɒmɪnən/", "translation": "fenômeno"},
        {"word": "entrepreneur", "phonetic": "/ˌɒntrəprəˈnɜːr/", "translation": "empreendedor"},
        {"word": "conscience", "phonetic": "/ˈkɒnʃəns/", "translation": "consciência"},
        {"word": "hierarchy", "phonetic": "/ˈhaɪərɑːrki/", "translation": "hierarquia"},
        {"word": "chaos", "phonetic": "/ˈkeɪɒs/", "translation": "caos"},
    ]
}


def get_current_week_challenge() -> dict:
    """Retorna o challenge da semana atual."""
    now = datetime.now(timezone.utc)
    week_str = f"{now.year}-W{now.isocalendar()[1]}"
    week_hash = int(hashlib.md5(week_str.encode()).hexdigest()[:8], 16)
    
    # Seleciona palavras baseado na semana
    all_words = WORD_BANK["beginner"] + WORD_BANK["intermediate"] + WORD_BANK["advanced"]
    start_idx = week_hash % len(all_words)
    
    # Pega 5 palavras consecutivas
    words = []
    for i in range(5):
        words.append(all_words[(start_idx + i) % len(all_words)])
    
    return {
        "week": week_str,
        "words": words,
        "difficulty": "mixed",
    }


def submit_attempt(username: str, challenge_id: str, score: int, audio_b64: str = "") -> dict:
    """Registra tentativa de pronúncia."""
    db = get_client()
    
    try:
        row = (
            db.table("users")
            .select("pronunciation_challenges")
            .eq("username", username)
            .single()
            .execute()
            .data
        )
        
        attempts = row.get("pronunciation_challenges", []) if row else []
    except Exception:
        attempts = []
    
    attempts.append({
        "challenge_id": challenge_id,
        "score": score,
        "audio_b64": audio_b64,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    })
    
    db.table("users").update({
        "pronunciation_challenges": attempts
    }).eq("username", username).execute()
    
    return {"ok": True, "total_attempts": len(attempts)}


def get_user_attempts(username: str) -> list[dict]:
    """Retorna tentativas do usuário."""
    db = get_client()
    
    try:
        row = (
            db.table("users")
            .select("pronunciation_challenges")
            .eq("username", username)
            .single()
            .execute()
            .data
        )
        
        return row.get("pronunciation_challenges", []) if row else []
    except Exception:
        return []
