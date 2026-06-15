# Diretrizes e Padrões

Para manter a consistência e qualidade do código, seguimos as seguintes diretrizes:

## Padrões de Código

-   **Clean Code**: Funções pequenas, nomes descritivos e responsabilidade única.
-   **TypeScript**: Tipagem estrita é obrigatória em todo o frontend e pacotes compartilhados.
-   **Pydantic**: Use tipos e modelos Pydantic para validação no backend.
-   **Comentários**: Documente o *porquê* de uma lógica complexa, não o *o quê*.

## Convenções de Nomenclatura

-   **Arquivos/Pastas**: `kebab-case` (ex: `my-component.tsx`, `user-service.py`).
-   **Componentes React**: `PascalCase` (ex: `UserProfile.tsx`).
-   **Variáveis/Funções**: `camelCase` no frontend e `snake_case` no backend.
-   **Classes**: `PascalCase`.

## Fluxo de Desenvolvimento

1.  **Workspaces**: Utilize os comandos do NPM root para gerenciar dependências.
2.  **Linting**: Rode o linter antes de submeter alterações.
3.  **Ambiente**: Mantenha o arquivo `.env` atualizado com base no `.env.example`.

## Git e Commits

-   **Mensagens**: Procure ser claro e conciso.
-   **Branches**: Utilize nomes descritivos (ex: `feat/add-payment-method`, `fix/chat-bug`).
-   **PRs**: Descreva as mudanças realizadas e inclua instruções de teste se necessário.
