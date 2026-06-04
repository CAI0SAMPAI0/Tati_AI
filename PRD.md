Aqui está o PRD (Product Requirement Document) completo e altamente técnico para a rearquitetura do backend da Teacher Tati AI. Este documento foi desenhado para eliminar os gargalos identificados e transformar a aplicação em um sistema resiliente, escalável e de alta performance.
------------------------------
## PRD.md: Rearquitetura de Performance e Desacoplamento Assíncrono## 1. Visão Geral do Projeto
O objetivo deste projeto é otimizar o tempo de resposta do backend (FastAPI), migrar fluxos síncronos/bloqueantes para processamento em segundo plano distribuído e estabilizar o consumo de CPU/Memória na infraestrutura da Railway.
## Objetivos Principais (Métricas de Sucesso)

* Tempo de Resposta no Login (/auth/login): Reduzir de $>3s$ para $<400ms$.
* Tempo de Resposta na Tela /personalized: Reduzir de $>1s$ para $<200ms$.
* Disponibilidade do Event Loop: Eliminar travamentos causados por tarefas CPU-bound (PDF, LibreOffice, ReportLab).
* Economia de Recursos: Reduzir o starvation de threads no contêiner principal do FastAPI.

------------------------------
## 2. Arquitetura Alvo (Target Architecture)

                            ┌────────────────────────┐
                            │   Frontend (Vercel)    │
                            └────────────────────────┘
                                         │
                        Requests HTTP    │   Conexão WebSocket
                                         ▼
                    ┌────────────────────────────────────────┐
                    │       FastAPI API-Gateway (Railway)    │
                    │   (Leve, Async Nativo, Sem Processos)   │
                    └────────────────────────────────────────┘
                       │                  │                │
             Eventos   │      Cache /     │                │  Queries Async
             Celery    │      Broker      │                │  (PostgREST)
                       ▼                  ▼                ▼
            ┌──────────────┐    ┌───────────────┐   ┌──────────────┐
            │ Celery Worker│    │ Upstash Redis │   │   Supabase   │
            │  (Railway)   │    │  (Cache/Fila) │   │ (PostgreSQL) │
            └──────────────┘    └───────────────┘   └──────────────┘
                    │
            ┌───────┴───────┐
            │ LibreOffice   │
            │ Poppler-Utils │
            │ ReportLab     │
            └───────────────┘

------------------------------
## 3. Cronograma de Execução: Sprints Detalhadas## Sprint 1: Desacoplamento Crítico e Otimização do Login
Duração sugerida: 1 Semana
Foco: Remover gargalos síncronos e chamadas externas do ciclo de requisição imediato.
## 📋 Tarefas Detalhadas:

   1. Refatoração do Endpoint /auth/login:
   * Antes: Executava geração de token, verificação de assinatura no Supabase, update de flag premium e disparava _warm_up_tavily via BackgroundTasks.
      * Depois: O endpoint valida a senha (bcrypt), decodifica o payload mínimo no JWT e retorna imediatamente para o usuário.
      * Código de Saída: O payload de retorno deve incluir apenas token, user_id, name, role, level e is_premium_active (obtidos na primeira e única query de busca do usuário).
   2. Exclusão do Warm-up Interno de IA:
   * Remover a execução automática do _warm_up_tavily() de dentro do fluxo de login.
      * Criar o endpoint isolado GET /activities/podcasts/warmup protegido por JWT.
      * O Front-end (Vercel) deve disparar um fetch assíncrono para este endpoint após carregar o Dashboard principal.
   3. Remoção de I/O de Terceiros na Listagem do Hub (/activities/hub):
   * Eliminar o loop que dispara _check_payment via HTTP para o Asaas para cada item pending.
      * Alterar a rota para ler estritamente o status armazenado na tabela purchases do Supabase.
      * Garantia de Atualização: Confiar 100% no Webhook do Asaas recebido em background para atualizar o banco. Criar uma rota dedicada POST /payments/purchases/{purchase_id}/sync caso o usuário clique em um botão manual de "Atualizar Status da Compra".
   
