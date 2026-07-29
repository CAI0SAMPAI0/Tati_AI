-- Games table: stores WordWall game links with multi-level assignment
CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  wordwall_url TEXT NOT NULL,
  levels TEXT[] DEFAULT ARRAY['all']::TEXT[],
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Staff can manage all games
CREATE POLICY "Staff can manage games"
  ON games FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.username = auth.uid()::text
      AND users.role IN ('admin', 'professor', 'professora', 'programador', 'Tatiana', 'Tati', 'Professora', 'Programador')
    )
  );

-- Authenticated users can read published games
CREATE POLICY "Authenticated can read published games"
  ON games FOR SELECT
  USING (
    is_published = true
    AND auth.role() = 'authenticated'
  );
