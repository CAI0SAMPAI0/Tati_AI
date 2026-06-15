# Análise de Bundle Size - Frontend

## 1. Visão Geral (First Load JS)
As rotas mais pesadas identificadas no build de produção são:

| Rota | First Load JS | Observações Prováveis |
| :--- | :--- | :--- |
| `/dashboard` | 330 kB | Recharts, Framer Motion, Dashboard Components |
| `/progress` | 253 kB | Recharts, Progress Charts |
| `/chat` | 199 kB | ReactMarkdown, RemarkGFM, Socket logic |
| `/goals` | 191 kB | Framer Motion, UI components |
| `/podcasts/[id]` | 190 kB | Audio player, markdown/description |
| `/vocab` | 189 kB | List components, animations |

## 2. Maiores Dependências Identificadas

Com base no tamanho dos bundles e análise de código, as maiores dependências que estão impactando o carregamento inicial são:

1. **Recharts**: Utilizada em `/dashboard` e `/progress`. É uma biblioteca pesada que não deve estar no bundle inicial se os gráficos não forem visíveis imediatamente.
2. **Framer Motion**: Utilizada para animações em quase todas as rotas autenticadas.
3. **ReactMarkdown / RemarkGFM**: Utilizada extensivamente no `/chat` e possivelmente em descrições de podcasts/atividades.
4. **Lucide React / React Icons**: Embora otimizados, o grande número de ícones diferentes pode somar ao tamanho do bundle se não houver tree-shaking eficiente.
5. **TanStack Query / Zustand**: Presentes em quase todas as rotas (shared chunks), o que é esperado, mas contribui para os ~93kB base.

## 3. Oportunidades de Otimização

- **Lazy Loading de Gráficos**: Usar `next/dynamic` com `{ ssr: false }` para carregar o Recharts apenas no cliente e apenas quando necessário.
- **Import Dinâmico de Markdown**: Carregar o `ReactMarkdown` apenas no chat e apenas quando houver mensagens a renderizar.
- **Divisão de Código em Dashboards**: Separar as seções do dashboard em componentes carregados dinamicamente para que o shell da página carregue mais rápido.
- **Auditoria de Ícones**: Garantir que não existam importações de pacotes inteiros de ícones.

## 4. Conclusão
O bundle base de 93kB está saudável para uma aplicação Next.js, mas pular para 330kB no dashboard indica que componentes pesados estão sendo carregados de forma síncrona. O foco da Sprint 0 deve ser a aplicação de imports dinâmicos nessas bibliotecas identificadas.
