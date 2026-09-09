"""
Tati AI - Teste de Break Point Automatizado com Locust.
Executa rampa em degraus progressivos:
- Inicia em 10 usuários
- A cada 30s sobe mais 20 usuários (10 -> 30 -> 50 -> 70 -> 90...)
- Duração máxima: 10 minutos

Como executar:
locust -f locust_breakpoint.py --host https://caio007-tati-ai-backend.hf.space
"""
from locust import LoadTestShape
from locustfile import StudentUser, on_test_stop


class BreakPointStepShape(LoadTestShape):
    step_time = 30   # segundos por degrau
    step_load = 20   # usuários adicionados por degrau
    spawn_rate = 5   # taxa de spawn por segundo
    time_limit = 600 # 10 minutos máximo

    def tick(self):
        run_time = self.get_run_time()
        if run_time > self.time_limit:
            return None

        current_step = run_time // self.step_time
        user_count = int(10 + current_step * self.step_load)
        return (user_count, self.spawn_rate)
