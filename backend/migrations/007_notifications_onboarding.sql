-- ═══════════════════════════════════════════════════════════════
-- Migração 007 - Tabelas de Suporte (Notificações e Onboarding)
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabela de Notificações (Sino)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    type TEXT NOT NULL, -- welcome, correction, streak, ranking
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_username ON notifications(username);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- 2. Tabela de Onboarding
CREATE TABLE IF NOT EXISTS user_onboarding (
    username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    has_seen_onboarding BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Comentários
COMMENT ON TABLE notifications IS 'Sistema de notificações internas do app (sino no header).';
COMMENT ON TABLE user_onboarding IS 'Rastreia se o usuário já completou o tour inicial.';
