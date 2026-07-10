import logging
import json
import io
from typing import Dict, Any
from pydantic import BaseModel, Field
from app.core.config import settings
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

# Pydantic models for structured output matching our API schema
class WordAssessment(BaseModel):
    word: str = Field(description="The exact expected word from the reference text.")
    score: int = Field(description="Pronunciation accuracy score from 0 to 100.")
    accuracy: str = Field(description="'correct' if score is 80 or above, otherwise 'incorrect'.")
    error_type: str = Field(description="Phonetic error classification: 'None', 'Mispronunciation', 'Omission', or 'Insertion'.")

class PronunciationAssessmentResponse(BaseModel):
    score: int = Field(description="Overall pronunciation score from 0 to 100.")
    accuracy_score: int = Field(description="Acoustic accuracy score from 0 to 100.")
    fluency_score: int = Field(description="Fluency and rhythm score from 0 to 100.")
    completeness_score: int = Field(description="Percentage of words correctly pronounced from 0 to 100.")
    words: list[WordAssessment] = Field(description="Word-by-word breakdown of the evaluation.")
    feedback: str = Field(description="Detailed pedagogical feedback in Portuguese explaining accents, pauses, and phonetic deviations.")

class GeminiSpeechService:
    @property
    def is_configured(self) -> bool:
        return len(settings.gemini_keys) > 0

    async def evaluate_pronunciation(self, audio_bytes: bytes, reference_text: str) -> Dict[str, Any]:
        """
        Evaluates pronunciation using Gemini 2.0 Flash Multimodal capabilities.
        Preprocesses audio to 16kHz mono WAV for high precision, then uses Pydantic schema
        to guarantee structured responses. Falls back to raw bytes if preprocessing fails.
        """
        if not self.is_configured:
            return {"error": "Gemini Speech Service is not configured."}

        import google.generativeai as genai

        keys = settings.gemini_keys
        last_err = None

        # 1. Preprocess audio to standard 16kHz mono WAV (Pillar 1: Formatos suportados & Isolamento de fonemas)
        mime_type = "audio/wav"
        data_to_send = audio_bytes
        try:
            import soundfile as sf
            import librosa

            audio_fp = io.BytesIO(audio_bytes)
            speech, rate = sf.read(audio_fp)
            
            # If stereo, convert to mono
            if len(speech.shape) > 1:
                speech = speech.mean(axis=1)
            
            # Resample to 16kHz for better phoneme isolation
            if rate != 16000:
                speech = librosa.resample(speech, orig_sr=rate, target_sr=16000)
            
            out_fp = io.BytesIO()
            sf.write(out_fp, speech, 16000, format='WAV', subtype='PCM_16')
            data_to_send = out_fp.getvalue()
        except Exception as e:
            logger.warning(f"[GeminiSpeech] Audio preprocessing failed, falling back to raw container bytes: {e}")
            # Fallback to webm or general audio container if we cannot parse it locally
            mime_type = "audio/webm"
            data_to_send = audio_bytes

        # 2. Engineering the Prompt (Pillar 4: Forneça o texto esperado e instruções fonéticas)
        prompt = f"""
You are an expert English speech therapist and English-as-a-Second-Language (ESL) instructor.
Analyze the pronunciation of the speaker in the provided audio file.

Expected text they were trying to read: "{reference_text}"

Compare the acoustic signals of the audio against this reference text.
Assess:
1. Phonetic correctness of each word. Pay absolute attention to HETERONYMS (words that are spelled the same but pronounced differently depending on meaning or part of speech):
   - Example: "live" can be /laɪv/ (as in "live transmission", "live show", "live music" - adjective/adverb) OR /lɪv/ (as in "I live here", "to live" - verb).
   - Example: "read" can be /riːd/ (present tense) OR /red/ (past tense).
   - Identify any heteronyms in the expected text, determine their correct expected pronunciation based on grammatical context in the sentence, and grade the speaker's pronunciation accordingly.
2. Rhythm, speed, pauses, and accent.
3. Specific errors per word:
   - "None" if correct.
   - "Mispronunciation" if phonetically incorrect.
   - "Omission" if skipped.
   - "Insertion" if extra words were spoken.

CRITICAL: If the speaker mispronounces a heteronym (e.g. they say /lɪv/ instead of /laɪv/ for "live transmission", or vice-versa), you MUST mark it as "Mispronunciation" and explain the distinction in the feedback in Portuguese (e.g. explain that 'live' as transmission/show has the sound /laɪv/, while 'live' as verb has the sound /lɪv/).

You must fill out the structured schema correctly. The feedback must be in Portuguese, friendly, and pedagogical.
"""

        # 3. Requesting structured outputs (Pillar 2: Respostas estruturadas via Pydantic)
        for key in keys:
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel('gemini-2.0-flash')

                audio_part = {
                    "mime_type": mime_type,
                    "data": data_to_send
                }

                def _generate():
                    # Request structured JSON matching the Pydantic schema
                    response = model.generate_content(
                        [prompt, audio_part],
                        generation_config={
                            "response_mime_type": "application/json",
                            "response_schema": PronunciationAssessmentResponse
                        }
                    )
                    return response.text

                raw_response = await run_in_threadpool(_generate)
                parsed = json.loads(raw_response)
                return parsed

            except Exception as e:
                logger.error(f"[GeminiSpeech] Error evaluating with key: {e}")
                last_err = e

        return {"error": f"Failed evaluating speech through Gemini: {last_err}"}

gemini_speech_service = GeminiSpeechService()
