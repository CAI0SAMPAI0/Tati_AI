# frontend Contract Map (Legado -> Next.js)

## Base de integração
- API HTTP: `NEXT_PUBLIC_API_BASE_URL` (fallback `https://tatiai-production.up.railway.app`)
- WS Chat: `NEXT_PUBLIC_WS_BASE_URL` (fallback `wss://tatiai-production.up.railway.app`)
- Auth storage legado-compatível: `localStorage.token`, `localStorage.user`, `localStorage.refresh_token`
- Idioma: `localStorage.tati_lang` enviado como header `Accept-Language`

## Contratos de autenticação
- `POST /auth/login` -> `{ access_token, user }`
- `POST /auth/google` -> `{ access_token, user }`
- `POST /auth/register` -> `user`
- `POST /auth/forgot-password` -> `{ message? | detail? }`
- `GET /profile` -> `user` atualizado para rehidratação de sessão

## Contratos de chat (HTTP)
- `GET /chat/conversations` -> lista de conversas
- `POST /chat/conversations` -> conversa criada
- `DELETE /chat/conversations/{id}` -> remoção
- `GET /chat/conversations/{id}/messages` -> histórico
- `GET /chat/conversations/{id}/summary?lang={locale}` -> resumo
- `POST /chat/download_report` -> blob/pdf
- `POST /chat/tts` -> áudio base64

## Contrato WebSocket de chat
- Endpoint: `/chat/ws`
- Auth: subprotocol `["access_token", "<token>"]`
- Incoming suportado: `pong`, `transcription`, `stream_start`, `stream_token`, `stream_end`, `audio_response`, `error`
- Outgoing suportado: `text`, `audio`, `file`, `ping`
- Reconexão: backoff exponencial com limite superior

## Contratos de permissões/pagamento
- `GET /users/permissions/access` -> flags de acesso (`full_access`, `free_mode`, `can_access_activities`, `can_access_dashboard`, `free_messages_remaining`)
- `GET /payments/status` -> status de assinatura para badges/paywall/receipt

## Query params equivalentes
- Chat: `conv_id` (compatível com legado) e fallback para `id`
- Voice: `conv_id`
- Receipt: `receipt` (flags de exibição pós-pagamento)

## Regras de compatibilidade aplicadas
- Retry de `401` no máximo 1x por request (sem loop)
- Handler central para logout em `401` persistente
- Sem cache manual de dados sensíveis em service worker
- Sem chamadas HTTP duplicadas em componentes críticos (uso de Query Client)
