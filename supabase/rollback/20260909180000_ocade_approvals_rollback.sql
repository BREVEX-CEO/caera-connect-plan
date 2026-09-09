-- Reverses 20260909180000_ocade_approvals.sql.
--
-- DESTRUCTIVE: dropping the table discards every approval, including decided
-- ones — the record of what a person was asked and what they answered. Run this
-- only to undo the migration on a database that has not yet raised any.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_expire_due_approvals();
DROP FUNCTION IF EXISTS public.ocade_decide_approval(UUID, TEXT, UUID);
DROP TABLE IF EXISTS public.ocade_approvals;

COMMIT;
