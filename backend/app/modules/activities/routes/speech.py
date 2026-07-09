import base64
import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user
from app.modules.chat.services.llm import transcribe_audio

router = APIRouter()


class VerifyPronunciationRequest(BaseModel):
    audio: str
    reference_text: str


@router.post('/verify-pronunciation')
async def verify_pronunciation(
    req: VerifyPronunciationRequest,
    user=Depends(get_current_user),
):
    try:
        audio_bytes = base64.b64decode(req.audio)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid audio format (base64 expected)"
        )

    ref_clean = req.reference_text.strip()
    transcription = await transcribe_audio(
        audio_bytes,
        filename='temp.wav',
        prompt="Transcribe the speech verbatim. Do not normalize or correct mispronunciations."
    )

    if not transcription or transcription.startswith("[Erro"):
        words_result = []
        for word in ref_clean.split():
            words_result.append({
                "word": word,
                "score": 0,
                "accuracy": "incorrect"
            })
        return {
            "score": 0,
            "transcription": "",
            "words": words_result
        }

    ref_words = ref_clean.split()

    def clean_word(w):
        return re.sub(r'[^\w\s]', '', w).lower()

    clean_ref = [clean_word(w) for w in ref_words]
    clean_trans = [clean_word(w) for w in transcription.split()]

    matcher = SequenceMatcher(None, clean_ref, clean_trans)

    words_result = []
    for word in ref_words:
        words_result.append({
            "word": word,
            "score": 0,
            "accuracy": "incorrect"
        })

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for i in range(i1, i2):
                words_result[i]["score"] = 100
                words_result[i]["accuracy"] = "correct"
        elif tag == 'replace':
            for idx_ref in range(i1, i2):
                best_score = 0
                ref_w = clean_ref[idx_ref]
                for idx_trans in range(j1, j2):
                    trans_w = clean_trans[idx_trans]
                    sim = SequenceMatcher(None, ref_w, trans_w).ratio()
                    if sim > best_score:
                        best_score = sim

                score = int(best_score * 100)
                if score >= 75:
                    words_result[idx_ref]["score"] = score
                    words_result[idx_ref]["accuracy"] = "correct"
                else:
                    words_result[idx_ref]["score"] = score
                    words_result[idx_ref]["accuracy"] = "incorrect"

    correct_count = sum(1 for w in words_result if w["accuracy"] == "correct")
    total_words = len(words_result)
    overall_score = int((correct_count / total_words) * 100) if total_words > 0 else 0

    if overall_score >= 85:
        feedback = "Amazing! Your pronunciation is excellent."
    elif overall_score >= 60:
        feedback = "Good job! You had a few minor slips, but you are very clear."
    else:
        feedback = "Keep practicing! Listen to Tati's audio and try repeating again."

    return {
        "score": overall_score,
        "transcription": transcription,
        "words": words_result,
        "feedback": feedback
    }
