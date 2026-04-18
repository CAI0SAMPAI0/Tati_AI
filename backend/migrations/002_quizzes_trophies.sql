-- ═══════════════════════════════════════════════════════════════
-- Migração 002 - Quizzes, Troféus e Simulações
-- ═══════════════════════════════════════════════════════════════

-- 1. Flag para separar simulações do histórico principal
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT FALSE;

-- 2. Tabela de Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Questões do Quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- ["A", "B", "C", "D"]
    correct_index INTEGER NOT NULL, -- 0-3
    explanation TEXT,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Progresso do Aluno nos Quizzes
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    module_id TEXT,
    score INTEGER NOT NULL, -- 0-100
    correct_q INTEGER NOT NULL,
    total_q INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, quiz_id)
);

-- 5. Troféus e Conquistas
CREATE TABLE IF NOT EXISTS trophies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    type TEXT NOT NULL, -- ex: 'perfect_score', 'streak_7', 'completed_module_1'
    title TEXT NOT NULL,
    icon TEXT NOT NULL, -- emoji ou URL
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_quizzes_module ON quizzes(module_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(username);
CREATE INDEX IF NOT EXISTS idx_trophies_user ON trophies(username);
CREATE INDEX IF NOT EXISTS idx_conv_simulation ON conversations(is_simulation);
