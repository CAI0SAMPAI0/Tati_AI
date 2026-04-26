-- ═══════════════════════════════════════════════════════════════
-- Migração 008 - Corrigindo Tabelas e Troféu Perfectionist
-- ═══════════════════════════════════════════════════════════════

-- 1. Garantir que a tabela user_exercise_attempts existe (Fix PGRST205)
CREATE TABLE IF NOT EXISTS user_exercise_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    exercise_id UUID, 
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL DEFAULT 'exercise', -- quiz, exercise, flashcard
    student_answer TEXT,
    is_correct BOOLEAN,
    feedback TEXT,
    score INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, done, corrected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_exercise_attempts_username ON user_exercise_attempts(username);
CREATE INDEX IF NOT EXISTS idx_user_exercise_attempts_status ON user_exercise_attempts(status);

-- 2. Inserir o troféu Perfectionist usando WHERE NOT EXISTS (Evita erro 42P10)
INSERT INTO trophies (name, description, icon, category, requirement_value, requirement_text)
SELECT 'Perfectionist', 'Score 100% on 5 quizzes', '💎', 'questions', 5, '0/5'
WHERE NOT EXISTS (
    SELECT 1 FROM trophies WHERE name = 'Perfectionist'
);
