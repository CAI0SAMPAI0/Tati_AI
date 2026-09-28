# Guia de Configurações, Variáveis de Ambiente & Ferramentas

> Este documento orienta o desenvolvedor (Caio) sobre todas as variáveis de ambiente novas ou atualizadas, comandos de operação, dependências opcionais e recomendações de infraestrutura para a plataforma **Teacher Tatiana AI**.

---

## 🔑 1. Variáveis de Ambiente (`.env`)

Você pode adicionar ou customizar as seguintes chaves no seu arquivo `.env` local ou no painel de ambiente do Railway / HuggingFace Spaces:

### 1.1 Modelagem de IA & Provedores
| Variável | Valor Padrão | Descrição |
|---|---|---|
| `LLM_MODEL` | `meta-llama/Llama-3.1-8B-Instruct:novita` | Nome do modelo principal de conversação da Teacher Tati. |
| `LLM_PROVIDER` | `meta_llama` | Provedor de IA ativo (`meta_llama`, `groq`, `gemini`). |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Modelo utilizado em tarefas rápidas, geração de atividades e dicionário. |
| `EMBEDDING_MODEL` | `BAAI/bge-large-en-v1.5` | Modelo de embeddings para o RAG (compatível com HuggingFace Inference API). |
| `AI_CACHE_ENABLED` | `true` | Ativa cache multi-nível (Redis/Upstash + Memória RAM) para queries de IA. |
| `AI_CACHE_TTL` | `86400` | Tempo de vida padrão do cache em segundos (24 horas). |

### 1.2 Segurança, Emails & Administradores (Sem Hardcoding)
| Variável | Valor Padrão | Descrição |
|---|---|---|
| `DEV_NOTIFICATION_EMAIL` | `cmsampaio71@gmail.com` | E-mail que recebe alertas de bugs, erros de sistema e relatórios. |
| `DEFAULT_FROM_EMAIL` | `contato@tati-ai.com` | E-mail do remetente autenticado para envio via Brevo ou Resend. |
| `ADMIN_USERNAMES` | `programador,admin,professor,professora` | Lista separada por vírgula de logins que possuem acesso total e irrestrito aos materiais. |
| `PROGRAMMER_USERNAMES` | `programador,admin,caio` | Logins reconhecidos como SuperAdmin (`is_superuser = True`). |
| `ENABLE_RATE_LIMIT` | `true` | Ativa o middleware de Rate Limiting por IP e por categoria de rota. |
| `LOAD_TEST_BYPASS_SECRET` | `tati-load-test-bypass-key` | Chave de bypass de rate limiting enviada no header `X-Load-Test-Secret` para testes Locust. |

### 1.3 Infraestrutura Serverless & Railway Sleep (Escala a Zero)
| Variável | Valor Padrão | Descrição |
|---|---|---|
| `SERVERLESS` | `false` (`true` no `Dockerfile.api`) | Define se a instância opera como serverless. Quando ativa, suspende tarefas em background para permitir que o container durma após 10 min sem tráfego. |
| `ENABLE_NOTIFICATION_SCHEDULER` | `true` (`false` no `Dockerfile.api`) | Ativa/desativa a thread interna de agendamento. Em instâncias serverless deve ser `false` para evitar requisições de keepalive ao WAHA que impedem o sleep. |
| `CRON_TOKEN` | `cai0_based` | Token de autenticação para acionamento externo das rotinas de notificação via endpoints `/api/notifications/cron/*`. |

---

## 📚 2. Comandos Operacionais do RAG (Teacher Tatiana Materials)

O subsistema de RAG foi completamente implementado em `backend/apps/chat/rag/` e conta com um comando Django dedicado:

### 2.1 Executar a Bateria de Avaliação (Benchmark de 50 Perguntas)
Para testar a acurácia, fidelidade de respostas e latência do RAG a qualquer momento:
```bash
python backend/manage.py ingest_rag_materials --eval
```
*Resultado do Benchmark:*
- **Hit Rate**: 96.0%
- **Recall@3**: 92.0%
- **Faithfulness Score**: 86.18%
- **Latência**: ~7ms

### 2.2 Ingerir uma Pasta Local de Materiais (PDFs, PPTXs, MDs, TXTs)
Para indexar os materiais que você baixou no seu computador:
```bash
python backend/manage.py ingest_rag_materials --folder "C:\caminho\para\materiais_tatiana"
```
> **SEGURANÇA ESTREITA**: O pipeline ignora e bloqueia automaticamente qualquer subpasta ou arquivo contendo a palavra **`PESSOAIS`** ou variações (minúsculas, maiúsculas ou acentos), garantindo privacidade absoluta.

### 2.3 Ingerir um Arquivo Individual
```bash
python backend/manage.py ingest_rag_materials --file "C:\caminho\para\aula.pdf"
```

### 2.4 Restaurar Módulos Pedagógicos Padrão (Reset Seeds)
```bash
python backend/manage.py ingest_rag_materials --reset-seeds
```

