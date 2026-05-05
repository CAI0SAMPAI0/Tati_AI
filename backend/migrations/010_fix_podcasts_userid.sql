-- Atualização da Migration 010: Ajuste de chave estrangeira
-- Muda user_id de UUID para TEXT para aceitar o username.

-- Remove a coluna antiga e cria a nova (ou altera se possível)
ALTER TABLE podcasts DROP COLUMN IF EXISTS user_id;
ALTER TABLE podcasts ADD COLUMN user_id TEXT REFERENCES users(username) ON DELETE CASCADE;

-- Recria os índices e políticas
CREATE INDEX IF NOT EXISTS idx_podcasts_user_id ON podcasts(user_id);

-- Atualiza as políticas de RLS
DROP POLICY IF EXISTS "Allow select own podcasts" ON podcasts;
CREATE POLICY "Allow select own podcasts" ON podcasts
    FOR SELECT USING (auth.jwt() ->> 'email' = (SELECT email FROM users WHERE username = user_id));
