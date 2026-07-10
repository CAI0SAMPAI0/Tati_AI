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
You are an expert English speech therapist and English-as-a-Second-Language (ESL) instructor specializing in helping Brazilian Portuguese speakers.
Analyze the pronunciation of the speaker in the provided audio file.

Expected text they were trying to read: "{reference_text}"

Compare the acoustic signals of the audio against this reference text.
Assess:
1. Phonetic correctness of each word. Be strict and pay close attention to:
   - HETERONYMS: Identify words with identical spelling but different pronunciations based on syntactic context (e.g. "live" /laɪv/ vs /lɪv/, "read" /riːd/ vs /red/).
   - COMMON PORTUGUESE-SPEAKER (L1) ERRORS:
     * Epenthesis: Adding an extra vowel sound at the end of words ending in consonants (e.g. pronouncing "Facebook" as "Facebook-ee", "like" as "like-ee", "school" as "school-ee", "Jack" as "Jack-ee").
     * Vowel length and phonetic confusion: e.g. pronouncing short /ɪ/ as long /iː/ (confusing "ship" and "sheep", "live" /lɪv/ and "leave" /liːv/, "bitch" and "beach").
     * 'TH' sound substitutions: pronouncing /θ/ or /ð/ as 'f', 't', or 'd' (e.g. "think" as "tink"/"fink", "them" as "dem", "math" as "mat" or "maf").
     * Nasalization of final consonants: silent 'm' or 'n' replaced by nasalized vowels (e.g. pronouncing "from" as "frõ").
     * Aspirated 'H' vs Silent 'H' or 'R' sound confusion (e.g. pronouncing "have" as "ave" or "rave").
     * Word stress: Placing stress on the wrong syllable.
2. Rhythm, speed, pauses, and accent.
3. Specific errors per word:
   - "None" if correct.
   - "Mispronunciation" if phonetically incorrect or displays any of the L1 errors above.
   - "Omission" if skipped.
   - "Insertion" if extra words were spoken.

CRITICAL INSTRUCTIONS:
- You must be strict. Do not let mispronunciations pass as "correct" if they change the phoneme quality (such as adding "-ee" at the end of consonants, or mispronouncing vowel lengths). Mark these words as "Mispronunciation".
- The feedback must be in Portuguese, friendly, encouraging, and pedagogical, explaining exactly which phonetic rules or common pitfalls the speaker fell into (e.g. "Cuidado para não adicionar o som de 'ee' no final de 'Jack'", or explaining the difference between ship and sheep).
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
                logger.warning(f"[GeminiSpeech] Error evaluating with key: {e}")
                last_err = e

        logger.error(f"Failed evaluating speech through Gemini: {last_err}")
        return {"error": f"Failed evaluating speech through Gemini: {last_err}"}

gemini_speech_service = GeminiSpeechService()
