import base64
import logging
import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user
from app.modules.chat.services.audio_generator import generate_teacher_audio
from app.modules.chat.services.llm import transcribe_audio_verbose

logger = logging.getLogger(__name__)

router = APIRouter()


class VerifyPronunciationRequest(BaseModel):
    audio: str
    reference_text: str = ""


def extract_segment_word_scores(trans_data) -> dict[str, float]:
    """Extract per-word confidence from Whisper segments if available."""
    scores = {}
    if not isinstance(trans_data, dict):
        return scores
    for seg in trans_data.get("segments", []):
        if "words" in seg:
            for word in seg["words"]:
                w = word.get("word", "").strip()
                conf = word.get("confidence") or word.get("probability")
                if w and conf is not None:
                    scores[w.lower()] = max(scores.get(w.lower(), 0), conf)
    return scores


def word_conf_to_score(conf: float) -> int:
    """Map confidence value (0-1) to score percentage (0-100)."""
    if conf >= 0.95:
        return int(conf * 100)
    if conf >= 0.8:
        return int(conf * 100)
    return int(conf * 100)


def compute_local_evaluation(ref_words, transcript_words, word_conf_scores):
    """Improved local pronunciation evaluation.
    
    Uses three signals:
    1. Exact word match between reference and transcription.
    2. Sequence-based close-matching for near-miss words.
    3. Word-level confidence from Whisper (if available).
    """
    def clean_word(w):
        return re.sub(r"[^\w\s]", "", w).lower()

    clean_ref = [clean_word(w) for w in ref_words]
    clean_trans = [clean_word(w) for w in transcript_words]

    matcher = SequenceMatcher(None, clean_ref, clean_trans)

    words_result = []
    for word in ref_words:
        words_result.append({"word": word, "score": 0, "accuracy": "incorrect", "confidence": 0})

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for i in range(i1, i2):
                w = clean_ref[i]
                conf = word_conf_scores.get(w, 1.0)
                s = int(conf * 100)
                words_result[i]["score"] = s
                words_result[i]["accuracy"] = "correct" if conf >= 0.7 else "incorrect"
                words_result[i]["confidence"] = conf
        elif tag == "replace":
            for idx_ref in range(i1, i2):
                best_score = 0
                best_conf = 0
                ref_w = clean_ref[idx_ref]
                for idx_trans in range(j1, j2):
                    trans_w = clean_trans[idx_trans]
                    sim = SequenceMatcher(None, ref_w, trans_w).ratio()
                    conf = word_conf_scores.get(trans_w, sim)
                    if sim > best_score:
                        best_score = sim
                        best_conf = conf
                # Blended score: 70% char match + 30% confidence
                s = int((best_score * 0.7 + best_conf * 0.3) * 100)
                words_result[idx_ref]["score"] = s
                words_result[idx_ref]["accuracy"] = "correct" if s >= 80 else "incorrect"
                words_result[idx_ref]["confidence"] = best_conf

    return words_result


def get_conversational_feedback(
    score: int, words_result: list, transcription: str, ref_text: str, free_speech: bool = False
) -> str:
    incorrect = [w for w in words_result if w["accuracy"] == "incorrect"]
    correct = [w for w in words_result if w["accuracy"] == "correct"]
    pct = score

    if free_speech:
        if pct >= 85:
            return (
                f"Great job! I understood everything you said perfectly. "
                f"Your clarity is excellent — keep it up!"
            )
        elif pct >= 60:
            return (
                f"Good effort! I understood most of what you said. "
                f"Try to slow down a little and focus on each word. "
                f"You're doing well!"
            )
        else:
            return (
                f"I heard you say \"{transcription}\". "
                f"Try to speak a bit slower and more clearly. "
                f"Practice makes perfect!"
            )

    if pct >= 90:
        return (
            f"Excellent! Your pronunciation was spot on. "
            f"Every word was clear and accurate. "
            f"Keep practicing like this!"
        )
    elif pct >= 75:
        word_list = ", ".join(f'"{w["word"]}"' for w in incorrect[:3])
        if word_list:
            return (
                f"Almost perfect! I noticed a small slip on {word_list}. "
                f"Try listening to the correct pronunciation and repeating it. "
                f"You're very close!"
            )
        return "Great job! Very clear pronunciation."
    elif pct >= 50:
        word_list = ", ".join(f'"{w["word"]}"' for w in incorrect[:4])
        return (
            f"Good start! Pay extra attention to {word_list}. "
            f"Listen to Tati's pronunciation below and try again. "
            f"Focus on each sound — you can do it!"
        )
    else:
        return (
            f"Let's try again! I heard \"{transcription}\" but the target was "
            f"\"{ref_text}\". Listen carefully to Tati's pronunciation "
            f"and repeat each word slowly."
        )


