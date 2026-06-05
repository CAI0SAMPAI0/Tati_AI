-- Migração CEFR: padroniza níveis legados para códigos A1–C2
-- Executar no Supabase SQL Editor (PRD Sprint 1)
-- Regra: Business English → C1
--
-- Tabelas usadas pelo backend:
--   users.level, simulations.difficulty, modules.level,
--   cefr_flashcards.level, podcasts.level

BEGIN;

-- ── users (obrigatório) ──────────────────────────────────────────────
UPDATE users SET level = 'A1'
WHERE lower(trim(level)) IN ('beginner', 'iniciante');

UPDATE users SET level = 'A2'
WHERE lower(trim(level)) IN (
  'pre-intermediate', 'pre intermediate', 'pre_intermediate',
  'pre-intermediario', 'pre intermediario', 'elementary'
);

UPDATE users SET level = 'B1'
WHERE lower(trim(level)) IN ('intermediate', 'intermediario', 'intermediário');

UPDATE users SET level = 'B2'
WHERE lower(trim(level)) IN (
  'upper-intermediate', 'upper intermediate', 'upper_intermediate',
  'intermediario superior', 'intermediário superior'
);

UPDATE users SET level = 'C1'
WHERE lower(trim(level)) IN (
  'advanced', 'avancado', 'avançado',
  'business english', 'business', 'ingles para negocios'
);

UPDATE users SET level = 'C2'
WHERE lower(trim(level)) IN ('mastery', 'proficiency', 'dominio total');

UPDATE users SET level = upper(trim(level))
WHERE upper(trim(level)) IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- ── simulations (opcional) ─────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'simulations'
  ) THEN
    UPDATE simulations SET difficulty = 'C1'
    WHERE lower(trim(difficulty)) IN ('business english', 'business', 'advanced', 'avancado', 'avançado');

    UPDATE simulations SET difficulty = 'A1'
    WHERE lower(trim(difficulty)) IN ('beginner', 'iniciante');

    UPDATE simulations SET difficulty = 'A2'
    WHERE lower(trim(difficulty)) IN ('pre-intermediate', 'pre intermediate', 'pre_intermediate');

    UPDATE simulations SET difficulty = 'B1'
    WHERE lower(trim(difficulty)) IN ('intermediate', 'intermediario', 'intermediário');

    UPDATE simulations SET difficulty = 'B2'
    WHERE lower(trim(difficulty)) IN ('upper-intermediate', 'upper intermediate', 'upper_intermediate');
  END IF;
END $$;

-- ── cefr_flashcards (opcional — substitui flashcard_decks inexistente) ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cefr_flashcards'
  ) THEN
    UPDATE cefr_flashcards SET level = 'C1'
    WHERE lower(trim(level)) IN ('business english', 'business', 'advanced', 'avancado');

    UPDATE cefr_flashcards SET level = 'A1'
    WHERE lower(trim(level)) IN ('beginner', 'iniciante');

    UPDATE cefr_flashcards SET level = 'A2'
    WHERE lower(trim(level)) IN ('pre-intermediate', 'pre intermediate');

    UPDATE cefr_flashcards SET level = 'B1'
    WHERE lower(trim(level)) IN ('intermediate', 'intermediario');

    UPDATE cefr_flashcards SET level = upper(trim(level))
    WHERE upper(trim(level)) IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
  END IF;
END $$;

-- ── modules (opcional) ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'modules'
  ) THEN
    UPDATE modules SET level = 'C1'
    WHERE lower(trim(level)) IN ('business english', 'business', 'advanced', 'avancado');

    UPDATE modules SET level = 'A1'
    WHERE lower(trim(level)) IN ('beginner', 'iniciante');

    UPDATE modules SET level = 'A2'
    WHERE lower(trim(level)) IN ('pre-intermediate', 'pre intermediate');

    UPDATE modules SET level = 'B1'
    WHERE lower(trim(level)) IN ('intermediate', 'intermediario');

    UPDATE modules SET level = upper(trim(level))
    WHERE upper(trim(level)) IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
  END IF;
END $$;

-- ── podcasts (opcional) ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'podcasts'
  ) THEN
    UPDATE podcasts SET level = 'C1'
    WHERE lower(trim(level)) IN ('business english', 'business', 'advanced', 'avancado');

    UPDATE podcasts SET level = 'A1'
    WHERE lower(trim(level)) IN ('beginner', 'iniciante');

    UPDATE podcasts SET level = 'A2'
    WHERE lower(trim(level)) IN ('pre-intermediate', 'pre intermediate');

    UPDATE podcasts SET level = 'B1'
    WHERE lower(trim(level)) IN ('intermediate', 'intermediario');

    UPDATE podcasts SET level = upper(trim(level))
    WHERE upper(trim(level)) IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
  END IF;
END $$;

COMMIT;

-- Verificação pós-migração:
-- SELECT level, count(*) FROM users GROUP BY level ORDER BY level;
-- SELECT difficulty, count(*) FROM simulations GROUP BY difficulty ORDER BY difficulty;
