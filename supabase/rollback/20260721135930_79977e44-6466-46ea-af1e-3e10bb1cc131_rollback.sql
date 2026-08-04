-- Rollback for 20260721135930 (activity_log self-clear-old policy). Idempotent.
BEGIN;
DROP POLICY IF EXISTS "Users can clear own old activity" ON public.activity_log;
COMMIT;
