"""
Tati AI - Testes de Carga, Latência, Bottlenecks e Break Point com Locust.
Simula o comportamento real de alunos acessando o sistema.

Como executar:
1. Interface Web Interativa (Recomendado):
   locust -f locustfile.py --host http://localhost:8000
   Depois acesse: http://localhost:8089

2. Teste Automatizado de Break Point (Degraus contínuos de carga):
   locust -f locustfile.py --headless --host http://localhost:8000 --tags student

3. Testando diretamente o ambiente de Staging / Produção:
   locust -f locustfile.py --host https://caio007-tati-ai-backend.hf.space
"""

import os
import time
import uuid
import logging
from locust import HttpUser, task, between, tag, events, LoadTestShape

logger = logging.getLogger("locust.tati")

# Limite de latência aceitável para alerta de gargalo (SLA interno)
LATENCY_SLA_MS = int(os.getenv("LOCUST_SLA_MS", "1500"))


class StudentUser(HttpUser):
    """
    Simula o perfil de navegação típico de um aluno da Tati AI:
    - Entra no sistema (Login ou Registro de teste)
    - Consulta Dashboard, Streaks, XP e Permissões
    - Estuda Flashcards e Vocabulário SRS
    - Navega em Recomendações e Gramática
    - Acessa e interage com o Chat de conversação
    """

    # Aluno real espera entre 1s e 3s entre uma ação e outra
    wait_time = between(1.0, 3.0)

    def on_start(self):
        """Inicializa a sessão do aluno autenticado."""
        self.token = None
        self.conversation_ids = []
        self._authenticate()

    def _authenticate(self):
        """Autentica com usuário existente ou cria um aluno sintético para o teste."""
        username = os.getenv("LOCUST_USER")
        password = os.getenv("LOCUST_PASSWORD")

        if username and password:
            res = self.client.post(
                "/auth/login",
                json={"username": username, "password": password},
                name="[Auth] Login (Env User)",
            )
            if res.status_code == 200:
                data = res.json()
                self.token = data.get("access_token")
            else:
                logger.error(f"Falha no login do usuário {username}: {res.status_code} {res.text}")

        # Se não houver credenciais definidas ou falhar, registra um usuário novo único para o teste de carga
        if not self.token:
            unique_id = uuid.uuid4().hex[:8]
            user_payload = {
                "name": f"Student {unique_id}",
                "username": f"student_{unique_id}",
                "email": f"student_{unique_id}@loadtest.local",
                "password": "LoadTestPassword123!",
                "level": "B1",
            }
            res = self.client.post(
                "/auth/register",
                json=user_payload,
                name="[Auth] Register New Student",
            )
            if res.status_code in (200, 201):
                # Efetua login para obter o access_token
                login_res = self.client.post(
                    "/auth/login",
                    json={"username": user_payload["username"], "password": user_payload["password"]},
                    name="[Auth] Login Auto-Registered",
                )
                if login_res.status_code == 200:
                    self.token = login_res.json().get("access_token")
            else:
                logger.warning(f"Não foi possível auto-registrar aluno de teste: {res.status_code}")

        if self.token:
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    # ── 1. DASHBOARD & GAMIFICAÇÃO (Maior frequência de requisições do aluno) ──
    @tag("student", "dashboard", "fast")
    @task(15)
    def view_dashboard_and_profile(self):
        """Carregamento da tela inicial/dashboard e dados do perfil."""
        if not self.token:
            return

        with self.client.get("/profile", name="[Dashboard] Get Profile", catch_response=True) as res:
            self._check_latency(res)

        with self.client.get(
            "/users/permissions/access", name="[Dashboard] Access Permissions", catch_response=True
        ) as res:
            self._check_latency(res)

        with self.client.get("/users/streak", name="[Gamification] Streak", catch_response=True) as res:
            self._check_latency(res)

        with self.client.get("/users/xp", name="[Gamification] XP", catch_response=True) as res:
            self._check_latency(res)

        with self.client.get("/users/progress", name="[Progress] Overall Progress", catch_response=True) as res:
            self._check_latency(res)

        with self.client.get("/users/weekly-plan", name="[Progress] Weekly Plan", catch_response=True) as res:
            self._check_latency(res)

    # ── 2. VOCABULÁRIO & FLASHCARDS (Leituras de banco e SRS) ───────────────
    @tag("student", "activities", "vocab")
    @task(10)
    def study_vocabulary_and_flashcards(self):
        """Consulta palavras pendentes de revisão (SRS) e decks de flashcards."""
        if not self.token:
            return

        with self.client.get(
            "/users/vocabulary/due", name="[Vocab] Due Words (SRS)", catch_response=True
        ) as res:
            self._check_latency(res)

        with self.client.get(
            "/activities/flashcards/my", name="[Flashcards] My Decks", catch_response=True
        ) as res:
            self._check_latency(res)

        with self.client.get(
            "/activities/ranking", name="[Activities] Ranking Geral", catch_response=True
        ) as res:
            self._check_latency(res)

    # ── 3. RECOMENDAÇÕES & CONTEÚDO (Módulos e Gramática) ───────────────────
    @tag("student", "activities", "content")
    @task(8)
    def browse_recommendations_and_grammar(self):
        """Consulta podcasts recomendados e módulos de gramática."""
        if not self.token:
            return

        with self.client.get(
            "/activities/podcasts/recommendations",
            name="[Activities] Podcast Recommendations",
            catch_response=True,
        ) as res:
            self._check_latency(res)

        with self.client.get("/grammar", name="[Grammar] Catalog", catch_response=True) as res:
            self._check_latency(res)

    # ── 4. CHAT (Leitura de Conversas e Histórico) ──────────────────────────
    @tag("student", "chat")
    @task(6)
    def view_chat_conversations(self):
        """Lista as conversas e consulta as mensagens da conversa atual."""
        if not self.token:
            return

        with self.client.get(
            "/chat/conversations", name="[Chat] List Conversations", catch_response=True
        ) as res:
            self._check_latency(res)
            if res.status_code == 200:
                convs = res.json()
                if isinstance(convs, list) and len(convs) > 0:
                    conv_id = convs[0].get("id")
                    if conv_id:
                        self.client.get(
                            f"/chat/conversations/{conv_id}/messages",
                            name="[Chat] Get Messages",
                        )

    # ── 5. OPERAÇÕES DE ESCRITA / CARGA PESADA (Teste de Bottlenecks em DB) ──
    @tag("student", "write", "heavy")
    @task(2)
    def create_chat_conversation(self):
        """Cria uma nova conversa (operação de escrita no banco de dados)."""
        if not self.token:
            return

        with self.client.post(
            "/chat/conversations",
            json={"title": f"Test Chat {uuid.uuid4().hex[:6]}"},
            name="[Chat] Create Conversation",
            catch_response=True,
        ) as res:
            self._check_latency(res)
            if res.status_code in (200, 201):
                data = res.json()
                if isinstance(data, dict) and data.get("id"):
                    self.conversation_ids.append(data.get("id"))

    def _check_latency(self, response):
        """Valida latência e detecta bottlenecks baseado no SLA configurado."""
        if response.elapsed.total_seconds() * 1000 > LATENCY_SLA_MS:
            logger.warning(
                f"[BOTTLENECK] Rota lenta: {response.request.method} {response.request.url} "
                f"demorou {response.elapsed.total_seconds() * 1000:.1f}ms (> {LATENCY_SLA_MS}ms)"
            )


