-- Migração 003: Ranking, Troféus e Sessões de Estudo
-- Adiciona suporte para ranking de engajamento, troféus detalhados e sessões de estudo

-- ── Tabela: study_sessions (para tracking de tempo de estudo) ─────────────────
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL REFERENCES profiles(username) ON DELETE CASCADE,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    activity_type TEXT NOT NULL DEFAULT 'chat', -- chat, quiz, flashcard, exercise
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_username ON study_sessions(username);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created_at ON study_sessions(created_at);

-- ── Tabela: user_actions (para ranking de engajamento) ────────────────────────
CREATE TABLE IF NOT EXISTS user_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL REFERENCES profiles(username) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- message, quiz, flashcard, exercise
    tokens_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_actions_username ON user_actions(username);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_actions_type ON user_actions(action_type);

-- ── Tabela: trophies (definição dos troféus disponíveis) ──────────────────────
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

-- ── Tabela: user_trophies (troféus conquistados pelos usuários) ───────────────
CREATE TABLE IF NOT EXISTS user_trophies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL REFERENCES profiles(username) ON DELETE CASCADE,
    trophy_id UUID NOT NULL REFERENCES trophies(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, trophy_id)
);

CREATE INDEX IF NOT EXISTS idx_user_trophies_username ON user_trophies(username);

-- ── Inserir troféus padrão ────────────────────────────────────────────────────
INSERT INTO trophies (name, description, icon, category, requirement_value, requirement_text) VALUES
-- Perguntas
('Primeiro Quiz', 'Complete seu primeiro quiz', '🎯', 'questions', 1, '1/1'),
('Quizzer Iniciante', 'Complete 5 quizzes', '📝', 'questions', 5, '0/5'),
('Quizzer', 'Complete 10 quizzes', '📝', 'questions', 10, '0/10'),
('Quizzer Avançado', 'Complete 25 quizzes', '', 'questions', 25, '0/25'),
('Mestre dos Quizzes', 'Complete 50 quizzes', '🏅', 'questions', 50, '0/50'),
('Mestre Supremo', 'Complete 100 quizzes', '👑', 'questions', 100, '0/100'),

-- Ofensiva
('Primeiro Dia', 'Complete seu primeiro dia de estudo', '⭐', 'streak', 1, '1/1'),
('Ofensiva de 3 Dias', 'Estude 3 dias seguidos', '🔥', 'streak', 3, '0/3'),
('Ofensiva de 7 Dias', 'Estude 7 dias seguidos', '🔥', 'streak', 7, '0/7'),
('Ofensiva de 14 Dias', 'Estude 14 dias seguidos', '💪', 'streak', 14, '0/14'),
('Ofensiva de 30 Dias', 'Estude 30 dias seguidos', '🌟', 'streak', 30, '0/30'),
('Ofensiva de 60 Dias', 'Estude 60 dias seguidos', '🚀', 'streak', 60, '0/60'),
('Ofensiva de 100 Dias', 'Estude 100 dias seguidos', '💎', 'streak', 100, '0/100'),
('Ofensiva de 365 Dias', 'Estude 365 dias seguidos', '👑', 'streak', 365, '0/365'),

-- Créditos
('Primeiro Crédito', 'Ganhe seu primeiro crédito', '💰', 'credits', 1, '1/1'),
('Economizador', 'Acumule 10 créditos', '💰', 'credits', 10, '0/10'),
('Colecionador', 'Acumule 50 créditos', '💎', 'credits', 50, '0/50'),
('Rico', 'Acumule 100 créditos', '💎', 'credits', 100, '0/100'),

-- Tempo Economizado
('Primeira Hora', 'Economize 1 hora de estudo', '⏰', 'time', 1, '0/1'),
('Economizador', 'Economize 5 horas de estudo', '⏰', 'time', 5, '0/5'),
('Mestre do Tempo', 'Economize 10 horas de estudo', '⏳', 'time', 10, '0/10'),
('Tempo Supremo', 'Economize 50 horas de estudo', '⌛', 'time', 50, '0/50'),

-- Marcos Especiais
('Primeira Mensagem', 'Envie sua primeira mensagem para a Tati', '💬', 'milestones', 1, '1/1'),
('100 Mensagens', 'Envie 100 mensagens', '🗣️', 'milestones', 100, '0/100'),
('500 Mensagens', 'Envie 500 mensagens', '📢', 'milestones', 500, '0/500'),
('Primeira Simulação', 'Complete sua primeira simulação', '🎭', 'milestones', 1, '1/1'),

-- Social
('Social', 'Interaja com a comunidade', '🤝', 'social', 1, '1/1'),
('Popular', 'Envie 50 mensagens no chat', '🗣️', 'social', 50, '0/50'),
('Comunicador', 'Envie 200 mensagens no chat', '📣', 'social', 200, '0/200');

-- ── RLS Policies ──────────────────────────────────────────────────────────────

-- study_sessions
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver suas próprias sessões" ON study_sessions
    FOR SELECT USING (auth.uid()::text = username);
CREATE POLICY "Sistema pode inserir sessões" ON study_sessions
    FOR INSERT WITH CHECK (true);

-- user_actions
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver ações de todos (ranking)" ON user_actions
    FOR SELECT USING (true);
CREATE POLICY "Sistema pode inserir ações" ON user_actions
    FOR INSERT WITH CHECK (true);

-- trophies
ALTER TABLE trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos podem ver troféus" ON trophies
    FOR SELECT USING (true);

-- user_trophies
ALTER TABLE user_trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver seus troféus" ON user_trophies
    FOR SELECT USING (auth.uid()::text = username);
CREATE POLICY "Sistema pode inserir troféus" ON user_trophies
    FOR INSERT WITH CHECK (true);
