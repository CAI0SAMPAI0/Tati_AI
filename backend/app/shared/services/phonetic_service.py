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
        if self.model is not None:
            return

        try:
            import nltk

            for resource in [
                "averaged_perceptron_tagger",
                "averaged_perceptron_tagger_eng",
                "cmudict",
            ]:
                try:
                    nltk.download(resource, quiet=True)
                except Exception as ne:
                    logger.warning(
                        f"Could not download NLTK resource '{resource}': {ne}"
                    )

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

        try:
            arpabet_phones = self.g2p_client(text)
        except Exception as e:
            logger.error(f"Error converting text to ARPABET via g2p_en: {e}")
            try:
                import nltk
                nltk.download("averaged_perceptron_tagger_eng", quiet=True)
                nltk.download("averaged_perceptron_tagger", quiet=True)
                arpabet_phones = self.g2p_client(text)
            except Exception as e2:
                logger.error(f"Retry g2p_en failed: {e2}")
                return ""

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
            logger.warning(
                "[PhoneticService] Audio-to-IPA unavailable: model not loaded"
            )
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

    def evaluate_per_word(
        self, audio_bytes: bytes, reference_text: str
    ) -> dict[str, Any]:
        """
        Per-word pronunciation evaluation using phoneme-level comparison.
        This is immune to ASR homophone normalization (e.g. live /lɪv/ vs /laɪv/)
        because it compares actual phonemes from the audio against expected phonemes
        from the reference text — not words transcribed by Whisper.

        Returns:
        {
            "score": int (0-100 overall),
            "words": [
                {"word": "live", "score": 85, "accuracy": "correct",
                 "expected_phonemes": "l ɪ v",
                 "spoken_phonemes": "l aɪ v",
                 "error_type": "None" or "Mispronunciation"}
            ],
            "spoken_ipa": "...",
            "expected_ipa": "..."
        }
        """
        try:
            spoken_ipa = self.audio_to_ipa(audio_bytes)
            expected_full_ipa = self.text_to_ipa(reference_text)

            ref_words = reference_text.split()

            if not spoken_ipa or not expected_full_ipa or not ref_words:
                return {
                    "score": 0,
                    "words": [
                        {
                            "word": w,
                            "score": 0,
                            "accuracy": "incorrect",
                            "expected_phonemes": "",
                            "spoken_phonemes": "",
                            "error_type": "NoAssessment",
                        }
                        for w in ref_words
                    ],
                    "spoken_ipa": spoken_ipa,
                    "expected_ipa": expected_full_ipa,
                }

            spoken_phonemes = spoken_ipa.split()
            expected_full_list = expected_full_ipa.split()

            # Per-word expected phonemes
            per_word_expected = []
            for w in ref_words:
                w_ipa = self.text_to_ipa(w)
                per_word_expected.append(w_ipa.split())

            # Count expected phonemes per word for tracking positions
            phonemes_per_word = [len(p) for p in per_word_expected]

            # Global alignment between expected and spoken phoneme sequences
            from difflib import SequenceMatcher

            matcher = SequenceMatcher(None, expected_full_list, spoken_phonemes)
            match_ratio = matcher.ratio()

            # Build mapping: which expected phoneme positions (flat) matched
            matched_positions = set()
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag == "equal":
                    for ei in range(i1, i2):
                        matched_positions.add(ei)

            # Map matched positions back to words
            word_results = []
            pos = 0
            for wi, word in enumerate(ref_words):
                n_phonemes = phonemes_per_word[wi]
                word_positions = set(range(pos, pos + n_phonemes))
                matched_in_word = len(word_positions & matched_positions)
                word_score = (
                    int((matched_in_word / n_phonemes) * 100) if n_phonemes > 0 else 0
                )

                # Get the spoken phonemes slice for this word (approximate)
                # Find which spoken positions correspond to this word's expected positions
                spoken_start = None
                spoken_end = None
                for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                    if range(i1, i2) and range(pos, pos + n_phonemes):
                        overlap_start = max(i1, pos)
                        overlap_end = min(i2, pos + n_phonemes)
                        if overlap_start < overlap_end:
                            ratio_start = (overlap_start - i1) / (i2 - i1) if i2 > i1 else 0
                            ratio_end = (overlap_end - i1) / (i2 - i1) if i2 > i1 else 1
                            word_j1 = j1 + int(ratio_start * (j2 - j1))
                            word_j2 = j1 + int(ratio_end * (j2 - j1))
                            if spoken_start is None or word_j1 < spoken_start:
                                spoken_start = word_j1
                            if spoken_end is None or word_j2 > spoken_end:
                                spoken_end = word_j2

                spoken_word_phonemes = (
                    spoken_phonemes[spoken_start:spoken_end]
                    if spoken_start is not None and spoken_end is not None
                    else []
                )

                if word_score >= 80:
                    accuracy = "correct"
                    error_type = "None"
                else:
                    accuracy = "incorrect"
                    error_type = "Mispronunciation"

                word_results.append(
                    {
                        "word": word,
                        "score": word_score,
                        "accuracy": accuracy,
                        "expected_phonemes": " ".join(per_word_expected[wi]),
                        "spoken_phonemes": " ".join(spoken_word_phonemes),
                        "error_type": error_type,
                    }
                )

                pos += n_phonemes

            overall_score = int(match_ratio * 100)

            return {
                "score": overall_score,
                "words": word_results,
                "spoken_ipa": spoken_ipa,
                "expected_ipa": expected_full_ipa,
            }
        except Exception as e:
            logger.error(f"Error in evaluate_per_word: {e}")
            ref_words = reference_text.split() if reference_text else []
            return {
                "score": 0,
                "words": [
                    {
                        "word": w,
                        "score": 0,
                        "accuracy": "incorrect",
                        "expected_phonemes": "",
                        "spoken_phonemes": "",
                        "error_type": "NoAssessment",
                    }
                    for w in ref_words
                ],
                "spoken_ipa": "",
                "expected_ipa": "",
            }

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
