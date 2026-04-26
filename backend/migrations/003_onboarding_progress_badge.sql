-- ═══════════════════════════════════════════════════════════════
-- Migração 003 — Onboarding flag e suporte ao badge de progresso
-- ═══════════════════════════════════════════════════════════════
-- Executar no Supabase SQL Editor

-- 1. A flag has_seen_onboarding é salva dentro do JSONB profile
--    já existente na tabela users. Nenhuma coluna nova necessária.
--    Apenas garante que o campo profile existe como JSONB.

ALTER TABLE users
  ALTER COLUMN profile SET DEFAULT '{}'::jsonb;

-- 2. Índice para acelerar busca do campo profile (já deve existir via GIN)
CREATE INDEX IF NOT EXISTS idx_users_profile_gin
  ON users USING gin(profile);

-- 3. Índice para mensagens por data (acelera o daily-summary do badge)
CREATE INDEX IF NOT EXISTS idx_messages_username_role_date
  ON messages(username, role, created_at DESC);