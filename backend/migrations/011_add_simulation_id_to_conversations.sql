-- Migration 011: Adicionar simulation_id à tabela conversations
-- Executar no SQL Editor do Supabase para habilitar o vínculo completo das simulações

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS simulation_id UUID REFERENCES simulations(id) ON DELETE SET NULL;

COMMENT ON COLUMN conversations.simulation_id IS 'ID da simulação vinculada a esta conversa';
