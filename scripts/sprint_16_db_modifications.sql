-- =====================================================================
-- Sprint 16: Database Optimizations (Indexing & Cascading Deletes)
-- =====================================================================
-- Instructions: Run this script in the Supabase SQL Editor to optimize
-- search query performance and ensure safe deletion of user records.
-- =====================================================================

BEGIN;

-- 1. Database Indexing
-- Optimizes general queries on primary lookup paths (such as the admin panel and dashboard)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

CREATE INDEX IF NOT EXISTS idx_study_sessions_username ON public.study_sessions(username);
CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON public.study_sessions(date);

CREATE INDEX IF NOT EXISTS idx_messages_username ON public.messages(username);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

CREATE INDEX IF NOT EXISTS idx_activity_submissions_username ON public.activity_submissions(username);
CREATE INDEX IF NOT EXISTS idx_user_flashcard_progress_username ON public.user_flashcard_progress(username);
CREATE INDEX IF NOT EXISTS idx_premium_purchases_username ON public.premium_purchases(username);
CREATE INDEX IF NOT EXISTS idx_orders_username ON public.orders(username);


-- 2. Cascading Deletes (ON DELETE CASCADE)
-- Dynamically drops any foreign key constraints referencing the 'users' table and
-- recreates them with ON DELETE CASCADE to prevent foreign key constraint violations
-- (Postgrest 23503 error) when deleting students or buyers.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            tc.constraint_name,
            ccu.table_name AS referenced_table_name,
            ccu.column_name AS referenced_column_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND ccu.table_name = 'users'
            AND tc.table_schema = 'public'
    ) LOOP
        -- Exclui a constraint existente
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        
        -- Recria a constraint com ON DELETE CASCADE
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' ADD CONSTRAINT ' || quote_ident(r.constraint_name) || 
                ' FOREIGN KEY (' || quote_ident(r.column_name) || ') REFERENCES public.users(' || quote_ident(r.referenced_column_name) || ') ON DELETE CASCADE';
                
        RAISE NOTICE 'Recreated constraint % on table % with ON DELETE CASCADE', r.constraint_name, r.table_name;
    END LOOP;
END $$;

COMMIT;
