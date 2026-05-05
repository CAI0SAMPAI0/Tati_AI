-- Migration 017 - Add file_url to modules table
ALTER TABLE modules ADD COLUMN IF NOT EXISTS file_url TEXT;
