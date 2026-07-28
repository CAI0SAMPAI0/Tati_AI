import base64
import logging
import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user
from app.modules.chat.services.audio_generator import generate_teacher_audio
from app.modules.chat.services.llm import transcribe_audio_verbose

# Contraction mapping for pronunciation evaluation
# Maps contractions to their expanded forms
CONTRACTIONS_MAP = {
    "ain't": "am not",
    "aren't": "are not",
    "can't": "cannot",
    "could've": "could have",
    "couldn't": "could not",
    "didn't": "did not",
    "doesn't": "does not",
    "don't": "do not",
    "hadn't": "had not",
    "hasn't": "has not",
    "haven't": "have not",
    "he'd": "he would",
    "he'll": "he will",
    "he's": "he is",
    "i'd": "i would",
    "i'll": "i will",
    "i'm": "i am",
    "i've": "i have",
    "isn't": "is not",
    "it's": "it is",
    "let's": "let us",
    "might've": "might have",
    "mustn't": "must not",
    "shan't": "shall not",
    "she'd": "she would",
    "she'll": "she will",
    "she's": "she is",
    "should've": "should have",
    "shouldn't": "should not",
    "that's": "that is",
    "there's": "there is",
    "they'd": "they would",
    "they'll": "they will",
    "they're": "they are",
    "they've": "they have",
    "wasn't": "was not",
    "we'd": "we would",
    "we'll": "we will",
    "we're": "we are",
    "we've": "we have",
    "weren't": "were not",
    "what's": "what is",
    "where's": "where is",
    "who'd": "who would",
    "who'll": "who will",
    "who's": "who is",
    "won't": "will not",
    "would've": "would have",
    "wouldn't": "would not",
    "you'd": "you would",
    "you'll": "you will",
    "you're": "you are",
    "you've": "you have",
}

# Reverse map: expanded forms keyed by first+second word for matching
EXPANDED_TO_CONTRACTION: dict[str, str] = {}
for contr, expanded in CONTRACTIONS_MAP.items():
    EXPANDED_TO_CONTRACTION[expanded] = contr


def expand_contractions(text: str) -> str:
    """Expand English contractions to full forms for consistent comparison."""
    words = text.lower().split()
    expanded = []
    for w in words:
        w_clean = w.strip(".,!?;:'\"")
        if w_clean in CONTRACTIONS_MAP:
            expanded.append(CONTRACTIONS_MAP[w_clean])
        else:
            expanded.append(w_clean)
    return " ".join(expanded)


