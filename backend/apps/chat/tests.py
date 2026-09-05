from unittest.mock import patch
from django.test import TestCase
from django.core.cache import cache
from apps.authentication.models import User, UserRole, CEFRLevel
from apps.chat.leveling_service import LevelingService


class LevelingXPTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            username='test_xp_student',
            email='test_xp@tati.ai',
            role=UserRole.STUDENT,
            level=CEFRLevel.A1,
            xp_data={'xp': 0, 'history': []},
        )
        cache.clear()

    def test_daily_leveling_xp_awarded_only_once_per_day(self):
        # Primeira execucao no dia: deve conceder 25 XP
        awarded_first = LevelingService._award_daily_leveling_xp(self.user)
        self.assertTrue(awarded_first)

        self.user.refresh_from_db()
        self.assertEqual(self.user.xp_data.get('xp'), 25)

        # Segunda execucao no mesmo dia: NAO deve conceder XP duplicado
        awarded_second = LevelingService._award_daily_leveling_xp(self.user)
        self.assertFalse(awarded_second)

        self.user.refresh_from_db()
        self.assertEqual(self.user.xp_data.get('xp'), 25)

    @patch('apps.chat.audio_service.AudioService.text_to_speech', return_value='')
    def test_start_assessment_message_is_concise(self, mock_tts):
        res = LevelingService.start_leveling_session(self.user, total_questions=8)
        self.assertIn('reply', res)
        self.assertIn('total_questions', res)
        self.assertEqual(res['total_questions'], 8)

        text = res['reply']
        self.assertNotIn('Programador Tati !', text)
        self.assertNotIn('Welcome to your  C E F R', text)
        self.assertIn('CEFR English Leveling Challenge', text)

    @patch('apps.chat.audio_service.AudioService.text_to_speech', return_value='base64mock')
    def test_accent_is_preserved_and_used_in_tts(self, mock_tts):
        # Inicia com sotaque britanico
        res = LevelingService.start_leveling_session(self.user, total_questions=8, accent='en-GB')
        self.assertEqual(res.get('accent'), 'en-GB')
        mock_tts.assert_called_with(mock_tts.call_args[0][0], accent='en-GB')

        conv_id = res['conversation_id']
        # Responde pergunta com accent preservado
        step_res = LevelingService.process_leveling_step(self.user, conv_id, "I went to the beach with friends", accent='en-GB')
        self.assertEqual(step_res.get('accent'), 'en-GB')
        self.assertIn('reply', step_res)

    def test_evaluate_answer_feedback_references_words_no_emojis(self):
        eval_res = LevelingService._evaluate_answer(
            user_name="Student",
            question="What did you do last weekend?",
            question_level="A2",
            target="Past simple tense",
            student_answer="About the loud party yesterday",
        )
        feedback = eval_res.get("pedagogical_feedback", "")
        self.assertTrue(len(feedback) > 0)
        # Deve ter no maximo 2 linhas
        self.assertLessEqual(len(feedback.strip().split('\n')), 2)
        # Nao deve conter emojis
        from apps.chat.audio_service import EMOJI_REGEX
        self.assertFalse(bool(EMOJI_REGEX.search(feedback)))
        # Nao deve ser o fallback generico antigo
        self.assertNotEqual(feedback, "Well done! Thank you for sharing your answer with me.")

