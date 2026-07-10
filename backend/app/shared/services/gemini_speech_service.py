import logging
import json
import re
from typing import Dict, Any
from app.core.config import settings
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

class GeminiSpeechService:
    @property
    def is_configured(self) -> bool:
        return len(settings.gemini_keys) > 0

    async def evaluate_pronunciation(self, audio_bytes: bytes, reference_text: str) -> Dict[str, Any]:
        """
        Evaluates pronunciation using Gemini 2.0 Flash Multimodal capabilities.
        Processes audio bytes directly to detect accent, intonation, phonetic deviations,
        and contextual words (like live /laɪv/ vs /lɪv/).
        """
        if not self.is_configured:
            return {"error": "Gemini Speech Service is not configured."}

        import google.generativeai as genai

        keys = settings.gemini_keys
        last_err = None

        # prompt specifying output structure and evaluation details
        prompt = f"""
Analyze the pronunciation of the speaker in the provided audio file.
The expected text is: "{reference_text}"

Compare the acoustics/phonetics of the spoken audio against this expected text.
Make sure to pay attention to:
1. Correct phonetic pronunciation (e.g. distinguishing between words like "live" as /laɪv/ vs /lɪv/ depending on sentence context).
2. Accent, intonation, speech pace, and rhythm.
3. Specific phonetic deviations or errors.

You MUST respond ONLY with a raw JSON object containing the evaluation scores and a word-by-word analysis. Do not include markdown code block formatting (such as ```json) or any conversational text.

JSON format:
{{
  "score": <overall_score_0_to_100>,
  "accuracy_score": <accuracy_score_0_to_100>,
  "fluency_score": <fluency_score_0_to_100>,
  "completeness_score": <completeness_score_0_to_100>,
  "words": [
    {{
      "word": "<expected_word_1>",
      "score": <word_score_0_to_100>,
      "accuracy": "correct" or "incorrect",
      "error_type": "None" or "Mispronunciation" or "Omission" or "Insertion"
    }},
    ...
  ],
  "feedback": "<detailed_feedback_explaining_errors_and_intonation_in_portuguese>"
}}
"""

        for key in keys:
            try:
                genai.configure(api_key=key)
                # Use gemini-2.0-flash which supports audio input
                model = genai.GenerativeModel('gemini-2.0-flash')

                # We send the audio data as raw bytes with appropriate mime_type.
                # Assuming audio is webm or wav.
                audio_part = {
                    "mime_type": "audio/webm",
                    "data": audio_bytes
                }

                def _generate():
                    response = model.generate_content([prompt, audio_part])
                    return response.text

                raw_response = await run_in_threadpool(_generate)
                cleaned = raw_response.strip()
                # Remove markdown json wrapper if present
                if cleaned.startswith("```"):
                    cleaned = re.sub(r"^```(?:json)?\n", "", cleaned)
                    cleaned = re.sub(r"\n```$", "", cleaned)
                    cleaned = cleaned.strip()

                parsed = json.loads(cleaned)
                return parsed

            except Exception as e:
                logger.error(f"[GeminiSpeech] Error evaluating with key: {e}")
                last_err = e

        return {"error": f"Failed evaluating speech through Gemini: {last_err}"}

gemini_speech_service = GeminiSpeechService()