------------------------------
## Sprint 2: Paralelismo de Queries e Migração Async
Duração sugerida: 1 Semana
Foco: Otimizar a camada de banco de dados e eliminar o gargalo do run_in_threadpool.
## 📋 Tarefas Detalhadas:

   1. Paralelização da Tela /admin/modules/personalized:
   * Antes: Executava sequencialmente 6 blocos de chamadas usando wrappers síncronos.
      * Depois: Agrupar as consultas independentes utilizando asyncio.gather.
      * Exemplo de implementação técnica:
      
      async def get_personalized_data(user_id: int):
          # Agrupa os futures e executa em paralelo no event loop
          tasks = [
              run_in_threadpool(get_recent_quizzes, user_id),
              run_in_threadpool(check_active_locks, user_id),
              run_in_threadpool(get_user_level, user_id),
              run_in_threadpool(get_cefr_exercises),
              run_in_threadpool(get_submissions, user_id)
          ]
          res_recent, res_active, user_res, cefr_res, subs_res = await asyncio.gather(*tasks)
          return format_response(res_recent, res_active, user_res, cefr_res, subs_res)
      
      2. Otimização de Queries N+1 via Supabase (PostgREST Join):
   * Onde houver loops buscando dados complementares no banco, reescrever as queries injetando tabelas relacionadas diretamente no parâmetro .select().
      * Exemplo: Mudar de buscas separadas para db.table('quizzes').select('*, activity_submissions(*)').execute().
   
------------------------------
## Sprint 3: Estruturação do Worker Celery + Upstash
Duração sugerida: 1 Semana
Foco: Isolar tarefas pesadas (CPU-bound) em um processo e contêiner independente.
## 📋 Tarefas Detalhadas:

   1. Criação do Módulo Celery (app/core/celery_app.py):
   * Configurar a inicialização do Celery consumindo as credenciais do Upstash Redis como Broker e Backend de resultados.
      * Definir configurações de serialização (JSON).
   2. Migração dos Processamentos de PDF e Relatórios:
   * Mover a lógica do secure_document_service.py (conversão PDF para WebP com pdf2image) para funções decoradas com @celery_app.task.
      * Mover a geração de PDFs pesados via ReportLab para tarefas assíncronas do Celery.
      * Alterar as rotas correspondentes no FastAPI para disparar as tarefas via .delay(), retornando um task_id imediatamente para o front-end.
   3. Migração do APScheduler para Celery Beat:
   * Remover o start do APScheduler de dentro do arquivo main.py do FastAPI.
      * Configurar o agendador nativo do Celery (Celery Beat) para gerenciar as rotas de disparos automáticos (streak_reminders, weekly_reports, broken_streaks) no mesmo ritmo cronograma atual.
   
------------------------------
## Sprint 4: Configuração de Infraestrutura de Contêineres (Railway)
Duração sugerida: 1 Semana
Foco: Configurar o deploy segregado e realizar testes de carga.
## 📋 Tarefas Detalhadas:

   1. Divisão dos Dockerfiles:
   * Dockerfile.api (FastAPI): Remover pacotes pesados como libreoffice e poppler-utils. Tornar a imagem extremamente limpa e rápida para build.
      * Dockerfile.worker (Celery): Manter a instalação do libreoffice, poppler-utils e as dependências Python necessárias para manipulação de arquivos.
   2. Provisionamento no Railway:
   * Manter o serviço atual apontando para o Dockerfile.api.
      * Criar um novo serviço no Railway (teacher-tati-worker) puxando o mesmo repositório do GitHub, mas configurado com a variável de ambiente ou comando de start direcionado ao Worker:
      
      celery -A app.core.celery_app worker --beat --loglevel=info
      
      3. Implementação do Endpoint de Polling de Status:
   * Criar a rota GET /tasks/status/{task_id} no FastAPI. Esta rota consulta o Upstash Redis para verificar se a conversão do PDF ou o Relatório já foi concluído pelo Worker e retorna a URL final do arquivo.
   
