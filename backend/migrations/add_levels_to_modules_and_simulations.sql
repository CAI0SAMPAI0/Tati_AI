-- Migration: Adicionar coluna levels para suporte multi-level em flashcards e simulações
-- Execute no Supabase SQL Editor

-- Adicionar coluna levels na tabela modules (flashcards)
ALTER TABLE modules ADD COLUMN IF NOT EXISTS levels TEXT[] DEFAULT '{}';

-- Adicionar coluna levels na tabela simulations
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS levels TEXT[] DEFAULT '{}';

-- Criar índice GIN para buscas eficientes nos arrays
CREATE INDEX IF NOT EXISTS idx_modules_levels ON modules USING GIN (levels);
CREATE INDEX IF NOT EXISTS idx_simulations_levels ON simulations USING GIN (levels);
