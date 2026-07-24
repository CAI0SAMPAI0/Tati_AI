import io
import json
import logging
from typing import Any

from app.core.config import settings
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# Pydantic models for structured output matching our API schema
class WordAssessment(BaseModel):
    word: str = Field(description="The exact expected word from the reference text.")
    score: int = Field(description="Pronunciation accuracy score from 0 to 100.")
    accuracy: str = Field(
        description="'correct' if score is 80 or above, otherwise 'incorrect'."
    )
    error_type: str = Field(
        description="Phonetic error classification: 'None', 'Mispronunciation', 'Omission', or 'Insertion'."
    )


class PronunciationAssessmentResponse(BaseModel):
    score: int = Field(description="Overall pronunciation score from 0 to 100.")
    accuracy_score: int = Field(description="Acoustic accuracy score from 0 to 100.")
    fluency_score: int = Field(description="Fluency and rhythm score from 0 to 100.")
    completeness_score: int = Field(
        description="Percentage of words correctly pronounced from 0 to 100."
    )
    words: list[WordAssessment] = Field(
        description="Word-by-word breakdown of the evaluation."
    )
    feedback: str = Field(
        description="Conversational, friendly feedback in Portuguese correcting pronunciation naturally, as if Tati were speaking to the student in person."
    )


class GeminiSpeechService:
    @property
    def is_configured(self) -> bool:
        return len(settings.gemini_keys) > 0

    async def evaluate_pronunciation(
        self, audio_bytes: bytes, reference_text: str
    ) -> dict[str, Any]:
        """
        Evaluates pronunciation using Gemini 2.0 Flash Multimodal capabilities.
        Preprocesses audio to 16kHz mono WAV for high precision, then uses Pydantic schema
        to guarantee structured responses. Falls back to raw bytes if preprocessing fails.
        """
        if not self.is_configured:
            return {"error": "Gemini Speech Service is not configured."}

        keys = settings.gemini_keys
        last_err = None

        # 1. Preprocess audio to standard 16kHz mono WAV
        mime_type = "audio/wav"
        data_to_send = audio_bytes
        try:
            import librosa
            import soundfile as sf

            audio_fp = io.BytesIO(audio_bytes)
            speech, rate = sf.read(audio_fp)

            if len(speech.shape) > 1:
                speech = speech.mean(axis=1)

            if rate != 16000:
                speech = librosa.resample(speech, orig_sr=rate, target_sr=16000)

            out_fp = io.BytesIO()
            sf.write(out_fp, speech, 16000, format="WAV", subtype="PCM_16")
            data_to_send = out_fp.getvalue()
        except Exception as e:
            logger.warning(
                f"[GeminiSpeech] Audio preprocessing failed, falling back to raw container bytes: {e}"
            )
            mime_type = "audio/webm"
            data_to_send = audio_bytes

        # 2. Conversational pronunciation correction prompt
        prompt = f"""
You are Tati, a warm, friendly English teacher helping a Brazilian Portuguese speaker improve their pronunciation. You speak naturally, like a real conversation — NOT like a list or report.

Expected text: "{reference_text}"

Listen to the audio and compare it to the expected text. Then respond as Tati would in a real tutoring session:

1. First, acknowledge what they said well (be genuine, not generic).
2. Point out specific pronunciation issues in a conversational way:
   - For epenthesis (extra "-ee" sounds): "Hey, I noticed you added an 'ee' sound at the end of 'Jack' — in English, we don't do that. Try saying just 'Jack', clean at the end."
   - For vowel confusion (ship/sheep): "Careful with the vowel in 'ship' — it's short, like /ɪ/. The long version /iː/ would be 'sheep'. You said something closer to 'sheep'."
   - For TH sounds: "The 'th' in 'think' is tricky! It's not 'tink' or 'fink' — try putting your tongue between your teeth."
3. Give them the correct pronunciation with a simple tip they can remember.
4. Encourage them warmly.

CRITICAL RULES:
- Your feedback MUST be conversational, like a real teacher talking to a student in a voice call.
- Do NOT output a list or table. Talk naturally in Portuguese.
- Be strict about mispronunciations but kind in your delivery.
- Only mark words as "incorrect" if there's a real pronunciation issue, not minor accent differences.
- The overall feedback should feel like Tati is having a friendly chat, not giving a report.
"""

        # 3. Request structured outputs using the new google.genai client
        for key in keys:
            try:
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=key)

                audio_part = types.Part.from_bytes(
                    data=data_to_send, mime_type=mime_type
                )

                def _generate():
                    response = client.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=[prompt, audio_part],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=PronunciationAssessmentResponse,
                        ),
                    )
                    return response.text

                raw_response = await run_in_threadpool(_generate)
                parsed = json.loads(raw_response)
                return parsed

            except Exception as e:
                logger.warning(f"[GeminiSpeech] Error evaluating with key: {e}")
                last_err = e

        logger.error(f"Failed evaluating speech through Gemini: {last_err}")
        return {"error": f"Failed evaluating speech through Gemini: {last_err}"}


gemini_speech_service = GeminiSpeechService()
