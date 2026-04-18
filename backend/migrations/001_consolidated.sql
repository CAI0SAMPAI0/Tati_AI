-- ═══════════════════════════════════════════════════════════════
-- Migrations Consolidadas - Teacher Tati
-- Executar no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Streak Data
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_data JSONB DEFAULT '{"current_streak": 0, "longest_streak": 0, "last_study_date": null, "streak_frozen": false, "total_study_days": 0, "study_dates": []}'::jsonb;

-- 2. Audio persistence
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_b64 TEXT;

-- 3. Updated at timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. Vocabulary notebook
ALTER TABLE users ADD COLUMN IF NOT EXISTS vocabulary JSONB DEFAULT '[]'::jsonb;

-- 5. Study goals
ALTER TABLE users ADD COLUMN IF NOT EXISTS study_goals JSONB DEFAULT '{"goals": []}'::jsonb;

-- 6. XP System
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_data JSONB DEFAULT '{"xp": 0, "level": "A1", "level_progress": 0, "xp_to_next": 500, "milestones": []}'::jsonb;

-- 7. Pronunciation challenges
ALTER TABLE users ADD COLUMN IF NOT EXISTS pronunciation_challenges JSONB DEFAULT '[]'::jsonb;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_streak ON users USING GIN (streak_data);
CREATE INDEX IF NOT EXISTS idx_users_vocabulary ON users USING GIN (vocabulary);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users USING GIN (xp_data);
CREATE INDEX IF NOT EXISTS idx_users_goals ON users USING GIN (study_goals);

-- Comentários
COMMENT ON COLUMN users.streak_data IS 'Dados de streak: current_streak, longest_streak, study_dates, etc.';
COMMENT ON COLUMN messages.audio_b64 IS 'Áudio da mensagem em base64 para persistência e replay';
COMMENT ON COLUMN users.vocabulary IS 'Caderno de vocabulário pessoal do aluno';
COMMENT ON COLUMN users.study_goals IS 'Metas de estudo personalizadas';
COMMENT ON COLUMN users.xp_data IS 'Sistema de XP e níveis (A1-C2)';
COMMENT ON COLUMN users.pronunciation_challenges IS 'Histórico de tentativas de pronúncia';
