-- ═══════════════════════════════════════════════════════════════
-- Migração 006 - Isolamento de exercícios e status de submissões
-- ═══════════════════════════════════════════════════════════════

-- 1. Garantir que a tabela quizzes tem a coluna username para isolamento
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'quizzes' AND COLUMN_NAME = 'username'
    ) THEN
        ALTER TABLE quizzes ADD COLUMN username TEXT REFERENCES users(username) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quizzes_username ON quizzes(username);

-- 2. Tabela unificada para tentativas de exercícios e erros
CREATE TABLE IF NOT EXISTS user_exercise_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    exercise_id UUID, -- Referência opcional se houver uma tabela de exercícios fixa
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

CREATE INDEX IF NOT EXISTS idx_user_exercise_attempts_username ON user_exercise_attempts(username);
CREATE INDEX IF NOT EXISTS idx_user_exercise_attempts_status ON user_exercise_attempts(status);
CREATE INDEX IF NOT EXISTS idx_user_exercise_attempts_is_correct ON user_exercise_attempts(is_correct);

-- 3. Se a tabela activity_submissions existir, vamos migrar os dados (opcional/best effort)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_submissions') THEN
        INSERT INTO user_exercise_attempts (id, username, module_id, activity_type, student_answer, status, feedback, score, created_at)
        SELECT id, username, module_id::uuid, activity_type, student_answer, status, COALESCE(teacher_feedback, ai_feedback), score, created_at
        FROM activity_submissions
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 4. Comentários
COMMENT ON TABLE user_exercise_attempts IS 'Rastreia todas as tentativas de exercícios dos alunos para isolamento de erros e progresso.';
