import time
import logging
from django.db import connection

logger = logging.getLogger("performance")


class PerformanceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.perf_counter()
        initial_queries = len(connection.queries)

        response = self.get_response(request)

        duration_ms = (time.perf_counter() - start_time) * 1000
        num_queries = len(connection.queries) - initial_queries

        # Loga desempenho das requisições de API no terminal
        if not request.path.startswith("/static") and not request.path.startswith(
            "/media"
        ):
            print(
                f"[PERF] {request.method} {request.path} -> {response.status_code} ({duration_ms:.1f}ms)"
            )

        return response
