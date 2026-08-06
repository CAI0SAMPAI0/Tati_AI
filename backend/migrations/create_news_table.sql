-- News table: stores news/instagram/reels links with multi-level assignment
CREATE TABLE IF NOT EXISTS news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  url TEXT NOT NULL,
  description TEXT,
  levels TEXT[] DEFAULT ARRAY['all']::TEXT[],
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Staff can manage all news
CREATE POLICY "Staff can manage news"
  ON news FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.username = auth.uid()::text
      AND users.role IN ('admin', 'professor', 'professora', 'programador', 'Tatiana', 'Tati', 'Professora', 'Programador')
    )
  );

-- Authenticated users can read published news
CREATE POLICY "Authenticated can read published news"
  ON news FOR SELECT
  USING (
    is_published = true
    AND auth.role() = 'authenticated'
  );