def get_contraction_alternatives(text: str) -> list[list[str]]:
    """Return list of word alternatives considering contractions.

    e.g. "i would" -> [["i", "would"], ["i'd"]]
         "i'd"     -> [["i'd"], ["i", "would"]]
    """
    words = text.lower().split()
    alternatives = []
    for w in words:
        w_clean = w.strip(".,!?;:'\"")
        if w_clean in CONTRACTIONS_MAP:
            alternatives.append([w_clean] + CONTRACTIONS_MAP[w_clean].split())
        elif w_clean in EXPANDED_TO_CONTRACTION:
            alternatives.append([w_clean, EXPANDED_TO_CONTRACTION[w_clean]])
        else:
            alternatives.append([w_clean])
    return alternatives


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
    """Evaluate pronunciation with contraction handling.

    Expands contractions (I'd → I would, don't → do not) before comparing
    so the user gets credit for using either form.
    Strips trailing punctuation from words for clean display.
    """

    def clean_word(w):
        return re.sub(r"[^\w\s]", "", w).lower()

    def strip_punct(w):
        return re.sub(r"[.,!?;:'\"]+$", "", w).strip()

    def normalize_for_contraction(w):
        return re.sub(r"[.,!?;\"]+", "", w).strip().lower()

    # Clean ref words for display (strip trailing punctuation)
    display_words = [strip_punct(w) for w in ref_words]

    # Expand reference words, tracking which original word each expanded part maps to
    expanded_ref = []
    ref_map = []
    for i, w in enumerate(ref_words):
        norm = normalize_for_contraction(w)
        wc = clean_word(w)
        if norm in CONTRACTIONS_MAP:
            parts = CONTRACTIONS_MAP[norm].split()
            expanded_ref.extend(parts)
            ref_map.extend([i] * len(parts))
        else:
            expanded_ref.append(wc)
            ref_map.append(i)

    # Expand transcription words
    expanded_trans = []
    for w in transcript_words:
        norm = normalize_for_contraction(w)
        wc = clean_word(w)
        if norm in CONTRACTIONS_MAP:
            expanded_trans.extend(CONTRACTIONS_MAP[norm].split())
        else:
            expanded_trans.append(wc)

    # Compare expanded sequences
    matcher = SequenceMatcher(None, expanded_ref, expanded_trans)

    # Accumulate scores per original reference word
    acc = {i: {"total": 0, "count": 0} for i in range(len(ref_words))}

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for ei in range(i1, i2):
                oi = ref_map[ei]
                acc[oi]["total"] += 100
                acc[oi]["count"] += 1
        elif tag == "replace":
            for ei in range(i1, i2):
                oi = ref_map[ei]
                best_sim = 0
                for tj in range(j1, j2):
                    sim = SequenceMatcher(
                        None, expanded_ref[ei], expanded_trans[tj]
                    ).ratio()
                    best_sim = max(best_sim, sim)
                acc[oi]["total"] += int(best_sim * 100)
                acc[oi]["count"] += 1

    words_result = []
    for i, word in enumerate(ref_words):
        if acc[i]["count"] > 0:
            s = acc[i]["total"] // acc[i]["count"]
        else:
            s = 0
        norm = normalize_for_contraction(word)
        wc = clean_word(word)
        conf = word_conf_scores.get(norm, 0) or word_conf_scores.get(wc, 0)
        if norm in CONTRACTIONS_MAP:
            for part in CONTRACTIONS_MAP[norm].split():
                conf = max(conf, word_conf_scores.get(part, 0))
        else:
            conf = max(conf, word_conf_scores.get(norm, 0), word_conf_scores.get(wc, 0))
        if conf > 0:
            s = max(s, int(conf * 100))
        words_result.append(
            {
                "word": display_words[i],
                "score": s,
                "accuracy": "correct" if s >= 80 else "incorrect",
                "confidence": conf,
            }
        )

    return words_result


