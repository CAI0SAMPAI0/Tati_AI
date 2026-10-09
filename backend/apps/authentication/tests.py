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

    def test_forgot_password_does_not_leak_reset_token(self):
        from apps.authentication.services import AuthService
        user = User.objects.create(
            username='forgot_user',
            email='forgot@example.com',
            password=hash_password('Password123!'),
        )
        res = AuthService.process_forgot_password('forgot@example.com')
        self.assertTrue(res.get('ok'))
        self.assertNotIn('reset_token', res)

    def test_oauth_origin_validation(self):
        from apps.authentication.api import _is_allowed_frontend_origin
        self.assertTrue(_is_allowed_frontend_origin('https://tati-ai.vercel.app'))
        self.assertTrue(_is_allowed_frontend_origin('https://tati-hub.vercel.app'))
        self.assertTrue(_is_allowed_frontend_origin('http://localhost:3000'))
        self.assertFalse(_is_allowed_frontend_origin('https://evil-attacker.com'))
        self.assertFalse(_is_allowed_frontend_origin('http://attacker.com/evil'))
        self.assertFalse(_is_allowed_frontend_origin('javascript:alert(1)'))

    def test_ssrf_image_proxy_validation(self):
        from apps.activities.api import _is_safe_activity_image_url
        self.assertTrue(_is_safe_activity_image_url('https://test-english.com/images/exercise1.webp'))
        self.assertTrue(_is_safe_activity_image_url('https://files.liveworksheets.com/worksheets/sample.jpg'))
        # Malicious / internal IP targets
        self.assertFalse(_is_safe_activity_image_url('http://169.254.169.254/latest/meta-data/'))
        self.assertFalse(_is_safe_activity_image_url('http://127.0.0.1:8000/admin'))
        self.assertFalse(_is_safe_activity_image_url('http://10.0.0.1/secret'))
        self.assertFalse(_is_safe_activity_image_url('http://attacker.com/exploit.jpg'))
        self.assertFalse(_is_safe_activity_image_url('file:///etc/passwd'))

    def test_mercado_pago_price_tampering_and_subscription_policy(self):
        import os
        from ninja.errors import HttpError
        from apps.payments.services import MercadoPagoService, are_subscriptions_active
        from apps.activities.models import PremiumContent

        student = User.objects.create(username='student1', email='student1@test.com', role=UserRole.STUDENT)
        buyer = User.objects.create(username='buyer1', email='buyer1@test.com', role=UserRole.BUYER)

        # 1. Materiais avulsos salvos no dashboard pela Tatiana (com preço para aluno e visitante)
        material = PremiumContent.objects.create(
            id='mat_gramatica_1',
            title='Material Gramática',
            price=29.90,
            price_students=10.00,
            price_buyers=25.00,
        )

        # Preço para aluno: R$ 10.00 (mesmo que envie 0.01)
        student_price = MercadoPagoService.resolve_server_price(student, 'hub', str(material.id), requested_amount=0.01)
        self.assertEqual(student_price, 10.00)

        # Preço para comprador externo: R$ 25.00 (mesmo que envie 0.01)
        buyer_price = MercadoPagoService.resolve_server_price(buyer, 'hub', str(material.id), requested_amount=0.01)
        self.assertEqual(buyer_price, 25.00)

        # 2. Mensalidades bloqueadas antes de março de 2027
        with self.assertRaises(HttpError):
            MercadoPagoService.resolve_server_price(student, 'subscription', 'monthly', requested_amount=49.90)

        # 3. Se explicitamente ativada no ambiente, plano mensal aplica preço fixo do servidor (49.90)
        os.environ['SUBSCRIPTION_BILLING_ENABLED'] = 'true'
        try:
            active_price = MercadoPagoService.resolve_server_price(student, 'subscription', 'monthly', requested_amount=0.01)
            self.assertEqual(active_price, 49.90)
        finally:
            os.environ.pop('SUBSCRIPTION_BILLING_ENABLED', None)

    def test_reserved_username_registration_rejected(self):
        from apps.authentication.services import AuthService
        from apps.authentication.schemas import RegisterInput
        from ninja.errors import HttpError
        data = RegisterInput(username='admin', email='newadmin@test.com', name='Admin', password='Password123!', level='B1')
        with self.assertRaises(HttpError):
            AuthService.register_student(data)

    def test_superuser_not_granted_by_username_alone(self):
        user = User.objects.create(username='caio', email='caio@test.com', role=UserRole.STUDENT)
        self.assertFalse(user.is_superuser)

    def test_chat_idor_access_blocked(self):
        from apps.chat.services import ConversationService
        from apps.chat.models import Conversation
        from ninja.errors import HttpError
        victim = User.objects.create(username='victim_user', email='victim@test.com')
        attacker = User.objects.create(username='attacker_user', email='attacker@test.com')
        conv = Conversation.objects.create(id='conv_victim_1', username='victim_user', title='Victim Chat')
        # Attacker tries to read victim's conversation messages
        with self.assertRaises(HttpError):
            ConversationService.get_messages(attacker, 'conv_victim_1')

    def test_hub_page_token_isolation_and_idor_protection(self):
        from apps.authentication.security import create_hub_page_token, AuthBearer
        from apps.activities.api import get_hub_page
        from django.test import RequestFactory
        from app.urls import protected_media_serve

        # 1. Criação do token restrito
        content_a = "6588b80b-7e8f-4638-a0f4-39fdb2670532"
        content_b = "11111111-2222-3333-4444-555555555555"

        page_token_a = create_hub_page_token(
            username="programador",
            content_id=content_a,
            email="programador@tati.ai",
        )
        decoded = decode_token(page_token_a)
        self.assertEqual(decoded.get("token_type"), "hub_page_view")
        self.assertEqual(decoded.get("cid"), content_a)
        self.assertEqual(decoded.get("scope"), f"hub_read:{content_a}")

        # 2. Token de página NUNCA pode autenticar chamadas gerais da API
        rf = RequestFactory()
        req_api = rf.get("/api/users/me", HTTP_AUTHORIZATION=f"Bearer {page_token_a}")
        auth_bearer = AuthBearer()
        authenticated_user = auth_bearer.authenticate(req_api, page_token_a)
        self.assertIsNone(authenticated_user)

        # 3. Tentativa de IDOR no visualizador do Hub:
        # Usar o token gerado para content_a em content_b DEVE retornar 403 imediatamente
        req_page_tampered = rf.get(f"/activities/hub/{content_b}/pages/1?token={page_token_a}")
        response_tampered = get_hub_page(req_page_tampered, content_id=content_b, page_index=1, token=page_token_a)
        self.assertEqual(response_tampered.status_code, 403)
        self.assertIn("este token não é válido", response_tampered.content.decode("utf-8"))

        # 4. Acesso direto a /media/hub_pages/... deve ser bloqueado com 403
        req_direct_media = rf.get(f"/media/hub_pages/{content_a}/page_1.webp")
        response_direct = protected_media_serve(req_direct_media, f"hub_pages/{content_a}/page_1.webp")
        self.assertEqual(response_direct.status_code, 403)
        self.assertIn("Acesso direto bloqueado", response_direct.content.decode("utf-8"))

