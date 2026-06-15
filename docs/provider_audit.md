# Auditoria de Providers - Frontend

## 1. Análise de Re-renderização no Nível Raiz

Os seguintes providers estão localizados em `AppProviders` (root layout), o que significa que qualquer mudança de estado neles pode disparar a re-renderização de toda a árvore de componentes da aplicação.

### ThemeProvider
- **Comportamento**: Utiliza `next-themes` e um estado local `mounted` para evitar erros de hidratação.
- **Impacto**: Estável após a montagem inicial. Mudanças de tema (claro/escuro) disparam re-render global, o que é esperado.
- **Recomendação**: Manter no nível global.

### QueryProvider
- **Comportamento**: Cria o `QueryClient` uma única vez via `useState` inicializador.
- **Impacto**: Extremamente estável. Não causa re-renders desnecessários.
- **Recomendação**: Manter no nível global.

### AuthProvider
- **Comportamento**: Gerencia `token`, `user` e estados de carregamento. Realiza fetch de `/profile` na hidratação.
- **Impacto**: Mudanças no estado de autenticação disparam re-render global. Isso é necessário para que toda a aplicação reaja ao login/logout.
- **Recomendação**: Manter no nível global, mas considerar o uso de seletores granulares (ou Zustand) se o objeto `user` mudar com frequência.

### NotificationProvider
- **Comportamento**: Realiza **polling a cada 15 segundos** para buscar novas notificações.
- **Impacto**: **Alto.** Como está no nível raiz, cada ciclo de polling que resulte em atualização de estado disparará uma re-renderização de toda a aplicação, incluindo rotas que não precisam de notificações (como a tela de login).
- **Recomendação**: **Mover para o layout autenticado** (`app/(authenticated)/layout.tsx`). Usuários não autenticados não precisam carregar a lógica de notificações nem sofrer o impacto do polling.

## 2. Componentes de Suporte

- **Toaster**: Deve permanecer global para exibir mensagens de erro/sucesso em qualquer rota.
- **RegisterServiceWorker**: Deve permanecer global para garantir o funcionamento do PWA em toda a aplicação.
- **CapacitorHandler**: Deve permanecer global para lidar com eventos de hardware/nativo em qualquer tela no mobile.

## 3. Conclusão e Próximos Passos
A principal oportunidade de otimização identificada é a movimentação do `NotificationProvider` para o escopo autenticado. Isso reduzirá a carga cognitiva e o processamento em rotas públicas e isolará o efeito do polling apenas para onde ele é necessário.
