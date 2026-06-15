# Frontend (Next.js)

O ecossistema frontend utiliza **Next.js 14** com **App Router**, TypeScript e Tailwind CSS.

## Organização do Código

Tanto o `frontend/` quanto o `apps/hub-site/` seguem uma estrutura semelhante:

-   **`app/`**: Rotas, layouts e páginas.
-   **`components/`**: Componentes React, organizados por funcionalidade (ex: `ui/`, `layout/`, `activities/`).
-   **`hooks/`**: Hooks customizados para lógica reutilizável.
-   **`lib/`**: Utilitários, configurações de API e constantes.
-   **`providers/`**: Context Providers (Autenticação, Tema, I18n).
-   **`store/`**: Gerenciamento de estado global (Zustand).

## Padrões de Componentes

1.  **Server Components**: Use por padrão para melhor performance e SEO.
2.  **Client Components**: Use apenas quando necessário (interatividade, hooks do React). Adicione a diretiva `'use client'` no topo do arquivo.
3.  **UI Components**: Componentes de interface base (botões, inputs) devem ser atômicos e reutilizáveis.

## Internacionalização (I18n)

O projeto suporta múltiplos idiomas. As mensagens estão localizadas em `lib/i18n/messages/`. Use o hook `useI18n` para acessar as traduções.

## Estilização

-   **Tailwind CSS**: Para estilização rápida e responsiva.
-   **Design Tokens**: Localizados em `lib/theme/tokens.ts` (verificar se existe no projeto).
-   **CSS Modules**: Para estilos específicos de componentes quando necessário.
