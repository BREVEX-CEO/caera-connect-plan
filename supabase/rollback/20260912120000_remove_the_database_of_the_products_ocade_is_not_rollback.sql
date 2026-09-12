-- Rolling back the Phase 10 reduction.
--
-- THIS FILE DOES NOT RECREATE THE SEVENTY TABLES, AND SAYING SO IS THE POINT.
--
-- Every other migration here ships a rollback that genuinely reverses it,
-- because every other migration changes a shape. This one deletes data — the
-- rows of eleven retired products — and a rollback that produced seventy empty
-- tables with the right column names would restore nothing while LOOKING like a
-- restore. An operator reading "rolled back successfully" would believe their
-- data was back. It would not be.
--
-- WHAT TO DO INSTEAD, in the order a real recovery goes:
--
--   1. Restore the database from the point-in-time backup taken before this
--      migration ran. That is the only thing that returns the rows.
--   2. If only the SHAPE is wanted — to run an older build against a current
--      database — re-apply the migrations that created those tables. They are
--      all still in `supabase/migrations`, unchanged; none of them was edited
--      or deleted by this phase, precisely so this route exists.
--
-- WHAT THIS FILE DOES REVERSE is the part that is not a deletion: the
-- conversations policy this migration had to rewrite, because the old one
-- depended on the projects table and went with it. If the projects table is
-- restored by route 1 or 2, the policy below is the one that belongs with it.

BEGIN;

ALTER TABLE public.ocade_conversations
  ADD COLUMN IF NOT EXISTS project_id UUID;

DROP POLICY IF EXISTS own_conversations ON public.ocade_conversations;

/*
 * The August policy, restored: a conversation is the caller's, and a
 * conversation filed into a project must be filed into one of the caller's own.
 * The project check is written defensively so this file applies whether or not
 * `ocade_projects` has been restored — without it, a conversation may not be
 * filed anywhere, which fails closed.
 */
CREATE POLICY own_conversations ON public.ocade_conversations FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
          FROM information_schema.tables t
         WHERE t.table_schema = 'public'
           AND t.table_name = 'ocade_projects'
      )
    )
  );

COMMIT;
