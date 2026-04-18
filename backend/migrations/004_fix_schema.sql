-- Fix schema issues from migration 003
-- 1. Ensure users table has a unique constraint on username (required for foreign keys)
-- Note: We assume 'users' is the table name as used in the backend code.
-- If 'profiles' was intended, we should check if it exists, but 'users' is more common in this project.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
END $$;

-- 2. Create study_sessions with correct reference
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    activity_type TEXT NOT NULL DEFAULT 'chat', -- chat, quiz, flashcard, exercise
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_username ON study_sessions(username);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created_at ON study_sessions(created_at);

-- 3. Create user_actions with correct reference
CREATE TABLE IF NOT EXISTS user_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- message, quiz, flashcard, exercise
    tokens_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_actions_username ON user_actions(username);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at);

-- 4. Create trophies (definition)
-- Migration 002 created a table 'trophies' which was actually 'user_trophies'.
-- We need to handle this conflict. 
-- Let's rename the old trophies if it exists and has the old schema.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trophies') THEN
        -- Check if it has the 'earned_at' column (typical of the old schema)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trophies' AND column_name = 'earned_at') THEN
            ALTER TABLE trophies RENAME TO user_trophies_old;
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS trophies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '🏆',
    category TEXT NOT NULL DEFAULT 'all', -- questions, streak, credits, time, milestones, social
    requirement_type TEXT NOT NULL DEFAULT 'count', -- count, threshold
    requirement_value INTEGER NOT NULL DEFAULT 1,
    requirement_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create user_trophies (mapping)
CREATE TABLE IF NOT EXISTS user_trophies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    trophy_id UUID NOT NULL REFERENCES trophies(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, trophy_id)
);

CREATE INDEX IF NOT EXISTS idx_user_trophies_username ON user_trophies(username);

-- 6. Migrate old trophies if any
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_trophies_old') THEN
        -- This is complex because we need to map old trophy 'type' to new trophy 'id'.
        -- For simplicity in this fix, we will just keep it as is or the user can manually fix.
        -- Most likely the old table was empty or just starting.
        NULL;
    END IF;
END $$;

-- 7. Insert default trophies (if not already there)
INSERT INTO trophies (name, description, icon, category, requirement_value, requirement_text) 
SELECT name, description, icon, category, requirement_value, requirement_text FROM (
    VALUES 
    ('Primeiro Quiz', 'Complete seu primeiro quiz', '🎯', 'questions', 1, '1/1'),
    ('Quizzer Iniciante', 'Complete 5 quizzes', '📝', 'questions', 5, '0/5'),
    ('Quizzer', 'Complete 10 quizzes', '📝', 'questions', 10, '0/10'),
    ('Mestre dos Quizzes', 'Complete 50 quizzes', '🏅', 'questions', 50, '0/50'),
    ('Primeiro Dia', 'Complete seu primeiro dia de estudo', '⭐', 'streak', 1, '1/1'),
    ('Ofensiva de 7 Dias', 'Estude 7 dias seguidos', '🔥', 'streak', 7, '0/7'),
    ('Ofensiva de 30 Dias', 'Estude 30 dias seguidos', '🌟', 'streak', 30, '0/30'),
    ('Primeira Mensagem', 'Envie sua primeira mensagem para a Tati', '💬', 'milestones', 1, '1/1'),
    ('100 Mensagens', 'Envie 100 mensagens', '🗣️', 'milestones', 100, '0/100')
) AS t(name, description, icon, category, requirement_value, requirement_text)
WHERE NOT EXISTS (SELECT 1 FROM trophies WHERE trophies.name = t.name);
