-- Documentation comment for the FICIA timesheet table.
--
-- DEFECT DB-01, AND WHY THIS IS THE FIX.
--
-- This migration was one unconditional statement:
--
--   COMMENT ON TABLE public.ficia_time_entries IS '…';
--
-- No migration in this repository creates `ficia_time_entries`. The table
-- exists in the hosted project — created outside the tracked migration set —
-- so the statement succeeds there and fails everywhere else. The consequence
-- was concrete: THIS MIGRATION SET COULD NOT REBUILD THE DATABASE FROM
-- SCRATCH. A fresh environment failed here and no later migration ran.
--
-- Two fixes were considered before and both rejected, correctly:
--
--   1. Reconstruct the table from `src/integrations/supabase/types.ts`. Those
--      generated types carry columns but no RLS policies, GRANTs, defaults or
--      foreign-key actions. Recreating a multi-tenant timesheet table without
--      its row-level security would turn a loud build failure into a silent
--      cross-tenant data exposure.
--   2. Delete this migration. Its name is in the applied-migrations ledger of
--      the hosted project; removing it rewrites history the database recorded.
--
-- A third option now exists that did not before: FICIA has been removed from
-- the product. `ficia_time_entries` belongs to a workspace that no longer
-- ships, so this repository has no reason to require the table to exist — only
-- to leave the comment untouched wherever it already applies.
--
-- So the statement is made conditional. On the hosted database the table is
-- present and the comment applies exactly as before; on a fresh database the
-- table is absent and this is a no-op. The migration set rebuilds from zero,
-- and no table is created without its policies.

DO $$
BEGIN
  IF to_regclass('public.ficia_time_entries') IS NOT NULL THEN
    COMMENT ON TABLE public.ficia_time_entries IS 'FICIA timesheet & attendance entries.';
  END IF;
END
$$;
