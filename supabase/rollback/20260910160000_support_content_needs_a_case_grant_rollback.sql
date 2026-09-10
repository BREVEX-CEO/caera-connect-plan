-- Reverses 20260910160000_support_content_needs_a_case_grant.sql.
--
-- The access events are the record of who read which customer's words. They are
-- NOT dropped here: an audit trail that disappears when a feature is rolled
-- back is not an audit trail. The table is left in place, readable, and only
-- the enforcement is undone — which is the direction that loses nothing.

BEGIN;

-- The consolidated policies, back as they were: one per command, with the
-- admin's half returning to "is an admin".
DROP POLICY IF EXISTS "ocade_consolidated_select" ON public.ocade_support_messages;
CREATE POLICY "ocade_consolidated_select" ON public.ocade_support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ocade_support_tickets ticket
      WHERE ticket.id = ticket_id AND ticket.user_id = (SELECT auth.uid())
    )
    OR private.ocade_is_support_admin()
  );

DROP POLICY IF EXISTS "ocade_consolidated_insert" ON public.ocade_support_messages;
CREATE POLICY "ocade_consolidated_insert" ON public.ocade_support_messages
  FOR INSERT TO authenticated WITH CHECK (
    (
      author_id = (SELECT auth.uid()) AND author_role = 'customer' AND EXISTS (
        SELECT 1 FROM public.ocade_support_tickets ticket
        WHERE ticket.id = ticket_id AND ticket.user_id = (SELECT auth.uid())
          AND ticket.status <> 'closed'
      )
    )
    OR (
      author_id = (SELECT auth.uid()) AND author_role = 'support'
      AND private.ocade_is_support_admin()
    )
  );

DROP FUNCTION IF EXISTS public.ocade_read_support_case(UUID);
DROP FUNCTION IF EXISTS public.ocade_close_support_case(UUID);
DROP FUNCTION IF EXISTS public.ocade_open_support_case(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.ocade_support_grant_active(UUID);

/*
 * The grants themselves go; the events they produced stay.
 *
 * Every foreign key OUT of the event log goes with them — to the grant, to the
 * ticket, to the admin — so the log becomes a plain record of ids and times
 * that depends on nothing. That is what lets it survive: a row that still
 * points at `ocade_support_tickets` would block the earlier migration's own
 * rollback from dropping that table, and an audit trail that forces the
 * rollback below it to fail is not one anybody can keep.
 */
ALTER TABLE public.ocade_support_access_events
  DROP CONSTRAINT IF EXISTS ocade_support_access_events_grant_id_fkey,
  DROP CONSTRAINT IF EXISTS ocade_support_access_events_ticket_id_fkey,
  DROP CONSTRAINT IF EXISTS ocade_support_access_events_admin_id_fkey;
DROP TABLE IF EXISTS public.ocade_support_grants;

COMMIT;
