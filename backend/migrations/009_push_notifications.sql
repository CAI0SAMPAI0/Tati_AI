-- ═══════════════════════════════════════════════════════════════════════
-- Migração 009 - Push Subscriptions e payload de notificações
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (username, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_username
    ON push_subscriptions(username);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
    ON push_subscriptions(is_active);

COMMENT ON TABLE push_subscriptions IS 'Subscriptions Web Push por usuário.';
