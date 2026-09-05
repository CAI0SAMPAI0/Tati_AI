from django.test import TestCase, Client
from django.core.cache import cache


class SystemHealthAndMiddlewareTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        cache.clear()

    def test_healthcheck_endpoint_returns_200(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get('status'), 'ok')

    def test_rate_limit_middleware_blocks_when_exceeded(self):
        from app.middleware import RateLimitMiddleware
        from django.http import HttpResponse, HttpRequest

        middleware = RateLimitMiddleware(lambda req: HttpResponse('OK'))
        middleware.enabled = True

        req = HttpRequest()
        req.path = '/auth/login'
        req.META['REMOTE_ADDR'] = '192.168.1.50'

        # Limite de auth e 25 req/min
        for _ in range(25):
            res = middleware(req)
            self.assertEqual(res.status_code, 200)

        # 26a requisicao deve retornar 429 Too Many Requests
        blocked_res = middleware(req)
        self.assertEqual(blocked_res.status_code, 429)
