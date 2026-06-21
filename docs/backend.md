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

## Sistema de Caching e Gamificação

### Caching (Upstash Redis)
Para otimizar o carregamento das telas do aluno e evitar sobrecarga de consultas lentas no PostgreSQL (como contagem de mensagens ou histórico de submissões), implementamos cache inteligente no `ProgressService` e `DashboardService`:
- **Weekly & Monthly Reports**: Dados de relatórios são cacheados (TTL de 30 e 60 minutos, respectivamente) e reaproveitados nas requisições do frontend.
- **User Stats & Fluency Evolution**: Os endpoints `/dashboard/stats/my` e `/users/progress/fluency-evolution` são cacheados por 3 e 5 minutos, respectivamente.
- **Invalidação Automática**: Sempre que o usuário realiza qualquer atividade (envio de mensagem, quiz completo, vocabulário adicionado/revisado, podcast finalizado), o método `invalidate_user_cache(username)` é invocado, limpando todas as chaves do Redis daquele aluno para garantir que os dados atualizados sejam servidos no próximo acesso.

### Gamificação (XP e Ofensivas/Streaks)
Consolidamos o fluxo de ofensivas diárias do aluno:
- **Regra de Ofensiva**: Qualquer atividade de estudo diária mantém a ofensiva ativa (enviar no mínimo 1 mensagem no chat regular ou live voice, completar um quiz, finalizar um podcast, revisar palavras no SRS ou adicionar novas palavras).
- **Timezone consistente**: Todas as datas de estudo são gravadas e validadas no fuso horário UTC (`datetime.now(timezone.utc).date()`), evitando falhas na virada do dia local do aluno.
- **XP**: O ganho de XP é padronizado (+10 por mensagem enviada, +25 por acerto em quiz, +50 por podcast/simulação completa, +15 por palavra adicionada no SRS, +10 por palavra revisada).
