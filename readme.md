# 🧑‍ Teacher Tati — Plataforma de Ensino de Inglês com IA

> Uma plataforma completa de aprendizado de inglês potenciada por inteligência artificial, com quizzes, flashcards, simulações de conversas, ranking de engajamento, sistema de conquistas e muito mais.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Executar](#como-executar)
- [O que Está Por Vir](#o-que-está-por-vir)
- [Contribuição](#contribuição)
- [Licença](#licença)

---

## 🌟 Visão Geral

O **Teacher Tati** é uma plataforma de ensino de inglês que utiliza inteligência artificial para personalizar a experiência de aprendizado de cada aluno. Inspirada em plataformas como Duolingo e MentorIA, a Teacher Tati combina:

- **IA conversacional** para prática de inglês em tempo real
- **Sistema de atividades** com quizzes, flashcards e exercícios de pronúncia
- **Gamificação** com ranking de engajamento, troféus, ofensivas (streaks) e XP
- **Painel administrativo** para professores gerenciarem módulos e alunos
- **Design responsivo** que funciona em desktop, tablet e mobile

---

## ✅ Funcionalidades

### 🔐 Autenticação
- Login com e-mail e senha
- Login com Google OAuth
- Recuperação de senha por e-mail
- Sistema de JWT com refresh token

### 💬 Chat com IA
- Conversa em tempo real com a Teacher Tati
- Suporte a texto e voz (Text-to-Speech via ElevenLabs)
- Histórico de conversas
- Avatar animado da Tati com expressões faciais

### 🎓 Atividades

#### Quizzes
- Quizzes gerados automaticamente por IA a partir de módulos de estudo
- Múltipla escolha com 4 opções
- Feedback imediato com explicações
- Sistema de tentativas e pontuação
- Modal de quiz com barra de progresso

#### Flashcards
- Pacotes de flashcards gerados por IA
- Revisão espaçada de vocabulário
- Organização por temas e níveis

#### Speaking (Exercícios de Pronúncia)
- Exercícios de pronúncia com feedback em tempo real
- Desafios de fala com avaliação da IA

#### Simulações
- Simulações de conversas reais (aeroporto, restaurante, entrevistas)
- Cenários práticos para imersão no idioma

### 🏆 Gamificação

#### Ranking de Engajamento
- Sistema de pontuação por ações de estudo:
  - Exercício submetido: **8 pts**
  - Flashcard revisado: **5 pts**
  - Quiz resolvido: **3 pts**
  - Mensagem para a Tati: **1 pt**
- Desempate por quantidade de tokens utilizados
- Top 15 do mês
- Podium de vencedores (1º, 2º, 3º lugar)
- Prêmios: troféus + créditos extras

#### Conquistas e Troféus
- **Ofensiva (Streak)**: dias consecutivos de estudo com tracking detalhado
- **Troféus por categoria**:
  - 🎯 Perguntas (quizzes completados)
  - 🔥 Ofensiva (dias seguidos)
  - 💰 Créditos acumulados
  - ⏰ Tempo economizado
  - ⭐ Marcos especiais
  - 💬 Social
- Sistema de tiers: Bronze → Prata → Ouro → Platina
- Filtros por categoria de conquista

#### XP e Níveis
- Sistema de experiência por atividade
- Níveis de progresso: Beginner → Pre-Intermediate → Intermediate → Business English → Advanced

### 👤 Perfil do Aluno
- Foto de perfil personalizável
- Tempo de estudo (semana, mês, mês anterior, 3 meses)
- Atividades pendentes com redirecionamento direto
- Streak detalhado (atual, recorde, total de perguntas, horas economizadas)
- Caderno de vocabulário pessoal
- Metas de estudo semanais

### 👨‍ Painel Administrativo
- Dashboard com métricas da turma
- Lista de alunos com busca e filtros
- Relatórios de mensagens por dia/semana
- Heatmap de atividade
- Gráfico de níveis dos alunos (donut chart)
- Gestão de módulos de estudo (CRUD)
- Gestão de flashcards (geração por IA)
- Correção de atividades com feedback da IA
- Criação de simulações de conversa
- Gerenciamento de permissões e planos

### 💳 Pagamentos
- Integração com **Asaas** para cobrança
- Webhooks para confirmação de pagamento
- Período gratuito com limite de mensagens
- Controle de acesso por plano

### 🌍 Internacionalização
- Suporte a Português (PT-BR) e Inglês (EN)
- Troca de idioma em tempo real

### 🎨 Tema
- Modo claro e escuro
- Persistência de preferência no localStorage

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                   (HTML / CSS / JS Vanilla)                      │
│                        Vercel (CDN)                              │
├─────────────────────────────────────────────────────────────────┤
│                         BACKEND                                  │
│                      (Python / FastAPI)                          │
│                        Railway (API)                             │
├─────────────────────────────────────────────────────────────────┤
│                      DATABASE / CACHE                            │
│              Supabase (PostgreSQL) + Upstash Redis               │
├─────────────────────────────────────────────────────────────────┤
│                        SERVIÇOS EXTERNOS                         │
│  LLMs (Groq/Claude/Gemini) │ ElevenLabs │ Asaas │ Sentry       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tecnologias

### Backend
| Tecnologia | Uso |
|---|---|
| **Python 3** | Linguagem principal |
| **FastAPI** | Framework web assíncrono |
| **Pydantic** | Validação de dados |
| **Supabase Client** | Conexão com PostgreSQL |
| **Upstash Redis** | Rate limiting |
| **Groq / Claude / Gemini** | Modelos de linguagem (LLM) |
| **ElevenLabs** | Text-to-Speech |
| **Asaas** | Gateway de pagamentos |
| **Sentry** | Monitoramento de erros |
| **bcrypt** | Hash de senhas |

### Frontend
| Tecnologia | Uso |
|---|---|
| **HTML5** | Estrutura das páginas |
| **CSS3** | Estilização com variáveis e animações |
| **JavaScript (Vanilla)** | Lógica do frontend |
| **Font Awesome 6** | Ícones |
| **Google Fonts (Inter)** | Tipografia |

### Infraestrutura
| Serviço | Uso |
|---|---|
| **Railway** | Hospedagem do backend |
| **Vercel** | Hospedagem do frontend |
| **Supabase** | Banco de dados PostgreSQL |
| **Upstash** | Cache Redis |
| **Cloudflare** | CDN e WAF |

---

## 📁 Estrutura do Projeto

```
Tati_AI/
├── backend/
│   ├── main.py                     # App FastAPI principal
│   ├── requirements.txt            # Dependências Python
│   ├── core/
│   │   ├── config.py               # Configurações (JWT, LLMs, SMTP, Asaas)
│   │   ├── security.py             # Autenticação JWT, hash de senhas
│   │   ├── rate_limiter.py         # Rate limiting via Upstash
│   │   └── sentry_config.py        # Monitoramento Sentry
│   ├── routers/
│   │   ├── auth.py                 # Login, registro, Google OAuth
│   │   ├── deps.py                 # Dependências FastAPI
│   │   ├── challenges.py           # Desafios de pronúncia
│   │   ├── simulation.py           # Simulações de conversa
│   │   ├── validation.py           # Validação de documentos
│   │   ├── ai/
│   │   │   ├── chat.py             # Chat com IA
│   │   │   └── avatar.py           # Avatar animado
│   │   ├── activities/
│   │   │   ├── modules.py          # Módulos de estudo
│   │   │   ├── quizzes.py          # Quizzes
│   │   │   ├── trophies.py         # Troféus/conquistas
│   │   │   └── submissions.py      # Submissões de atividades
│   │   ├── admin/
│   │   │   └── dashboard.py        # Dashboard admin
│   │   ├── users/
│   │   │   ├── profile.py          # Perfil do usuário
│   │   │   ├── permissions.py      # Controle de acesso/planos
│   │   │   ├── streaks.py          # Streaks (ofensivas)
│   │   │   ├── progress.py         # Progresso, ranking, estudo
│   │   │   ├── vocabulary.py       # Caderno de vocabulário
│   │   │   ├── goals.py            # Metas de estudo
│   │   │   └── xp.py               # Sistema de XP e níveis
│   │   └── payments/
│   │       └── asaas.py            # Pagamentos via Asaas
│   ├── services/
│   │   ├── database.py             # Cliente Supabase
│   │   ├── llm.py                  # Integração com LLMs
│   │   ├── rag.py                  # RAG (Retrieval Augmented Generation)
│   │   ├── prompt_builder.py       # Construtor de prompts
│   │   ├── upstash.py              # Serviço Upstash
│   │   ├── history.py              # Histórico de conversas
│   │   ├── streaks.py              # Lógica de streaks
│   │   ├── xp_system.py            # Sistema de XP
│   │   ├── study_goals.py          # Metas de estudo
│   │   ├── progress_report.py      # Relatórios de progresso
│   │   ├── asaas.py                # Serviço Asaas
│   │   ├── email.py                # Envio de e-mails
│   │   ├── geolocation.py          # Geolocalização
│   │   ├── document_validator.py   # Validação de documentos
│   │   ├── pronunciation_challenge.py # Challenge de pronúncia
│   │   └── simulation.py           # Lógica de simulações
│   └── migrations/
│       ├── 001_consolidated.sql    # Migração inicial
│       ├── 002_quizzes_trophies.sql # Quizzes e troféus
│       └── 003_ranking_trophies_study.sql # Ranking e sessões de estudo
│
├── frontend/
│   ├── index.html                  # Login/Registro
│   ├── dashboard.html              # Dashboard admin
│   ├── chat.html                   # Chat com IA
│   ├── activities.html             # Atividades (quizzes, flashcards, etc.)
│   ├── profile.html                # Perfil do aluno
│   ├── progress.html               # Progresso
│   ├── goals.html                  # Metas
│   ├── vocab.html                  # Caderno de vocabulário
│   ├── payment.html                # Pagamento/planos
│   ├── js/
│   │   ├── api.js                  # Cliente API centralizado
│   │   ├── auth.js                 # Autenticação
│   │   ├── i18n.js                 # Internacionalização
│   │   ├── activities_ui.js        # UI de atividades
│   │   ├── dashboard.js            # Dashboard admin
│   │   ├── chat.js                 # Chat com IA
│   │   ├── profile.js              # Perfil do aluno
│   │   └── ...                     # Demais módulos
│   ├── styles/
│   │   ├── global.css              # Estilos globais
│   │   ├── activities.css          # Estilos de atividades
│   │   ├── dashboard.css           # Dashboard admin
│   │   ├── chat.css                # Chat
│   │   ├── profile.css             # Perfil
│   │   └── ...                     # Demais estilos
│   └── assets/images/
│       └── tati_logo.jpg           # Logo
│
├── Procfile                        # Configuração de deploy Railway
├── .gitignore
└── README.md
```

---

## 🚀 Como Executar

### Pré-requisitos
- Python 3.10+
- Node.js (opcional, para desenvolvimento)
- Conta no Supabase
- Conta no Upstash (Redis)
- Chave de API do Groq/Claude/Gemini
- Chave da ElevenLabs
- Conta no Asaas (para pagamentos)

### Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# ou
.venv\Scripts\activate     # Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Executar
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Servir localmente (qualquer servidor estático funciona)
python -m http.server 8080
# ou
npx serve .
```

### Deploy

- **Backend**: Deploy automático no **Railway** via `git push`
- **Frontend**: Deploy automático na **Vercel** via `git push`

---

## 🔮 O que Está Por Vir

### Funcionalidades Planejadas

| Funcionalidade | Descrição | Status |
|---|---|---|
| **Flashcards Interativos** | Interface completa de revisão espaçada com flip cards | 🚧 Em desenvolvimento |
| **Exercícios de Speaking** | Gravação de áudio + avaliação de pronúncia por IA | 🚧 Em desenvolvimento |
| **Simulações de Conversa** | Cenários interativos (aeroporto, restaurante, etc.) |  Planejado |
| **Chat em Grupo** | Salas de estudo com outros alunos + moderador IA | 📋 Planejado |
| **Videoaulas** | Conteúdo em vídeo integrado aos módulos | 📋 Planejado |
| **Relatórios Detalhados** | Analytics completo para alunos e professores | 📋 Planejado |
| **App Mobile** | Aplicativo React Native para iOS/Android | 📋 Planejado |
| **Modo Offline** | Cache local de conteúdo para estudo sem internet | 📋 Planejado |
| **Certificados** | Geração automática de certificados por módulo | 📋 Planejado |
| **Integração com Calendário** | Agendamento de aulas e lembretes | 📋 Planejado |
| **Dark Mode Avançado** | Temas personalizáveis além de claro/escuro | 📋 Planejado |
| **Notificações Push** | Alertas de streak, ranking e novas atividades | 📋 Planejado |

### Melhorias Técnicas

- [ ] Testes unitários e de integração
- [ ] CI/CD com GitHub Actions
- [ ] Documentação de API com OpenAPI/Swagger
- [ ] Otimização de performance do frontend
- [ ] Cache inteligente no frontend
- [ ] WebSocket para chat em tempo real (substituir polling)
- [ ] Migração gradual para TypeScript no frontend

---

## 👥 Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add: AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código

- **Backend**: Seguir PEP 8, usar type hints, docstrings em todas as funções
- **Frontend**: Seguir estilo existente, usar nomes semânticos, evitar código duplicado
- **Commits**: Usar convenção `tipo: descrição` (ex: `feat: add quiz retry`, `fix: correct streak calculation`)

---

## 📄 Licença

Este projeto é propriedade de **Teacher Tati** e não está licenciado para uso externo sem autorização.

---

## 📞 Contato

- **E-mail**: contato@teacherati.com.br
- **GitHub**: [github.com/Tati_AI](https://github.com/Tati_AI)

---

<p align="center">
  Feito com 💜 pela equipe Teacher Tati
</p>