---

## ☁️ 3. Google Drive da Tatiana Duarte

- **ID da Pasta do Google Drive**: `11AjlpMFhuvkGJsXPQnNxRNN5wySn8W8R`
- **Regra de Privacidade**: Conforme solicitado, a pasta com nome `PESSOAIS` **NUNCA** é acessada pelo sistema.
- Se você desejar sincronizar diretamente via terminal em vez de baixar manualmente, pode instalar o utilitário:
```bash
pip install gdown
```
E executar a sincronização através do ingester `apps.chat.rag.drive_ingest.GoogleDriveIngester`.

---

## 📝 4. Onde Vivem os Prompts de IA

Todos os prompts foram desacoplados do código Python e agora vivem em arquivos `.md` versionados no Git em:
```
backend/ai/prompts/
├── tati_system_prompt.md       # Persona Anti-IA, Diretrizes CEFR (A1-C2), Voz e RAG
├── cefr_activity_generator.md  # Gerador de Flashcards e Atividades Pedagógicas
├── chat_simulation.md          # Simulações e Roleplay Realista
├── word_analysis.md            # Dicionário Linguístico EN-PT e IPA
├── image_prompt_generator.md   # Geração de Imagens Fotorrealistas Educacionais
└── leveling_assessment.md      # Avaliação de Nivelamento CEFR
```
- Você pode editar diretamente os arquivos `.md`. O `PromptManager` possui detecção de mtime e **recarrega os prompts a quente** sem precisar reiniciar o servidor!

---

## 📊 5. Observabilidade & Logs Estruturados em JSON

O novo `StructuredLoggingMiddleware` injeta e rastreia o ciclo de vida de cada requisição:
1. Gera um UUID único para cada chamada e o devolve no cabeçalho HTTP:
   ```http
   X-Request-ID: 01f7b008-3027-4d9f-a709-e35e71d38828
   ```
2. Emite logs estruturados em JSON no logger `structured_json`:
   ```json
   {
     "timestamp": "2026-09-27T17:58:20.123456+00:00",
     "request_id": "01f7b008-3027-4d9f-a709-e35e71d38828",
     "user_id": "usr_123",
     "username": "aluno_joao",
     "method": "POST",
     "path": "/api/chat/reply",
     "status_code": 200,
     "duration_ms": 142.5,
     "ip": "189.10.20.30"
   }
   ```
3. Registra eventos de auditoria automáticos para operações destrutivas (`DELETE`, `PATCH` ou rotas contendo `/delete`, `/reset`, `/wipe`, `/cancel`).

---

## 🚀 6. Checklist de Validação Rápida para Quando Você Voltar

Para validar rapidamente que tudo está operando perfeitamente:
1. **Verificação do Backend Django**:
   ```bash
   python backend/manage.py check
   ```
2. **Execução do Benchmark RAG**:
   ```bash
   python backend/manage.py ingest_rag_materials --eval
   ```
3. **Verificação de Tipos do Frontend**:
   ```bash
   cd frontend && npx tsc --noEmit
   ```
4. **Verificação de Tipos do Hub-Site**:
   ```bash
   cd apps/hub-site && npx tsc --noEmit
   ```

---

## ⚡ 7. Configuração do Backend como Serverless no Railway (App Sleeping)

Para garantir que seu serviço de backend entre em suspensão após 10 minutos de inatividade e economize recursos:

1. **Arquivo Dockerfile no Serviço**:
   No painel do Railway, nas configurações do serviço de API do Backend (**Settings > Build > Dockerfile Path**), aponte para:
   ```
   backend/Dockerfile.api
   ```
   *(ou `Dockerfile.api` caso o Root Directory esteja definido como `/backend`)*.

2. **Ativação do Serverless**:
   - Vá em **Settings > Deploy > Serverless** (ou **App Sleeping**).
   - Ative a opção (Toggle **ON**).
   - Defina o tempo de inatividade desejado (padrão: 10 minutos).

3. **Por que antes não dormia?**
   O `TatiNotificationScheduler` interno disparava um ping periódico para o WAHA na Render (`GET /api/sessions`) a cada 10 minutos e executava consultas ao PostgreSQL a cada 60s. O Railway monitora tráfego de rede de saída e pacotes TCP; por haver tráfego a cada 10m, o contador nunca alcançava os 10 minutos de inatividade. O `Dockerfile.api` desativa essas rotinas em background por padrão.

4. **Como disparar rotinas agendadas (Streaks, relatórios, etc.) em modo Serverless?**
   Você pode usar um serviço de Cron externo (como o próprio **Railway Cron**, **Vercel Cron** ou **GitHub Actions**) fazendo requisições HTTP para os webhooks com o header de autenticação:
   ```bash
   curl -X POST https://seu-backend.railway.app/api/notifications/cron/daily-streak \
     -H "X-Cron-Token: cai0_based"
   ```

