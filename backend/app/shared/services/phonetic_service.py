import os
import re
import logging
from typing import Dict, List, Any
import io

logger = logging.getLogger(__name__)

# Arpabet to IPA mapping for matching g2p-en with wav2vec2-espeak
ARPABET_TO_IPA = {
    'AA': 'ɑ', 'AE': 'æ', 'AH': 'ʌ', 'AO': 'ɔ', 'AW': 'aʊ', 'AY': 'aɪ',
    'EH': 'ɛ', 'ER': 'ɜ', 'EY': 'eɪ', 'IH': 'ɪ', 'IY': 'i', 'OW': 'oʊ',
    'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'u',
    'B': 'b', 'D': 'd', 'F': 'f', 'G': 'g', 'HH': 'h', 'JH': 'dʒ', 'K': 'k',
    'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ŋ', 'P': 'p', 'R': 'r', 'S': 's',
    'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'DH': 'ð', 'V': 'v', 'W': 'w', 'Y': 'j',
    'Z': 'z', 'ZH': 'ʒ'
}

class PhoneticService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(PhoneticService, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.processor = None
        self.model = None
        self.g2p_client = None
        self._initialized = True

    def _lazy_init(self):
        """Loads models lazily on first use to speed up API boot times."""
        if self.model is not None:
            return

        try:
            import torch
            from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
            from g2p_en import G2p

            logger.info("Initializing local Wav2Vec2 Phonetic model (facebook/wav2vec2-lv60-espeak-cv-ft)...")
            self.processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-lv60-espeak-cv-ft")
            self.model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-lv60-espeak-cv-ft")
            
            # Disable gradients to optimize memory/speed on CPU
            self.model.eval()
            
            self.g2p_client = G2p()
            logger.info("Local Phonetic models loaded successfully.")
        except Exception as e:
            logger.error(f"Error loading phonetic models: {e}")
            raise e

    def text_to_ipa(self, text: str) -> str:
        """Converts raw English text to espeak-like IPA phonemes."""
        self._lazy_init()
        if not self.g2p_client:
            return ""
        
        arpabet_phones = self.g2p_client(text)
        ipa_list = []
        for p in arpabet_phones:
            # Strip lexical stress numbers (e.g., EH1 -> EH, AH0 -> AH)
            clean_phone = re.sub(r'\d+', '', p)
            if clean_phone in ARPABET_TO_IPA:
                ipa_list.append(ARPABET_TO_IPA[clean_phone])
            elif clean_phone.strip() and clean_phone not in [' ', ',', '.', '!', '?']:
                ipa_list.append(clean_phone.lower())
        
        return " ".join(ipa_list)

    def audio_to_ipa(self, audio_bytes: bytes) -> str:
        """Transcribes audio directly to IPA phonemes using local Wav2Vec2 CTC."""
        self._lazy_init()
        if not self.model or not self.processor:
            return ""

        try:
            import torch
            import librosa
            import soundfile as sf

            # Read audio bytes
            audio_fp = io.BytesIO(audio_bytes)
            speech, rate = sf.read(audio_fp)
            
            # If stereo, convert to mono
            if len(speech.shape) > 1:
                speech = speech.mean(axis=1)

            # Resample to 16kHz if necessary
            if rate != 16000:
                speech = librosa.resample(speech, orig_sr=rate, target_sr=16000)

            input_values = self.processor(speech, return_tensors="pt", sampling_rate=16000).input_values

            with torch.no_grad():
                logits = self.model(input_values).logits

            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = self.processor.batch_decode(predicted_ids)[0]
            
            # Clean up double spaces or raw boundaries
            clean_ipa = re.sub(r'\s+', ' ', transcription).strip()
            return clean_ipa
        except Exception as e:
            logger.error(f"Error in local phonetic STT: {e}")
            return ""

    def evaluate_pronunciation(self, audio_bytes: bytes, reference_text: str) -> Dict[str, Any]:
        """Compares speech acoustics (phonemes) with expected text phonemes."""
        try:
            spoken_ipa = self.audio_to_ipa(audio_bytes)
            expected_ipa = self.text_to_ipa(reference_text)
            
            if not spoken_ipa or not expected_ipa:
                return {
                    "score": 0,
                    "spoken_ipa": spoken_ipa,
                    "expected_ipa": expected_ipa,
                    "feedback": "Could not extract phonemes.",
                    "match": False
                }

            # Calculate sequence similarity using Levenshtein distance on phoneme lists
            from difflib import SequenceMatcher
            spoken_list = spoken_ipa.split()
            expected_list = expected_ipa.split()

            matcher = SequenceMatcher(None, expected_list, spoken_list)
            ratio = matcher.ratio()
            score = int(ratio * 100)

            # Detect differences
            mismatches = []
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag in ['replace', 'delete']:
                    for i in range(i1, i2):
                        mismatches.append(expected_list[i])

            match = score >= 80

            return {
                "score": score,
                "spoken_ipa": spoken_ipa,
                "expected_ipa": expected_ipa,
                "mismatches": list(set(mismatches)),
                "match": match
            }
        except Exception as e:
            logger.error(f"Error evaluating pronunciation phonetically: {e}")
            return {
                "score": 0,
                "spoken_ipa": "",
                "expected_ipa": "",
                "feedback": f"Error: {str(e)}",
                "match": False
            }

phonetic_service = PhoneticService()