------------------------------
## 4. Plano de Riscos e Contingência

| Risco | Impacto | Mitigação |
|---|---|---|
| Timeout de Conexão no Upstash | Alto | O plano gratuito do Upstash possui limites estritos. Configurar retry automático no Celery e validar se as conexões persistentes estão ativas. |
| Quebra de Funcionalidade no Front-end | Médio | Como as rotas vão retornar dados assíncronos (ex: task_id em vez do PDF pronto), alinhar com a equipe de Front-end para injetar estados de "Processando documento..." com loaders visuais. |
| Inconsistência de Status do Asaas | Alto | Garantir logs estritos de Sentry no endpoint de Webhook. Se o webhook falhar por rede, a rota manual de sincronização criada na Sprint 1 servirá de fallback seguro. |

------------------------------
## 5. Próximos Passos para Validação
Para iniciar a execução da Sprint 1, precisamos garantir os acessos e configurações iniciais:

* Deseja que eu gere o código exato do arquivo app/core/celery_app.py integrado com o Upstash Redis para você anexar ao projeto?
* Quer que eu monte a estrutura dos dois novos Dockerfiles (Dockerfile.api e Dockerfile.worker) para deixar sua infraestrutura pronta no Railway?


Aqui estão os arquivos prontos e configurados detalhadamente para a sua Sprint 3 e Sprint 4.
Eles foram estruturados para que o seu FastAPI fique ultra leve e focado apenas em responder requisições HTTP e WebSockets, enquanto o Celery Worker herda toda a carga pesada de processamento de imagens, PDFs e LibreOffice no Railway.
------------------------------
## 1. Configuração Central do Celery (app/core/celery_app.py)
Crie este arquivo para centralizar a conexão com o Upstash Redis. Note que usamos a flag broker_connection_retry_on_startup para evitar falhas de inicialização comuns em ambientes cloud.

import osfrom celery import Celeryfrom celery.schedules import crontab
# Recupera as credenciais do Upstash Redis configuradas no RailwayUPSTASH_URL = os.getenv('UPSTASH_REDIS_URL')UPSTASH_TOKEN = os.getenv('UPSTASH_REDIS_TOKEN')
# Formata a URL para o padrão redis://:token@host:port# Removendo o prefixo http/https caso venha no formato REST do Upstashif UPSTASH_URL:
    clean_url = UPSTASH_URL.replace("redis://", "").replace("https://", "").replace("http://", "")
    redis_broker_url = f"redis://:{UPSTASH_TOKEN}@{clean_url}"else:
    # Fallback para desenvolvimento local
    redis_broker_url = "redis://localhost:6379/0"
