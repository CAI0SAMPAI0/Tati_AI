-- ═══════════════════════════════════════════════════════════════
-- Migração 012 - Tabela de Log de Erros do Aluno
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    incorrect_text TEXT NOT NULL,
    correct_text TEXT NOT NULL,
    category TEXT DEFAULT 'grammar', -- grammar, vocabulary, preposition, etc.
    explanation TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_errors_username ON user_errors(username);
CREATE INDEX IF NOT EXISTS idx_user_errors_category ON user_errors(category);
CREATE INDEX IF NOT EXISTS idx_user_errors_unresolved ON user_errors(username) WHERE is_resolved = FALSE;

-- Comentário
COMMENT ON TABLE user_errors IS 'Armazena erros específicos detectados durante as conversas para gerar exercícios personalizados.';
