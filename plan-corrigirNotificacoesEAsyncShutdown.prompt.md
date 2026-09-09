## Plano: Corrigir Notificações e Async Shutdown

Diagnosticar e corrigir os dois incidentes sem mascarar falhas de provedor: ligar explicitamente o dispatcher ao serviço WhatsApp, tornar o resultado de cada canal observável, fechar clientes assíncronos no mesmo loop que os criou e cancelar tarefas do WebSocket no desligamento. Depois validar em ambiente equivalente à produção e publicar com smoke tests e monitoramento Sentry.

**Etapas principais**

1. Reproduzir as notificações com usuário de teste e verificar separadamente in-app, WhatsApp, e-mail, preferências e variáveis de ambiente.
2. Corrigir o dispatcher em `backend/apps/notifications/services.py`, usando `WahaWhatsAppService.send_message()` em vez de importar a view HTTP.
3. Ajustar os resultados por canal para diferenciar envio, falta de configuração, destinatário ausente e erro do provedor.
4. Validar Brevo, Resend, SMTP, remetente autorizado e `allow_email_notifications`.
5. Revisar o scheduler, Celery e processo de produção para evitar jobs duplicados ou não executados.
6. Fechar explicitamente todos os `AsyncGroq` em `backend/apps/chat/audio_service.py` e `backend/apps/chat/simulation_api.py`.
7. Remover o `asyncio.run()` de caminhos ASGI ou isolá-lo corretamente em executor.
8. Controlar, cancelar e aguardar as tasks do WebSocket em `backend/apps/chat/consumers.py`.
9. Revisar o shutdown em `backend/app/asgi.py`.
10. Adicionar testes para dispatcher, fallback de e-mail, fechamento de clientes assíncronos, cancelamento de tasks e shutdown do lifespan.
11. Validar com `manage.py check`, testes backend, build das imagens e smoke test real ou sandbox.
12. Publicar primeiro em staging/canário, observar Sentry e logs, executar uma notificação controlada e só então promover para produção.

**Critérios de conclusão**

- WhatsApp e e-mail chegam quando configurados.
- Falhas externas não interrompem nem mascaram o envio in-app.
- Não existem novos `NameError`, `Event loop is closed` ou `Task exception was never retrieved`.
- O ambiente publicado usa a mesma versão de Python e dependências validada nos testes.
- Pelo menos um ciclo agendado real ocorre sem duplicação ou falha silenciosa.
