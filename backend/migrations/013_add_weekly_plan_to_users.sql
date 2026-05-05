-- ═══════════════════════════════════════════════════════════════
-- Migração 013 - Adiciona Coluna de Plano Semanal Inteligente
-- ═══════════════════════════════════════════════════════════════

-- 1. Adicionar coluna weekly_plan à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_plan JSONB DEFAULT NULL;

-- 2. Comentário explicativo
COMMENT ON COLUMN users.weekly_plan IS 'Armazena o plano de estudos semanal gerado por IA, incluindo tópicos e status de conclusão.';

-- 3. Índice para busca (opcional, já que é JSONB e buscado por username)
-- No caso do users, a busca é primariamente pelo ID/Username, então o índice na tabela já cobre a performance.