@router.post("/verify-pronunciation")
async def verify_pronunciation(
    req: VerifyPronunciationRequest,
    user=Depends(get_current_user),
):
    try:
        audio_bytes = base64.b64decode(req.audio)
    except Exception:
        raise HTTPException(
            status_code=400, detail="Invalid audio format (base64 expected)"
        )

    audio_size_kb = len(audio_bytes) / 1024
    logger.info(f"Audio received: {audio_size_kb:.1f} KB")
    if audio_size_kb < 5:
        raise HTTPException(
            status_code=400,
            detail="Audio too short or empty. Please record for at least 2 seconds.",
        )

    ref_raw = (req.reference_text or "").strip()
    is_free_speech = not ref_raw

    # Step 1: Always transcribe
    prompt = "" if is_free_speech else f"The target phrase is: {ref_raw}"
    trans_data = await transcribe_audio_verbose(
        audio_bytes, filename="temp.wav", prompt=prompt
    )

    transcription = trans_data.get("text", "") if isinstance(trans_data, dict) else ""

    prompt_texts = [
        "Transcribe the speech verbatim",
        "Do not normalize or correct",
        "transcribe their English words accurately",
    ]
    if any(pt in transcription for pt in prompt_texts):
        logger.warning(
            f"Whisper returned prompt text as transcription: {transcription[:100]}"
        )
        transcription = ""

    if not transcription or transcription.startswith("[Erro"):
        words_result = [{"word": w, "score": 0, "accuracy": "incorrect"} for w in ref_raw.split()] if ref_raw else []
        feedback = get_conversational_feedback(0, words_result, "", ref_raw, is_free_speech)
        return {
            "score": 0,
            "transcription": "",
            "words": words_result,
            "feedback": feedback,
            "metadata": {
                "segments": trans_data.get("segments", []),
                "language": trans_data.get("language"),
                "duration": trans_data.get("duration"),
                "free_speech": is_free_speech,
            },
        }

    # Determine the actual reference text we will evaluate against
    actual_ref = ref_raw if ref_raw else transcription

    # Generate TTS audio of correct pronunciation (best effort)
    correct_audio = ""
    if actual_ref:
        try:
            correct_audio = await generate_teacher_audio(actual_ref) or ""
        except Exception:
            logger.warning("Failed to generate TTS for correct pronunciation")

    # Step 2: Try Azure (only if reference available)
    if actual_ref:
        from app.shared.services.azure_speech_service import azure_speech_service

        if azure_speech_service.is_configured:
            azure_res = azure_speech_service.evaluate_pronunciation(audio_bytes, actual_ref)
            if "error" not in azure_res:
                score = azure_res["score"]
                words = azure_res["words"]
                feedback = get_conversational_feedback(
                    score, words, transcription, actual_ref, is_free_speech
                )
                return {
                    "score": score,
                    "transcription": actual_ref if not is_free_speech else transcription,
                    "words": words,
                    "feedback": feedback,
                    "correct_audio": correct_audio,
                    "metadata": {
                        "accuracy_score": azure_res["accuracy_score"],
                        "fluency_score": azure_res["fluency_score"],
                        "completeness_score": azure_res["completeness_score"],
                        "free_speech": is_free_speech,
                    },
                    "phonetic": {"provider": "azure", "raw_result": azure_res["raw_json"]},
                }
            logger.warning(f"Azure Speech error (fallback): {azure_res.get('error')}")

    # Step 3: Try Gemini (only if reference availabe)
    if actual_ref:
        from app.shared.services.gemini_speech_service import gemini_speech_service

        if gemini_speech_service.is_configured:
            gemini_res = await gemini_speech_service.evaluate_pronunciation(
                audio_bytes, actual_ref
            )
            if "error" not in gemini_res:
                score = gemini_res.get("score", 0)
                words = gemini_res.get("words", [])
                g_feedback = gemini_res.get("feedback", "")
                if g_feedback:
                    feedback = g_feedback
                else:
                    feedback = get_conversational_feedback(
                        score, words, transcription, actual_ref, is_free_speech
                    )
                return {
                    "score": score,
                    "transcription": actual_ref if not is_free_speech else transcription,
                    "words": words,
                    "feedback": feedback,
                    "correct_audio": correct_audio,
                    "metadata": {
                        "accuracy_score": gemini_res.get("accuracy_score", score),
                        "fluency_score": gemini_res.get("fluency_score", score),
                        "completeness_score": gemini_res.get("completeness_score", score),
                        "free_speech": is_free_speech,
                    },
                    "phonetic": {"provider": "gemini", "raw_result": gemini_res},
                }
            logger.warning(f"Gemini Speech error (fallback): {gemini_res.get('error')}")

    # Step 4: Local evaluation
    word_conf_scores = extract_segment_word_scores(trans_data)
    ref_words = actual_ref.split()
    trans_words = transcription.split()
    words_result = compute_local_evaluation(ref_words, trans_words, word_conf_scores)

    correct_count = sum(1 for w in words_result if w["accuracy"] == "correct")
    total_words = len(words_result)
    overall_score = int((correct_count / total_words) * 100) if total_words > 0 else 0

    feedback = get_conversational_feedback(overall_score, words_result, transcription, actual_ref, is_free_speech)

    return {
        "score": overall_score,
        "transcription": transcription,
        "words": words_result,
        "feedback": feedback,
        "correct_audio": correct_audio,
        "metadata": {
            "segments": trans_data.get("segments", []),
            "language": trans_data.get("language"),
            "duration": trans_data.get("duration"),
            "free_speech": is_free_speech,
        },
    }