# ── STEP LOAD SHAPE: Teste Automático de Break Point ──────────────────────────
class BreakPointStepShape(LoadTestShape):
    """
    Ramp-up progressivo em degraus para identificar o Break Point da infraestrutura:
    - Inicia em 10 usuários
    - A cada 30 segundos sobe mais 20 usuários
    - Degraus: 10 -> 30 -> 50 -> 70 -> 100 -> 130 -> 160 -> 200...
    - Ativado apenas se a variável LOCUST_SHAPE=breakpoint estiver definida.
    """

    step_time = 30  # segundos por degrau
    step_load = 20  # usuários adicionados por degrau
    spawn_rate = 5  # taxa de spawn por segundo
    time_limit = 600  # limite máximo de 10 minutos

    def tick(self):
        # Só ativa o modo automático se explicitamente solicitado
        if os.getenv("LOCUST_SHAPE", "").lower() != "breakpoint":
            return None

        run_time = self.get_run_time()
        if run_time > self.time_limit:
            return None

        current_step = run_time // self.step_time
        user_count = int(10 + current_step * self.step_load)
        return (user_count, self.spawn_rate)


# ── EVENT LISTENERS: Relatório Final de Gargalos e Resumo de Latência ────────
@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Exibe no terminal um resumo executivo com p95, p99 e taxa de falhas."""
    stats = environment.runner.stats
    total_reqs = stats.total.num_requests
    total_fails = stats.total.num_failures

    print("\n" + "=" * 60)
    print(" 📊 RESUMO DO TESTE DE CARGA - TEACHER TATI AI")
    print("=" * 60)
    print(f"Total de Requisições: {total_reqs}")
    print(f"Total de Falhas:       {total_fails} ({(total_fails / max(1, total_reqs)) * 100:.2f}%)")
    print(f"Tempo Médio (ms):     {stats.total.avg_response_time:.1f}ms")
    print(f"p95 Latência (ms):    {stats.total.get_response_time_percentile(0.95):.1f}ms")
    print(f"p99 Latência (ms):    {stats.total.get_response_time_percentile(0.99):.1f}ms")
    print(f"RPS Máximo Alcançado: {stats.total.total_rps:.1f} req/s")
    print("=" * 60 + "\n")
