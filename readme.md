# Teacher Tati — English Learning Platform Powered by AI

Teacher Tati é uma plataforma full-stack de ensino de inglês que utiliza Inteligência Artificial para proporcionar prática de conversação em tempo real, gamificação avançada e ferramentas administrativas completas.

---

## 🏗️ Arquitetura do Sistema

O projeto segue uma arquitetura de **Backend Monolítico Modular** com **Frontend Desacoplado (Vanilla SPA-style)**.

### Visão Geral da Stack
- **Backend:** FastAPI (Python 3.12)
- **Frontend:** Vanilla JavaScript, HTML5, CSS3 (Custom Properties)
- **Banco de Dados:** PostgreSQL (via Supabase)
- **Cache & Rate Limit:** Upstash Redis
- **IA/LLM:** Groq (Llama 3), Claude, Gemini
- **Áudio (STT/TTS):** Whisper Large V3 / Edge TTS
- **Pagamentos:** Asaas API
- **Monitoramento:** Sentry

---

## 🌊 Fluxos Principais

### 1. Ciclo de Vida de uma Mensagem (Chat)
1. **Entrada:** O usuário envia texto, áudio (Base64) ou arquivos (PDF/DOCX) via WebSocket.
2. **Processamento Inicial:** 
   - Se áudio, é transcrito via Whisper.
   - Se arquivo, o texto é extraído e injetado no contexto.
3. **Controle de Acesso:** O sistema verifica se o usuário possui mensagens gratuitas ou assinatura ativa (incluindo *grace period*).
4. **Contextualização (RAG & Perfil):**
   - Busca-se contexto relevante em documentos via RAG (se habilitado).
   - O perfil do aluno (nível CEFR, interesses) é carregado.
5. **Geração LLM:** O prompt é montado e enviado para o Groq (com rotação de chaves para evitar limites de taxa). A resposta é retornada via streaming.
6. **Pós-processamento:** 
   - O texto é convertido em áudio (TTS).
   - A mensagem é salva no histórico.
   - XP é atribuído e troféus são verificados.

### 2. Gamificação e Progresso
- **Sistema de XP:** Baseado no quadro europeu (CEFR). Ações como enviar mensagens, completar quizzes e manter *streaks* concedem XP.
- **Níveis:** A1 (Iniciante) até C2 (Domínio Total).
- **Troféus:** Sistema de conquistas automáticas (ex: "Primeira Mensagem", "Ofensiva de 7 dias").
- **Ranking:** Ranking mensal dinâmico baseado no engajamento.

---

## 📂 Estrutura de Módulos (Backend)

- `core/`: Configurações globais, segurança (JWT) e middlewares.
- `routers/`: Definição de endpoints divididos por domínio (auth, user, ai, payments).
- `services/`: Lógica de negócio pura e integrações externas.
  - `llm.py`: Gestão de modelos e áudio.
  - `xp_system.py`: Regras de gamificação.
  - `asaas.py`: Integração financeira.
- `migrations/`: Scripts SQL para estruturação do banco de dados.

---

## 🛠️ Configuração e Instalação

### Requisitos
- Python 3.12+
- Node.js (opcional, para serve local)
- Chaves de API: Groq, Supabase, Asaas.

### Instalação Rápida
```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env # Configure suas chaves
uvicorn main:app --reload

# Frontend
cd frontend
python -m http.server 8080
```

---

## 📄 Documentação Técnica
Para detalhes sobre a API e esquemas de dados, acesse `/docs` (Swagger) com o backend rodando.

---

## ⚖️ Licença
Proprietário. Todos os direitos reservados ao projeto Teacher Tati.