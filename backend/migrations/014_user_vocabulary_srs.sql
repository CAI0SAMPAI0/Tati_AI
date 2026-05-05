-- ═══════════════════════════════════════════════════════════════
-- Migração 014 - Tabela de Vocabulário Espaçado (SRS)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    word TEXT NOT NULL,
    definition TEXT,
    example_sentence TEXT,
    
    -- SRS Fields (SuperMemo-2 based)
    easiness_factor FLOAT DEFAULT 2.5,
    interval INTEGER DEFAULT 0, -- em dias
    repetitions INTEGER DEFAULT 0,
    next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    last_score INTEGER, -- 0-5
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vocab_username_next ON user_vocabulary(username, next_review);
CREATE INDEX IF NOT EXISTS idx_vocab_word ON user_vocabulary(username, word);

COMMENT ON TABLE user_vocabulary IS 'Armazena o vocabulário pessoal do aluno com lógica de repetição espaçada.';