def get_conversational_feedback(
    score: int,
    words_result: list,
    transcription: str,
    ref_text: str,
    free_speech: bool = False,
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
                f'I heard you say "{transcription}". '
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
            f'Let\'s try again! I heard "{transcription}" but the target was '
            f'"{ref_text}". Listen carefully to Tati\'s pronunciation '
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
        words_result = (
            [{"word": w, "score": 0, "accuracy": "incorrect"} for w in ref_raw.split()]
            if ref_raw
            else []
        )
        feedback = get_conversational_feedback(
            0, words_result, "", ref_raw, is_free_speech
        )
        correct_audio = ""
        if ref_raw:
            try:
                correct_audio = await generate_teacher_audio(ref_raw) or ""
            except Exception:
                pass
        return {
            "score": 0,
            "transcription": "",
            "words": words_result,
            "feedback": "I couldn't hear you clearly. Please try recording again in a quiet environment.",
            "correct_audio": correct_audio,
            "metadata": {
                "segments": trans_data.get("segments", []),
                "language": trans_data.get("language"),
                "duration": trans_data.get("duration"),
                "free_speech": is_free_speech,
            },
        }

    # Detect very short transcription compared to reference (bad recording)
    trans_word_count = len(transcription.split())
    ref_word_count = len(ref_raw.split()) if ref_raw else 0
    if (
        ref_raw
        and trans_word_count > 0
        and ref_word_count >= 5
        and trans_word_count <= 2
    ):
        logger.warning(
            f"Very short transcription ({transcription}) vs reference ({ref_raw}) — likely bad recording"
        )
        words_result = [
            {"word": w, "score": 0, "accuracy": "incorrect"} for w in ref_raw.split()
        ]
        correct_audio = ""
        if ref_raw:
            try:
                correct_audio = await generate_teacher_audio(ref_raw) or ""
            except Exception:
                pass
        return {
            "score": 0,
            "transcription": transcription,
            "words": words_result,
            "feedback": "The recording was too short or unclear. Please hold the button and speak the full sentence clearly.",
            "correct_audio": correct_audio,
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
            azure_res = azure_speech_service.evaluate_pronunciation(
                audio_bytes, actual_ref
            )
            if "error" not in azure_res:
                score = azure_res["score"]
                words = azure_res["words"]
                feedback = get_conversational_feedback(
                    score, words, transcription, actual_ref, is_free_speech
                )
                return {
                    "score": score,
                    "transcription": (
                        actual_ref if not is_free_speech else transcription
                    ),
                    "words": words,
                    "feedback": feedback,
                    "correct_audio": correct_audio,
                    "metadata": {
                        "accuracy_score": azure_res["accuracy_score"],
                        "fluency_score": azure_res["fluency_score"],
                        "completeness_score": azure_res["completeness_score"],
                        "free_speech": is_free_speech,
                    },
                    "phonetic": {
                        "provider": "azure",
                        "raw_result": azure_res["raw_json"],
                    },
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
                    "transcription": (
                        actual_ref if not is_free_speech else transcription
                    ),
                    "words": words,
                    "feedback": feedback,
                    "correct_audio": correct_audio,
                    "metadata": {
                        "accuracy_score": gemini_res.get("accuracy_score", score),
                        "fluency_score": gemini_res.get("fluency_score", score),
                        "completeness_score": gemini_res.get(
                            "completeness_score", score
                        ),
                        "free_speech": is_free_speech,
                    },
                    "phonetic": {"provider": "gemini", "raw_result": gemini_res},
                }
            logger.warning(f"Gemini Speech error (fallback): {gemini_res.get('error')}")

    # Step 4: Phoneme-level evaluation (immune to ASR homophone normalization)
    # Uses wav2vec2 phoneme recognition + g2p-en to compare actual phonemes
    # from audio against expected phonemes — not text words.
    if actual_ref:
        try:
            from app.shared.services.phonetic_service import phonetic_service

            phonetic_service._lazy_init()
            if phonetic_service._model_available:
                phonetic_result = phonetic_service.evaluate_per_word(
                    audio_bytes, actual_ref
                )
                if phonetic_result.get("score", 0) > 0:
                    words_result = phonetic_result.get("words", [])
                    overall_score = phonetic_result.get("score", 0)

                    # Blend with Whisper confidence where available
                    word_conf_scores = extract_segment_word_scores(trans_data)
                    for w in words_result:
                        norm = w["word"].lower().strip(".,!?;:'\"")
                        conf = word_conf_scores.get(norm, 0)
                        if conf > 0 and w["score"] > 0:
                            blended = int(w["score"] * 0.7 + conf * 100 * 0.3)
                            w["score"] = blended
                            w["accuracy"] = "correct" if blended >= 80 else "incorrect"
                        # Carry best available IPA for frontend display
                        w["confidence"] = conf

                    feedback = get_conversational_feedback(
                        overall_score,
                        words_result,
                        transcription,
                        actual_ref,
                        is_free_speech,
                    )

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
                        "phonetic": {
                            "provider": "wav2vec2+g2p",
                            "spoken_ipa": phonetic_result.get("spoken_ipa", ""),
                            "expected_ipa": phonetic_result.get("expected_ipa", ""),
                        },
                    }
                logger.warning(
                    f"Phonetic evaluation returned low score or empty, falling back to text comparison: {phonetic_result}"
                )
        except Exception as e:
            logger.error(
                f"Phonetic evaluation error, falling back to text comparison: {e}"
            )

    # Step 5: Text-based fallback (only when phoneme model is unavailable)
    word_conf_scores = extract_segment_word_scores(trans_data)
    ref_words = actual_ref.split()
    trans_words = transcription.split()
    words_result = compute_local_evaluation(ref_words, trans_words, word_conf_scores)

    correct_count = sum(1 for w in words_result if w["accuracy"] == "correct")
    total_words = len(words_result)
    overall_score = int((correct_count / total_words) * 100) if total_words > 0 else 0

    feedback = get_conversational_feedback(
        overall_score, words_result, transcription, actual_ref, is_free_speech
    )

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
