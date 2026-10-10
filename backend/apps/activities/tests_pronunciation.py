import base64
from unittest import IsolatedAsyncioTestCase as TestCase
from unittest.mock import AsyncMock, patch
from apps.activities.services import SpeechService
from apps.activities.schemas import PronunciationVerifyOut


class SpeechPronunciationTestCase(TestCase):
    async def test_gemini_multimodal_pronunciation_evaluation(self):
        fake_audio_bytes = b"\x1a\x45\xdf\xa3fake_webm_audio_data"
        fake_b64 = base64.b64encode(fake_audio_bytes).decode("utf-8")
        target_phrase = "I think this is great"

        mock_gemini_response = {
            "score": 88.5,
            "transcription": "I think this is great",
            "words": [
                {"word": "I", "score": 100.0, "accuracy": "correct", "tip": None},
                {"word": "think", "score": 82.0, "accuracy": "needs_work", "tip": "Língua entre os dentes"},
                {"word": "this", "score": 90.0, "accuracy": "correct", "tip": None},
                {"word": "is", "score": 100.0, "accuracy": "correct", "tip": None},
                {"word": "great", "score": 95.0, "accuracy": "correct", "tip": None},
            ],
            "feedback": "Great job! Keep practicing the TH sound in 'think'.",
            "pedagogical_tip": "Muito bom! No 'think', posicione a ponta da língua entre os dentes para soprar o som de TH sem chiar como 's'.",
        }

        with patch.object(
            SpeechService,
            "_evaluate_with_gemini_async",
            new_callable=AsyncMock,
            return_value=mock_gemini_response,
        ):
            with patch("apps.chat.audio_service.AudioService.text_to_speech_async", new_callable=AsyncMock, return_value="fake_tts_b64"):
                result: PronunciationVerifyOut = await SpeechService.verify_pronunciation_async(
                    reference_text=target_phrase,
                    audio_b64=fake_b64,
                    threshold=70.0,
                )

                self.assertEqual(result.score, 88.5)
                self.assertTrue(result.is_correct)
                self.assertEqual(len(result.words), 5)
                self.assertEqual(result.words[1].word, "think")
                self.assertEqual(result.words[1].tip, "Língua entre os dentes")
                self.assertEqual(result.words[1].accuracy, "needs_work")
                self.assertIn("Muito bom! No 'think'", result.pedagogical_tip)
                self.assertEqual(result.metadata.get("evaluator"), "gemini-multimodal")

    async def test_fallback_when_gemini_fails(self):
        fake_audio_bytes = b"fake_raw_audio"
        fake_b64 = base64.b64encode(fake_audio_bytes).decode("utf-8")
        target_phrase = "Hello world"

        with patch.object(
            SpeechService,
            "_evaluate_with_gemini_async",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with patch("apps.chat.audio_service.AudioService.transcribe_audio_async", new_callable=AsyncMock, return_value="Hello world"):
                with patch("apps.chat.audio_service.AudioService.text_to_speech_async", new_callable=AsyncMock, return_value=""):
                    result: PronunciationVerifyOut = await SpeechService.verify_pronunciation_async(
                        reference_text=target_phrase,
                        audio_b64=fake_b64,
                        threshold=70.0,
                    )

                    self.assertEqual(result.score, 100.0)
                    self.assertTrue(result.is_correct)
                    self.assertEqual(result.transcription, "Hello world")

    async def test_free_speech_with_gemini_multimodal_flags_incoherence_and_portuguese(self):
        fake_audio_bytes = b"\x1a\x45\xdf\xa3fake_spoken_audio"
        fake_b64 = base64.b64encode(fake_audio_bytes).decode("utf-8")

        mock_gemini_free_response = {
            "score": 30.0,
            "transcription": "Hi I am verb 7 Tudo",
            "suggested_sentence": "Hi, I'm doing well, and everything is great!",
            "words": [
                {"word": "Hi", "score": 95.0, "accuracy": "correct", "tip": None},
                {"word": "I", "score": 90.0, "accuracy": "correct", "tip": None},
                {"word": "am", "score": 85.0, "accuracy": "correct", "tip": None},
                {"word": "verb", "score": 30.0, "accuracy": "incorrect", "tip": "Estrutura desconexa."},
                {"word": "7", "score": 20.0, "accuracy": "incorrect", "tip": "Número solto sem sentido na frase."},
                {"word": "Tudo", "score": 10.0, "accuracy": "incorrect", "tip": "Palavra em português! Em inglês diga 'everything'."},
            ],
            "feedback": "Cuidado com a concordância e a mistura de idiomas! A frase ficou confusa e usou a palavra 'Tudo' em português.",
            "pedagogical_tip": "Em inglês, evite misturar termos em português como 'Tudo'. Para cumprimentar e dizer que está tudo bem, você pode dizer: 'Hi, I'm doing well, and everything is great!'",
        }

        with patch.object(
            SpeechService,
            "_evaluate_with_gemini_async",
            new_callable=AsyncMock,
            return_value=mock_gemini_free_response,
        ) as mock_gemini:
            with patch("apps.chat.audio_service.AudioService.text_to_speech_async", new_callable=AsyncMock, return_value="fake_tts_suggestion"):
                result: PronunciationVerifyOut = await SpeechService.verify_pronunciation_async(
                    reference_text=None,
                    audio_b64=fake_b64,
                    threshold=70.0,
                )

                # Ensure Gemini was called even though reference_text is None
                mock_gemini.assert_called_once()
                self.assertEqual(result.score, 30.0)
                self.assertFalse(result.is_correct)
                self.assertEqual(result.suggested_sentence, "Hi, I'm doing well, and everything is great!")
                self.assertEqual(result.words[-1].word, "Tudo")
                self.assertEqual(result.words[-1].accuracy, "incorrect")
                self.assertIn("português", result.words[-1].tip)
                self.assertIn("Hi, I'm doing well", result.pedagogical_tip)
                self.assertTrue(result.metadata.get("free_speech"))

    async def test_fallback_free_speech_with_portuguese_never_awards_100(self):
        fake_audio_bytes = b"fake_raw_audio"
        fake_b64 = base64.b64encode(fake_audio_bytes).decode("utf-8")

        with patch.object(
            SpeechService,
            "_evaluate_with_gemini_async",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with patch("apps.chat.audio_service.AudioService.transcribe_audio_async", new_callable=AsyncMock, return_value="Hi I am verb 7 Tudo"):
                with patch("apps.chat.audio_service.AudioService.text_to_speech_async", new_callable=AsyncMock, return_value=""):
                    result: PronunciationVerifyOut = await SpeechService.verify_pronunciation_async(
                        reference_text="",
                        audio_b64=fake_b64,
                        threshold=70.0,
                    )

                    # Must NOT award 100% when there is no target phrase and words are in Portuguese!
                    self.assertLessEqual(result.score, 30.0)
                    self.assertFalse(result.is_correct)
                    self.assertIn("português", result.feedback)

    async def test_proportional_scoring_safeguard_for_isolated_mistake(self):
        fake_audio_bytes = b"\x1a\x45\xdf\xa3fake_spoken_audio"
        fake_b64 = base64.b64encode(fake_audio_bytes).decode("utf-8")

        # 14 words with 90-95% and 1 word with 25% (total 15 words)
        words_data = [
            {"word": "Hi", "score": 95.0, "accuracy": "correct", "tip": None},
            {"word": "how", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "are", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "you", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "My", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "name", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "is", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "Caio", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "I", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "am", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "90", "score": 25.0, "accuracy": "incorrect", "tip": "Cuidado com o número! Use nineteen (19)."},
            {"word": "years", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "old", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "And", "score": 90.0, "accuracy": "correct", "tip": None},
            {"word": "you", "score": 90.0, "accuracy": "correct", "tip": None},
        ]

        mock_gemini_harsh_response = {
            "score": 35.0,  # Harsh LLM score that must be calibrated by the safeguard
            "transcription": "Hi how are you My name is Caio I am 90 years old And you",
            "suggested_sentence": "Hi, how are you? My name is Caio. I am nineteen years old. And you?",
            "words": words_data,
            "feedback": "Sua fala foi muito boa, mas atenção com o número 90 ao invés de 19.",
            "pedagogical_tip": "Lembre-se de pronunciar nineteen com ênfase no teen.",
        }

        with patch.object(
            SpeechService,
            "_evaluate_with_gemini_async",
            new_callable=AsyncMock,
            return_value=mock_gemini_harsh_response,
        ):
            with patch("apps.chat.audio_service.AudioService.text_to_speech_async", new_callable=AsyncMock, return_value="fake_tts"):
                result: PronunciationVerifyOut = await SpeechService.verify_pronunciation_async(
                    reference_text=None,
                    audio_b64=fake_b64,
                    threshold=70.0,
                    accent="en-US",
                )

                # The average of words is ~85.7%. With 88% proportional safety, score must be >= 75.0, NOT 35.0!
                self.assertGreaterEqual(result.score, 75.0)
                self.assertTrue(result.is_correct)
                self.assertEqual(len(result.words), 15)


