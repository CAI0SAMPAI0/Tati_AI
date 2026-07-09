import io
import json
import tempfile
import logging
import os
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

class AzureSpeechService:
    def __init__(self):
        self.speech_key = settings.azure_speech_key
        self.speech_region = settings.azure_speech_region

    @property
    def is_configured(self) -> bool:
        return bool(self.speech_key and self.speech_region)

    def evaluate_pronunciation(self, audio_bytes: bytes, reference_text: str) -> Dict[str, Any]:
        """
        Evaluates the pronunciation of the audio bytes against reference_text using Azure Pronunciation Assessment.
        """
        if not self.is_configured:
            return {"error": "Azure Speech Service is not configured."}

        try:
            import azure.cognitiveservices.speech as speechsdk
            import soundfile as sf
            import librosa

            temp_audio_path = None
            # 1. Convert input audio bytes to standard 16kHz mono WAV for Azure Speech SDK
            audio_fp = io.BytesIO(audio_bytes)
            speech, rate = sf.read(audio_fp)
            if len(speech.shape) > 1:
                speech = speech.mean(axis=1)
            if rate != 16000:
                speech = librosa.resample(speech, orig_sr=rate, target_sr=16000)

            # Write converted audio to a temp WAV file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                sf.write(f.name, speech, 16000)
                temp_audio_path = f.name

            # 2. Configure Azure Speech SDK
            speech_config = speechsdk.SpeechConfig(subscription=self.speech_key, region=self.speech_region)
            audio_config = speechsdk.audio.AudioConfig(filename=temp_audio_path)

            pron_config = speechsdk.PronunciationAssessmentConfig(
                reference_text=reference_text,
                grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
                granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
                enable_miscue=True
            )

            # 3. Create Speech Recognizer
            recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
            pron_config.apply_to(recognizer)

            # 4. Perform Recognition
            result = recognizer.recognize_once()

            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                pron_result = speechsdk.PronunciationAssessmentResult(result)
                json_res_str = result.properties.get(speechsdk.PropertyId.SpeechServiceResponse_JsonResult)
                json_data = json.loads(json_res_str) if json_res_str else {}

                # Map words and errors
                words_list = []
                best_match = json_data.get('NBest', [{}])[0]
                words_data = best_match.get('Words', [])

                for w in words_data:
                    error_type = w.get('PronunciationAssessment', {}).get('ErrorType', 'None')
                    words_list.append({
                        "word": w.get('Word', ''),
                        "score": w.get('PronunciationAssessment', {}).get('AccuracyScore', 0),
                        "accuracy": "correct" if error_type == "None" else "incorrect",
                        "error_type": error_type
                    })

                return {
                    "score": int(pron_result.pronunciation_score),
                    "accuracy_score": int(pron_result.accuracy_score),
                    "fluency_score": int(pron_result.fluency_score),
                    "completeness_score": int(pron_result.completeness_score),
                    "words": words_list,
                    "raw_json": json_data
                }
            else:
                return {"error": f"Recognition failed: {result.reason}"}

        except Exception as e:
            logger.error(f"Error in Azure Speech pronunciation assessment: {e}")
            return {"error": str(e)}
        finally:
            if temp_audio_path and os.path.exists(temp_audio_path):
                try:
                    os.unlink(temp_audio_path)
                except Exception:
                    pass

azure_speech_service = AzureSpeechService()
