-- Reverses 20260909190000_ocade_tasks_and_comments.sql.
--
-- DESTRUCTIVE: dropping these discards every task and every comment written on
-- one. Comments go first because they reference tasks. Run this only to undo
-- the migration on a database that has not yet stored either.

BEGIN;

DROP TABLE IF EXISTS public.ocade_task_comments;
DROP TABLE IF EXISTS public.ocade_tasks;

COMMIT;
