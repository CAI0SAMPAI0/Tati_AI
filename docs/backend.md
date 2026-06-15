# Backend (FastAPI)

O backend do Tati AI é uma API RESTful e WebSocket construída com **FastAPI**. Ele segue uma abordagem modular inspirada em Domain-Driven Design (DDD).

## Estrutura de Pastas

Localizado em `/backend/app/`, a estrutura é organizada por domínios:

-   **`core/`**: Configurações globais (banco de dados, segurança, constantes).
-   **`modules/`**: Módulos de domínio que contêm a lógica de negócio.
-   **`shared/`**: Utilitários e serviços compartilhados entre módulos.

## Padrão de Módulos

Cada módulo em `modules/` deve seguir esta estrutura (quando aplicável):

```text
módulo/
├── routes/        # Endpoints HTTP (FastAPI APIRouter)
├── services/      # Lógica de negócio e orquestração
├── repositories/  # Acesso a dados (queries SQL/ORM)
├── schema/        # Definições de dados Pydantic
└── tasks.py       # Tarefas assíncronas do Celery
```

## Tecnologias e Bibliotecas

-   **Pydantic**: Para validação de dados e schemas.
-   **SQLAlchemy**: Para interação com o banco de dados (se aplicável, verificar no projeto).
-   **Celery**: Para processamento de tarefas em background.
-   **JWT**: Para autenticação e segurança.

## Boas Práticas

1.  **Injeção de Dependência**: Use `Depends()` para gerenciar sessões de banco de dados e autenticação.
2.  **Tratamento de Erros**: Utilize exceções personalizadas definidas em `core/exceptions.py`.
3.  **Documentação**: A API é auto-documentada via Swagger em `/docs` (em ambiente de desenvolvimento).
