# Auditoria de Navegação - Next.js <Link> vs router.push

## 1. Componentes que já utilizam `<Link>` corretamente
Os componentes de menu principal foram auditados e estão utilizando o componente `<Link>` do Next.js, aproveitando o prefetch automático:
- `MainHeader.tsx`
- `SidebarActivities.tsx`
- `Sidebar.tsx` (Chat)
- `HubSidebar.tsx`
- `HubHeader.tsx`
- `Navbar.tsx` (Hub)

## 2. Ocorrências de `router.push` (Oportunidades de Otimização)
Identificamos diversos locais onde a navegação é feita via `onClick` com `router.push`. Estes casos devem ser substituídos por `<Link>` ou envoltos em `<Link>` para habilitar o prefetch e melhorar a velocidade de navegação percebida:

| Arquivo | Elemento/Ação | Rota Destino |
| :--- | :--- | :--- |
| `activities-client-page.tsx` | Card de Quiz | `/quiz/${q.id}` |
| `activities-client-page.tsx` | Card de Podcast | `/podcasts/${p.id}` |
| `activities-client-page.tsx` | Card de Flashcards | `/flashcards/${f.id}` |
| `activities-client-page.tsx` | Card de Simulação | `/voice?simulation_id=${s.id}` |
| `flashcards-client-page.tsx` | Botão "Back to Activities" | `/activities` |
| `profile-client-page.tsx` | Botão de Pagamento | `/payment` |
| `vocab-client-page.tsx` | Botão "Review Vocabulary" | `/vocab/review` |
| `weekly-goal.tsx` | Click no card de meta | `/activities` |
| `podcast-list.tsx` | Click no item de podcast | `/podcasts/${p.id}` |

## 3. Recomendações
1. **Substituição**: Alterar os botões e cards que usam `router.push` para utilizarem `<Link>`.
2. **Propriedade Prefetch**: Para rotas de alta prioridade (como `/activities` e `/payment`), garantir que o prefetch esteja habilitado.
3. **Navegação Programática**: Manter `router.push` apenas para redirecionamentos após ações lógicas (como após o login ou após salvar um perfil).
