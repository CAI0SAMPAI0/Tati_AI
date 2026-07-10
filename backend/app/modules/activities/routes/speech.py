import base64
import re
import logging
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user
from app.modules.chat.services.llm import transcribe_audio_verbose

logger = logging.getLogger(__name__)

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

    # 0. Try Azure Speech Pronunciation Assessment if configured
    from app.shared.services.azure_speech_service import azure_speech_service
    if azure_speech_service.is_configured:
        azure_res = azure_speech_service.evaluate_pronunciation(audio_bytes, ref_clean)
        if "error" not in azure_res:
            score = azure_res["score"]
            if score >= 85:
                feedback = "Amazing! Your pronunciation is excellent."
            elif score >= 60:
                feedback = "Good job! You had a few minor slips, but you are very clear."
            else:
                feedback = "Keep practicing! Listen to Tati's audio and try repeating again."

            return {
                "score": score,
                "transcription": ref_clean,
                "words": azure_res["words"],
                "feedback": feedback,
                "metadata": {
                    "accuracy_score": azure_res["accuracy_score"],
                    "fluency_score": azure_res["fluency_score"],
                    "completeness_score": azure_res["completeness_score"]
                },
                "phonetic": {
                    "provider": "azure",
                    "raw_result": azure_res["raw_json"]
                }
            }
        else:
            logger.warning(f"Azure Speech evaluation error (falling back to Gemini/local): {azure_res.get('error')}")

    # 0.1 Try Gemini Speech Pronunciation Assessment if configured
    from app.shared.services.gemini_speech_service import gemini_speech_service
    if gemini_speech_service.is_configured:
        gemini_res = await gemini_speech_service.evaluate_pronunciation(audio_bytes, ref_clean)
        if "error" not in gemini_res:
            score = gemini_res.get("score", 0)
            feedback = gemini_res.get("feedback", "")
            if not feedback:
                if score >= 85:
                    feedback = "Amazing! Your pronunciation is excellent."
                elif score >= 60:
                    feedback = "Good job! You had a few minor slips, but you are very clear."
                else:
                    feedback = "Keep practicing! Listen to Tati's audio and try repeating again."

            return {
                "score": score,
                "transcription": ref_clean,
                "words": gemini_res.get("words", []),
                "feedback": feedback,
                "metadata": {
                    "accuracy_score": gemini_res.get("accuracy_score", score),
                    "fluency_score": gemini_res.get("fluency_score", score),
                    "completeness_score": gemini_res.get("completeness_score", score)
                },
                "phonetic": {
                    "provider": "gemini",
                    "raw_result": gemini_res
                }
            }
        else:
            logger.warning(f"Gemini Speech evaluation error (falling back to local): {gemini_res.get('error')}")

    trans_data = await transcribe_audio_verbose(
        audio_bytes,
        filename='temp.wav',
        prompt="Transcribe the speech verbatim. Do not normalize or correct mispronunciations."
    )

    transcription = trans_data.get("text", "") if isinstance(trans_data, dict) else ""
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
            "words": words_result,
            "metadata": {}
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
                # Stricter threshold to detect pronunciation mistakes (90% instead of 75%)
                if score >= 90:
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

    # Local phonetic evaluation using Wav2Vec2 and g2p-en
    phonetic_res = {}
    try:
        from app.shared.services.phonetic_service import phonetic_service
        phonetic_res = phonetic_service.evaluate_pronunciation(audio_bytes, ref_clean)
    except Exception as pe:
        logger.error(f"Error running local phonetic evaluation: {pe}")

    return {
        "score": overall_score,
        "transcription": transcription,
        "words": words_result,
        "feedback": feedback,
        "metadata": {
            "segments": trans_data.get("segments", []),
            "language": trans_data.get("language"),
            "duration": trans_data.get("duration")
        },
        "phonetic": phonetic_res
    }
