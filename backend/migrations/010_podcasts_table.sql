-- Migration 010: Tabela de Podcasts
-- Permite armazenar podcasts globais e personalizados por usuário.

CREATE TABLE IF NOT EXISTS podcasts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL, -- A1, A2, B1, etc.
    thumbnail TEXT,
    embed_url TEXT NOT NULL,
    duration TEXT DEFAULT '--:--',
    category TEXT DEFAULT 'General',
    source_name TEXT DEFAULT 'YouTube',
    source_type TEXT DEFAULT 'youtube', -- youtube, spotify, etc.
    media_type TEXT DEFAULT 'video', -- video, audio
    external_url TEXT,
    transcript_segments JSONB DEFAULT '[]',
    has_full_transcript BOOLEAN DEFAULT false,
    theme_tags TEXT[] DEFAULT '{}',
    easy_words BOOLEAN DEFAULT false,
    
    -- Se user_id for NULL, o podcast é público (exibido para todos os níveis correspondentes).
    -- Se user_id tiver valor, é um podcast sugerido pela IA especificamente para aquele aluno.
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_podcasts_level ON podcasts(level);
CREATE INDEX IF NOT EXISTS idx_podcasts_user_id ON podcasts(user_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode ver podcasts globais (user_id IS NULL)
CREATE POLICY "Allow select global podcasts" ON podcasts
    FOR SELECT USING (user_id IS NULL);

-- Política: Usuário pode ver seus próprios podcasts personalizados
CREATE POLICY "Allow select own podcasts" ON podcasts
    FOR SELECT USING (auth.uid() = user_id);

-- Política: Serviço/Admin pode fazer tudo
CREATE POLICY "Allow service_role full access" ON podcasts
    FOR ALL USING (true) WITH CHECK (true);
