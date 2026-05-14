# Hub Site

Nova aplicação web pública do `hub-premium`.

## Objetivo

- catálogo público de materiais avulsos
- login com a mesma conta da Tati AI para alunos existentes
- checkout guest para não-alunos
- backend e banco compartilhados com a aplicação principal

## Variáveis

- `NEXT_PUBLIC_API_BASE_URL`: URL do backend FastAPI compartilhado

## Scripts

- `npm run dev:hub` na raiz
- `npm run dev --workspace @tati/hub-site`

## Observações

- o app depende do workspace `@tati/hub-core`
- para instalar dependências do novo workspace, rode `npm install` na raiz do monorepo
