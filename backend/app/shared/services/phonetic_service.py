import io
import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

# Arpabet to IPA mapping for matching g2p-en with wav2vec2-espeak
ARPABET_TO_IPA = {
    "AA": "ɑ",
    "AE": "æ",
    "AH": "ʌ",
    "AO": "ɔ",
    "AW": "aʊ",
    "AY": "aɪ",
    "EH": "ɛ",
    "ER": "ɜ",
    "EY": "eɪ",
    "IH": "ɪ",
    "IY": "i",
    "OW": "oʊ",
    "OY": "ɔɪ",
    "UH": "ʊ",
    "UW": "u",
    "B": "b",
    "D": "d",
    "F": "f",
    "G": "g",
    "HH": "h",
    "JH": "dʒ",
    "K": "k",
    "L": "l",
    "M": "m",
    "N": "n",
    "NG": "ŋ",
    "P": "p",
    "R": "r",
    "S": "s",
    "SH": "ʃ",
    "T": "t",
    "TH": "θ",
    "DH": "ð",
    "V": "v",
    "W": "w",
    "Y": "j",
    "Z": "z",
    "ZH": "ʒ",
}

# Alternative espeak-based models to try if facebook one fails
ALTERNATIVE_MODELS = [
    "facebook/wav2vec2-lv60-espeak-cv-ft",
    "bookbot/wav2vec2-lv60-espeak-cv-ft",
    "facebook/wav2vec2-base-960h",
]


class PhoneticService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super().__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.processor = None
        self.model = None
        self.used_model_name = None
        self.g2p_client = None
        self._initialized = True
        self._model_available = False

    def _lazy_init(self):
        if self.model is not None or self._model_available is False:
            return

        try:
            from g2p_en import G2p
            from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

            hf_token = os.getenv("HUGGING_FACE_KEY", "") or os.getenv("HF_TOKEN", "")

            for model_name in ALTERNATIVE_MODELS:
                try:
                    logger.info(f"Trying phonetic model: {model_name}")
                    self.processor = Wav2Vec2Processor.from_pretrained(
                        model_name, token=hf_token or None
                    )
                    self.model = Wav2Vec2ForCTC.from_pretrained(
                        model_name, token=hf_token or None
                    )
                    self.model.eval()
                    self.used_model_name = model_name
                    self._model_available = True
                    self.g2p_client = G2p()
                    logger.info(f"Phonetic model loaded: {model_name}")
                    break
                except Exception as e:
                    logger.warning(f"Model {model_name} failed: {e}")
                    self.processor = None
                    self.model = None

            if not self._model_available:
                logger.warning("No phonetic model available. Using g2p-en only.")
                self.g2p_client = G2p()
                logger.info("g2p-en loaded (phonetic model unavailable).")
        except Exception as e:
            logger.error(f"Error loading phonetic dependencies: {e}")
            self._model_available = False

    def text_to_ipa(self, text: str) -> str:
        self._lazy_init()
        if not self.g2p_client:
            return ""

        arpabet_phones = self.g2p_client(text)
        ipa_list = []
        for p in arpabet_phones:
            clean_phone = re.sub(r"\d+", "", p)
            if clean_phone in ARPABET_TO_IPA:
                ipa_list.append(ARPABET_TO_IPA[clean_phone])
            elif clean_phone.strip() and clean_phone not in [" ", ",", ".", "!", "?"]:
                ipa_list.append(clean_phone.lower())

        return " ".join(ipa_list)

    def audio_to_ipa(self, audio_bytes: bytes) -> str:
        self._lazy_init()
        if not self._model_available or not self.model or not self.processor:
            logger.warning("[PhoneticService] Audio-to-IPA unavailable: model not loaded")
            return ""

        try:
            import librosa
            import soundfile as sf
            import torch

            audio_fp = io.BytesIO(audio_bytes)
            speech, rate = sf.read(audio_fp)

            if len(speech.shape) > 1:
                speech = speech.mean(axis=1)

            if rate != 16000:
                speech = librosa.resample(speech, orig_sr=rate, target_sr=16000)

            input_values = self.processor(
                speech, return_tensors="pt", sampling_rate=16000
            ).input_values

            with torch.no_grad():
                logits = self.model(input_values).logits

            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = self.processor.batch_decode(predicted_ids)[0]

            clean_ipa = re.sub(r"\s+", " ", transcription).strip()
            return clean_ipa
        except Exception as e:
            logger.error(f"Error in local phonetic STT: {e}")
            return ""

    def evaluate_pronunciation(
        self, audio_bytes: bytes, reference_text: str
    ) -> dict[str, Any]:
        try:
            spoken_ipa = self.audio_to_ipa(audio_bytes)
            expected_ipa = self.text_to_ipa(reference_text)

            if not spoken_ipa or not expected_ipa:
                return {
                    "score": 0,
                    "spoken_ipa": spoken_ipa,
                    "expected_ipa": expected_ipa,
                    "feedback": "Could not extract phonemes.",
                    "match": False,
                }

            from difflib import SequenceMatcher

            spoken_list = spoken_ipa.split()
            expected_list = expected_ipa.split()

            matcher = SequenceMatcher(None, expected_list, spoken_list)
            ratio = matcher.ratio()
            score = int(ratio * 100)

            mismatches = []
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag in ["replace", "delete"]:
                    for i in range(i1, i2):
                        mismatches.append(expected_list[i])

            match = score >= 80

            return {
                "score": score,
                "spoken_ipa": spoken_ipa,
                "expected_ipa": expected_ipa,
                "mismatches": list(set(mismatches)),
                "match": match,
                "model": self.used_model_name,
            }
        except Exception as e:
            logger.error(f"Error evaluating pronunciation phonetically: {e}")
            return {
                "score": 0,
                "spoken_ipa": "",
                "expected_ipa": "",
                "feedback": f"Error: {e!s}",
                "match": False,
            }


phonetic_service = PhoneticService()
