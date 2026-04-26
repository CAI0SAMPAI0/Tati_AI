"""
Middleware de Rate Limiting para FastAPI.
Usa Upstash Redis para controlar limites de requisições.
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Importa o serviço mas NÃO importa a função rate_limit_check globalmente
# para evitar qualquer conflito com async
import services.upstash as upstash_mod


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware de rate limiting.
    Limita requisições por IP ou por usuário autenticado.
    """

    def __init__(self, app, default_max_requests: int = 100, default_window: int = 3600):
        super().__init__(app)
        self.default_max_requests = default_max_requests
        self.default_window = default_window

        # Regras específicas por rota
        self.routes_config = {
            '/auth/login': {'max_requests': 20, 'window': 60},  # Aumentado para 20/min em dev
            '/auth/login_form': {'max_requests': 20, 'window': 60},
            '/auth/forgot-password': {'max_requests': 10, 'window': 3600},
            '/validation/validate-document': {'max_requests': 20, 'window': 60},
            '/chat': {'max_requests': 50, 'window': 3600},
        }

    async def dispatch(self, request: Request, call_next):
        # Ignora rate limiting para rotas de health check e estáticos
        if request.url.path in ('/health', '/cors-test', '/docs', '/openapi.json', '/redoc'):
            response = await call_next(request)
            return response
        
        identifier = self._get_identifier(request)
        route_config = self._get_route_config(request.url.path)
        
        # Verifica rate limit SOMENTE se Redis está disponível e habilitado
        svc = upstash_mod.upstash_service
        if svc and svc.enabled and getattr(svc, '_redis', None) is not None:
            try:
                limit_key = svc.rate_limit_key(identifier, request.url.path)
                result = await svc.rate_limit_check(
                    limit_key,
                    max_requests=route_config['max_requests'],
                    window_seconds=route_config['window']
                )
                
                if not result.get('allowed', True):
                    reset_at = result.get('reset_at', 60)
                    return JSONResponse(
                        status_code=429,
                        content={
                            'detail': 'Rate limit exceeded',
                            'retry_after': reset_at,
                        },
                        headers={
                            'Retry-After': str(reset_at),
                            'X-RateLimit-Remaining': '0',
                            'X-RateLimit-Reset': str(reset_at),
                            'Access-Control-Allow-Origin': request.headers.get('Origin', '*'),
                            'Access-Control-Allow-Credentials': 'true',
                        }
                    )
                
                response = await call_next(request)
                response.headers['X-RateLimit-Remaining'] = str(result.get('remaining', -1))
                response.headers['X-RateLimit-Reset'] = str(result.get('reset_at', 0))
                return response
            except Exception as e:
                print(f"[RateLimiter] Erro: {e}")
                # Desabilita rate limiting permanentemente após erro
                svc._enabled = False
                svc._redis = None
        
        # Se Redis não está disponível/desabilitado, permite sem controle
        return await call_next(request)
    
    def _get_identifier(self, request: Request) -> str:
        """Obtém o identificador do usuário (IP ou username via sub do token)."""
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            from core.security import decode_token
            payload = decode_token(token)
            if payload and 'sub' in payload:
                return f"user:{payload['sub']}"
        
        # Caso contrário, usa o IP
        client_ip = request.client.host if request.client else 'unknown'
        forwarded = request.headers.get('X-Forwarded-For')
        if forwarded:
            client_ip = forwarded.split(',')[0].strip()
        
        return f"ip:{client_ip}"
    
    def _get_route_config(self, path: str) -> dict:
        """Obtém configuração de rate limit para uma rota."""
        # Verifica correspondência exata
        if path in self.routes_config:
            return self.routes_config[path]
        
        # Verifica correspondência parcial (prefixo)
        for route_path, config in self.routes_config.items():
            if path.startswith(route_path):
                return config
        
        # Retorna padrão
        return {
            'max_requests': self.default_max_requests,
            'window': self.default_window,
        }


def setup_rate_limiting(app):
    """Adiciona middleware de rate limiting ao app."""
    app.add_middleware(
        RateLimitMiddleware,
        default_max_requests=100,
        default_window=3600,
    )
