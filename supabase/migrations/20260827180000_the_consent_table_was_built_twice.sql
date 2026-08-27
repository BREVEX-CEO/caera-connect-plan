-- THE CONSENT TABLE WAS BUILT TWICE, AND BOTH BUILDS ARE STILL RUNNING.
--
-- `legal_consent_receipts` is written on every signup and read whenever the
-- consent record is shown, so it is one of the few tables on the critical path
-- of becoming a user. Two overlapping migrations created it, and Postgres kept
-- everything both of them asked for:
--
--   * two INSERT policies for `authenticated` saying the same thing, so every
--     consent write evaluates both;
--   * two btree indexes on exactly (user_id, accepted_at DESC), so every write
--     maintains both and the planner picks one at random;
--   * `auth.uid()` written bare in two policies, which Postgres re-evaluates
--     PER ROW rather than once per statement.
--
-- The last one is the reason this is worth a migration rather than a note. A
-- bare `auth.uid()` in a policy is a function call the planner cannot hoist, so
-- the cost scales with rows examined instead of rows returned. Wrapping it in a
-- scalar subquery — `(select auth.uid())` — makes it an InitPlan evaluated once.
-- These two policies were the last two in the schema still written the slow
-- way; the other 160 already use the fast form.
--
-- Nothing here changes who can see or write what. Every policy below permits
-- exactly what its predecessor permitted.

BEGIN;

-- One INSERT policy, not two. `Users record their own consent` already uses the
-- hoisted form and is kept; its duplicate is dropped.
DROP POLICY IF EXISTS "Users record their own consent receipts" ON public.legal_consent_receipts;

-- Same rule, evaluated once per statement instead of once per row.
DROP POLICY IF EXISTS "Users read their own consent receipts" ON public.legal_consent_receipts;
CREATE POLICY "Users read their own consent receipts"
  ON public.legal_consent_receipts
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Identical to legal_consent_receipts_user_accepted_idx. Dropping the one whose
-- name does not follow the table's own convention.
DROP INDEX IF EXISTS public.idx_legal_consent_receipts_user;

COMMIT;
