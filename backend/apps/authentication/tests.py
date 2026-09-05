from django.test import TestCase
from apps.authentication.models import User, UserRole, CEFRLevel
from apps.authentication.security import hash_password, verify_password, create_access_token, decode_token


class AuthenticationSecurityTestCase(TestCase):
    def test_password_hashing_and_verification(self):
        pwd = 'SecurePassword123!'
        hashed = hash_password(pwd)
        self.assertNotEqual(pwd, hashed)
        self.assertTrue(verify_password(pwd, hashed))
        self.assertFalse(verify_password('WrongPassword', hashed))

    def test_jwt_token_encoding_and_decoding(self):
        username = 'test_student_2026'
        token = create_access_token(data={'sub': username, 'role': 'student'})
        self.assertIsInstance(token, str)
        self.assertTrue(len(token) > 20)

        payload = decode_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload.get('sub'), username)
        self.assertEqual(payload.get('role'), 'student')

    def test_user_creation_and_defaults(self):
        user = User.objects.create(
            username='caiotests',
            email='caiotests@tati.ai',
            password=hash_password('TestPass123'),
            role=UserRole.STUDENT,
            level=CEFRLevel.B1,
        )
        self.assertEqual(user.username, 'caiotests')
        self.assertEqual(user.level, 'B1')
        self.assertEqual(user.role, 'student')
