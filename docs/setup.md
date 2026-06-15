# Guia de Configuração

Siga estes passos para configurar o ambiente de desenvolvimento local.

## Pré-requisitos

-   **Node.js v18+**
-   **Python 3.12+**
-   **NPM**
-   **Docker** (opcional, para serviços locais)

## Instalação

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/seu-usuario/Tati_AI.git
    cd Tati_AI
    ```

2.  **Instale as dependências do monorepo**:
    ```bash
    npm install
    ```

3.  **Configure o Backend**:
    ```bash
    cd backend
    python -m venv .venv
    # Ative o venv:
    # Windows: .venv\Scripts\activate
    # Linux/Mac: source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    ```

## Execução Local

Você pode iniciar os serviços a partir da raiz do projeto usando scripts NPM:

-   **Backend**: `npm run dev`
-   **Frontend (App Aluno)**: `npm run dev:frontend`
-   **Hub Site (Portal)**: `npm run dev:hub`

## Variáveis de Ambiente

Certifique-se de configurar as seguintes chaves no seu `.env`:

-   **Banco de Dados**: `SUPABASE_URL`, `SUPABASE_KEY`
-   **IA**: `GROQ_API_KEY`, `GOOGLE_API_KEY`
-   **Pagamentos**: `ASAAS_API_KEY`
-   **Serviços**: `RESEND_API_KEY`, `CLOUDINARY_URL`
