-- Migration 016 - Add ai_prompt to modules table
ALTER TABLE modules ADD COLUMN IF NOT EXISTS ai_prompt TEXT;
