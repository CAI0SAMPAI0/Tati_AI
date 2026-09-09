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
from locust import HttpUser, task, between, tag, events

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

    # Token compartilhado em nível de classe para evitar 429 (Rate Limit) de login/registro
    shared_token = None
    _auth_lock = False

    def on_start(self):
        """Inicializa a sessão do aluno autenticado."""
        self.client.headers["X-Load-Test-Secret"] = os.getenv(
            "LOAD_TEST_BYPASS_SECRET", "tati-load-test-bypass-key"
        )
        self.token = None
        self.conversation_ids = []
        self._setup_auth()

    def _setup_auth(self):
        """Obtém ou reutiliza token válido para os alunos simulados."""
        if StudentUser.shared_token:
            self.token = StudentUser.shared_token
            self.client.headers["Authorization"] = f"Bearer {self.token}"
            return

        # Apenas uma thread tenta autenticar/registrar para não tomar 429
        if not StudentUser.shared_token and not StudentUser._auth_lock:
            StudentUser._auth_lock = True
            try:
                username = os.getenv("LOCUST_USER") or "caio.sampaio"
                password = os.getenv("LOCUST_PASSWORD") or "caio123"

                res = self.client.post(
                    "/auth/login",
                    json={"username": username, "password": password},
                    name="[Auth] Login",
                )
                if res.status_code == 200:
                    data = res.json()
                    StudentUser.shared_token = data.get("access_token")
                    logger.info(f"Autenticado com sucesso como '{username}'! Token compartilhado com todos os usuários virtuais.")
                else:
                    logger.error(f"Falha no login com {username}: {res.status_code} {res.text}")
            finally:
                StudentUser._auth_lock = False

        # Aguarda a thread principal concluir o login para que nenhum usuário inicie sem token
        wait_attempts = 0
        while not StudentUser.shared_token and wait_attempts < 30:
            time.sleep(0.3)
            wait_attempts += 1

        # Atribui o token compartilhado à instância
        if StudentUser.shared_token:
            self.token = StudentUser.shared_token
            self.client.headers["Authorization"] = f"Bearer {self.token}"

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
    @task(1)
    def create_chat_conversation(self):
        """Cria uma nova conversa apenas se LOCUST_CREATE_CONVS=true for definido."""
        if not self.token or os.getenv("LOCUST_CREATE_CONVS", "false").lower() != "true":
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
