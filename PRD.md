# Product Requirements Document (PRD) - Tati AI

## 1. Visão Geral do Produto
O **Tati AI (Teacher Tati)** é uma plataforma inovadora de ensino de inglês e hub de conteúdos premium baseada em Inteligência Artificial. O produto centraliza o aprendizado de idiomas em uma tutora virtual imersiva alimentada por LLMs modernos, combinada a um sistema de Hub Educacional contendo materiais exclusivos (e-books, flashcards, áudios e PDFs). O objetivo principal é proporcionar uma experiência gamificada, acessível 24/7, que simula conversações reais e orienta o aluno segundo o Quadro Europeu Comum de Referência para Línguas (CEFR).

---

## 2. Público-Alvo (User Personas)
- **Aluno Iniciante (A1-A2):** Precisa de traduções de suporte, correções detalhadas e ritmo de aprendizado cadenciado com foco na confiança para falar.
- **Aluno Intermediário/Avançado (B1-C2):** Busca prática de conversação rápida, vocabulário complexo, simulações de entrevistas e gírias nativas.
- **Consumidor de E-books / Premium:** Adquire o acesso ao Hub Premium para estudar de forma offline, ler apostilas estruturadas, e consumir flashcards interativos.
- **Administrador (Professor/Time Tati):** Necessita de painéis (dashboards) para visualizar métricas, gerenciar licenças, cadastrar materiais e auditar chats.

---

## 3. Escopo e Funcionalidades Principais (Core Features)

### 3.1. Hub Premium Educacional (`apps/hub-site`)
- **Vitrine de Materiais:** Catálogo de materiais consumíveis (e-books, apostilas, quizzes).
- **Leitor de Documentos Seguro:** Sistema integrado de conversão de PDFs para imagens (`pdf2image` no backend) que impede downloads não autorizados e revenda de materiais protegidos.
- **Flashcards:** Treinamento de memória baseada em repetição espaçada, com possibilidade de anexar imagens geradas por IA.
- **Autenticação Unificada:** Login integrado (E-mail/Senha + Google OAuth) com roteamento inteligente baseado nos perfis e status de assinatura.

### 3.2. Chat e Tutoria com Inteligência Artificial
- **Interação Multimodal:** Suporte para envio de texto, áudio (transcrito via Whisper STT) e uploads de arquivo.
- **Respostas de Voz (TTS):** A professora virtual responde utilizando a biblioteca *Edge TTS* com vozes naturais em inglês.
- **Orquestração de LLMs:** Integração com Groq (foco em baixa latência com Llama 3), Anthropic Claude, e Gemini, selecionados dinamicamente para balancear custo, performance e limites de taxa.
- **RAG (Retrieval-Augmented Generation):** Permite injetar documentação específica ou histórico do usuário no contexto das respostas.

### 3.3. Sistema de Progresso e Gamificação
- **Nivelamento Dinâmico (CEFR):** O sistema monitora as interações e recalibra a dificuldade da resposta baseando-se no desempenho real do usuário.
- **XP e Troféus:** Sistema de metas diárias, streaks (dias consecutivos) e conquistas que destravam emblemas virtuais.

### 3.4. Motor de Monetização
- **Integração Asaas:** Gatilhos e webhooks para assinaturas, criação automática de contas via PIX/Cartão e envio de senhas seguras.
- **Paywall:** Limite de mensagens gratuitas com prompts para upgrade e redirecionamentos suaves.

---

## 4. Arquitetura do Sistema e Stack

A plataforma foi migrada para uma estrutura **Monorepo** (NPM Workspaces) para centralizar e componentizar interfaces e lógica de negócio.

### 4.1. Topologia do Monorepo
* **`/backend/`** (FastAPI): O coração do sistema. Arquitetura Modular (DDD) contendo módulos para `activities`, `admin`, `auth`, `chat`, `payments` e `users`. Gerencia o PostgreSQL (Supabase) via queries assíncronas e ORM, interage com filas Redis (Upstash) para Rate Limiting, e implementa as rotinas de IA.
* **`/apps/hub-site/`** (Next.js): Aplicação Web Premium. Usa React 18, Tailwind CSS, e design system "Midnight". Autenticação baseada no pacote compartilhado e integração com `@react-oauth/google`. Implementa CSR, SSR e Edge caching.
* **`/packages/hub-core/`**: Regras de negócio, fetchers de API (`axios`/`fetch`), validadores de entrada, schemas e store states do lado do cliente, compartilhados entre aplicações frontend e mobile.
* **`/frontend/`**: Cliente Web legado/Original baseado em SPA clássico.
* **`/mobile_app/`**: Estrutura e container para os apps Nativos/Híbridos.

### 4.2. Fluxo de Autenticação e Segurança
1. Usuário envia credenciais ou Token Google OAuth.
2. Backend valida os dados e checa no Supabase.
3. Senhas são "salgadas" e criptografadas utilizando `bcrypt`.
4. Um JWT robusto (`python-jose`) é gerado contendo o UUID, Role (Admin, User, Premium) e Claims de Expiração.
5. Em operações críticas (leitura de PDFs), o backend retorna streams binários ou URLs de curta duração (Cloudinary / S3).

---

## 5. Requisitos Não Funcionais

- **Performance (Latência de IA):** A conversação precisa ter *Time-To-First-Token* (TTFT) inferior a 800ms. Para isso, utiliza-se a plataforma Groq.
- **Escalabilidade:** O backend deve escalar horizontalmente via instâncias Docker sem estado. Sessões de WebSocket para transcrição e TTS precisam de handshakes otimizados.
- **Disponibilidade:** SLAs altos, suportados por bancos de dados gerenciados (Supabase) e monitoramento de erros em tempo real (Sentry).
- **Proteção de Propriedade Intelectual:** E-books em PDF não podem ser interceptados nativamente no browser. A conversão de PDF para renderização gráfica é mandatória.

---

## 6. Roadmap e Futuro

### Faze 1: Consolidação do Hub (Concluído)
- [x] Migração para monorepo.
- [x] Criação do pacote `hub-core` e unificação de APIs.
- [x] Login com Google.

### Fase 2: Evolução da Tutoria
- [ ] Lançar avatares em vídeo ou animações labiais sincronizadas ao TTS.
- [ ] Implementar painel de pais/responsáveis para acompanhamento de estudos de menores.

### Fase 3: Expansão Mobile
- [ ] Encapsular o Progressive Web App (PWA) em um WebView otimizado e publicar na App Store / Play Store.
- [ ] Habilitar funcionalidade offline parcial no aplicativo mobile.
