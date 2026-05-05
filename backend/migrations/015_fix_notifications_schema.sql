-- ═══════════════════════════════════════════════════════════════
-- Migração 015 - Ajuste de Schema Notificações (category e body)
-- ═══════════════════════════════════════════════════════════════

-- 1. Renomeia 'message' para 'body' para seguir o padrão do NotificationService
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='message') THEN
        ALTER TABLE notifications RENAME COLUMN message TO body;
    END IF;
END $$;

-- 2. Renomeia 'type' para 'category' para seguir o padrão do NotificationService
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') THEN
        ALTER TABLE notifications RENAME COLUMN type TO category;
    END IF;
END $$;

-- 3. Garante que 'read' seja 'is_read' para consistência (Opcional, mas recomendado)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read') THEN
        ALTER TABLE notifications RENAME COLUMN read TO is_read;
    END IF;
END $$;

COMMENT ON TABLE notifications IS 'Sistema de notificações internas do app atualizado para a Sprint 8.';