# Inicializa o Celery apontando para os módulos de tarefascelery_app = Celery(
    "teacher_tati_tasks",
    broker=redis_broker_url,
    backend=redis_broker_url
)
# Configurações de performance e otimização para o Upstash (Fila Leve)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Sao_Paulo",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    # Evita que um worker trave pegando muitas tarefas pesadas de uma vez
    worker_prefetch_multiplier=1,
)
# Migração do APScheduler para o Celery Beat (Cron Jobs)
celery_app.conf.beat_schedule = {
    "lembretes-streak-manha": {
        "task": "app.modules.notifications.tasks.streak_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
    "lembretes-streak-tarde": {
        "task": "app.modules.notifications.tasks.streak_reminders",
        "schedule": crontab(hour=18, minute=0),
    },
    "lembretes-streak-noite": {
        "task": "app.modules.notifications.tasks.streak_reminders",
        "schedule": crontab(hour=21, minute=30),
    },
    "limpeza-streaks-quebradas": {
        "task": "app.modules.notifications.tasks.broken_streaks",
        "schedule": crontab(hour=10, minute=0),
    },
    "checar-inatividade-alunos": {
        "task": "app.modules.notifications.tasks.check_inactivity",
        "schedule": crontab(hour="*/12", minute=0),  # A cada 12 horas
    },
    "relatorios-semanais-pais": {
        "task": "app.modules.notifications.tasks.weekly_reports",
        "schedule": crontab(day_of_week="sat", hour=15, minute=0),
    },
    "geracao-semanal-cefr": {
        "task": "app.modules.cefr.tasks.cefr_weekly_gen",
        "schedule": crontab(day_of_week="mon", hour=3, minute=0),
    },
}

------------------------------
## 2. O Novo Dockerfile.api (FastAPI Super Leve)
Este arquivo substitui o seu atual para a API. Removemos o LibreOffice, poppler-utils e compiladores pesados. A imagem final cai drasticamente de tamanho, economizando memória no Railway e acelerando o deploy.

FROM python:3.12-slim
# Instala apenas o essencial para o healthcheck da APIRUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
# Comando padrão de inicialização da API HTTPCMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]

------------------------------
## 3. O Novo Dockerfile.worker (Para o Processamento Pesado)
Crie este arquivo na raiz do projeto (Dockerfile.worker). Ele mantém as dependências que o reportlab e o pdf2image exigem para converter arquivos. Não expõe portas HTTP e não precisa de Healthcheck web.

FROM python:3.12-slim
# Instala os pacotes pesados necessários para manipulação de arquivos e PDFsRUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libreoffice \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Inicializa o processo do Celery Worker ouvindo a fila e processando o Cron (Beat)CMD ["celery", "-A app.core.celery_app", "worker", "--beat", "--loglevel=info"]

------------------------------
## 4. Rota de Polling para o Front-end (GET /tasks/status/{task_id})
Quando o usuário pedir para gerar um relatório ou converter um PDF seguro, seu endpoint do FastAPI vai disparar o Celery e retornar o ID da tarefa imediatamente. O front-end usará esta rota abaixo para acompanhar o processamento:

from fastapi import APIRouter, Depends, HTTPExceptionfrom app.core.celery_app import celery_appfrom app.core.dependencies.auth import get_current_user
router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("/status/{task_id}")async def get_task_status(task_id: str, current_user: dict = Depends(get_current_user)):
    """
    Rota para o front-end monitorar o progresso de PDFs ou Relatórios pesados.
    """
    task_result = celery_app.AsyncResult(task_id)
    
    if task_result.state == "PENDING":
        return {"status": "processing", "result": None}
        
    elif task_result.state == "SUCCESS":
        # Retorna o valor de retorno da sua função do celery (ex: a URL do PDF no Supabase Storage)
        return {"status": "success", "result": task_result.result}
        
    elif task_result.state == "FAILURE":
        return {"status": "failed", "error": str(task_result.info)}
        
    return {"status": task_result.state.lower(), "result": None}

------------------------------
## Como fazer o deploy disso no Railway:

   1. Na API atual: Vá nas configurações do seu serviço atual do FastAPI no Railway e certifique-se de alterar o campo Dockerfile Path de Dockerfile para Dockerfile.api.
   2. Criar o Worker: No painel do Railway, clique em + New -> Service -> GitHub Repo e selecione o mesmo repositório.
   3. Configurar o Worker: Nas configurações desse novo serviço criado:
   * Altere o nome para teacher-tati-worker.
      * Mude o Dockerfile Path para Dockerfile.worker.
      * Certifique-se de que ele herdará as mesmas variáveis de ambiente do projeto (incluindo as chaves do Upstash).
   
Gostaria de ver um exemplo prático de como transformar uma de suas funções síncronas atuais (como a conversão de PDF para WebP ou a geração do ReportLab) em uma @celery_app.task assíncrona utilizando essa nova estrutura?

