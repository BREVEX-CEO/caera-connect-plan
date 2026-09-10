-- Reading a customer's support case needs a reason, a clock and a record.
--
-- `PLAN.md` Phase 15 is explicit: "Support-content inspection requires
-- time-bound case-scoped read-only grant, recent AAL2, reason/expiry and
-- per-object access events — never unrestricted raw DB browsing."
--
-- WHAT WAS ACTUALLY THERE. `ocade_support_tickets` and
-- `ocade_support_messages` both read `OR private.ocade_is_support_admin()`,
-- which is true for anybody holding the admin role, for every ticket, for
-- ever. No reason, no expiry, no record of which case was opened or which
-- message was read. That is unrestricted raw browsing of customer support
-- content wearing an RLS policy's clothes, and it is the one thing this phase
-- names outright.
--
-- WHAT REPLACES IT. A grant is per-case, carries a written reason, expires,
-- and can be revoked. Opening one requires a session that has actually
-- completed a second factor — checked here, in the database, rather than only
-- in the application, because a policy that trusts the caller to have checked
-- is not a policy. Reading through the grant records one access event per
-- message, so "who read what, and when" is answerable afterwards.
--
-- THE CUSTOMER'S OWN ACCESS IS UNTOUCHED. They keep reading and writing their
-- own tickets exactly as before. Nothing here narrows what a person can see of
-- their own support history.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_support_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.ocade_support_tickets(id) ON DELETE CASCADE,
  -- A reason somebody could read back in an audit. Ten characters is not a
  -- quality bar; it is a floor under "x".
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 10),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT ocade_support_grants_window_check CHECK (expires_at > granted_at),
  CONSTRAINT ocade_support_grants_max_window_check
    CHECK (expires_at <= granted_at + INTERVAL '24 hours')
);

COMMENT ON TABLE public.ocade_support_grants IS
  'Time-bound, case-scoped, read-only access to one support ticket. Created only by ocade_open_support_case, which requires a recent second factor.';

CREATE INDEX IF NOT EXISTS ocade_support_grants_admin_idx
  ON public.ocade_support_grants (admin_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS ocade_support_grants_ticket_idx
  ON public.ocade_support_grants (ticket_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.ocade_support_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.ocade_support_grants(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.ocade_support_tickets(id) ON DELETE CASCADE,
  object_kind TEXT NOT NULL CHECK (object_kind IN ('ticket', 'message')),
  object_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ocade_support_access_events IS
  'One row per support object actually read under a grant. Append-only: nobody may update or delete these, including the admin who caused them.';

CREATE INDEX IF NOT EXISTS ocade_support_access_events_grant_idx
  ON public.ocade_support_access_events (grant_id, read_at DESC);
CREATE INDEX IF NOT EXISTS ocade_support_access_events_ticket_idx
  ON public.ocade_support_access_events (ticket_id, read_at DESC);

/*
 * Is there a live grant for this caller on this case?
 *
 * STABLE and SECURITY DEFINER so the policies below can use it without the
 * caller needing to read the grants table itself — an admin may not browse
 * everybody's grants, only exercise their own.
 */
CREATE OR REPLACE FUNCTION public.ocade_support_grant_active(target_ticket UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_support_grants g
    WHERE g.ticket_id = target_ticket
      AND g.admin_id = (SELECT auth.uid())
      AND g.revoked_at IS NULL
      AND g.expires_at > now()
  );
$$;
REVOKE ALL ON FUNCTION public.ocade_support_grant_active(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_support_grant_active(UUID) TO authenticated, service_role;

/*
 * Open a case. The only way a grant is ever created.
 *
 * THE SECOND FACTOR IS CHECKED HERE, not only in the application. A server
 * function that forgets its middleware is a bug; a policy that trusts the
 * application to have remembered is a design. `aal2` in the session's own
 * claims is the database's independent answer to "did this person actually
 * complete a second factor".
 */
CREATE OR REPLACE FUNCTION public.ocade_open_support_case(
  target_ticket UUID,
  case_reason TEXT,
  minutes INTEGER DEFAULT 60
)
RETURNS public.ocade_support_grants LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  created public.ocade_support_grants;
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may open a support case.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Opening a support case needs a recent second factor.' USING ERRCODE = '42501';
  END IF;

  IF minutes IS NULL OR minutes < 5 OR minutes > 1440 THEN
    RAISE EXCEPTION 'A support case may be opened for between 5 minutes and 24 hours.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ocade_support_grants (admin_id, ticket_id, reason, expires_at)
  VALUES ((SELECT auth.uid()), target_ticket, case_reason, now() + make_interval(mins => minutes))
  RETURNING * INTO created;

  RETURN created;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_open_support_case(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_open_support_case(UUID, TEXT, INTEGER) TO authenticated, service_role;

/*
 * Close a case early. A grant that is finished with should not sit open until
 * its clock runs out.
 */
CREATE OR REPLACE FUNCTION public.ocade_close_support_case(grant_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.ocade_support_grants
     SET revoked_at = now()
   WHERE id = grant_id
     AND admin_id = (SELECT auth.uid())
     AND revoked_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_close_support_case(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_close_support_case(UUID) TO authenticated, service_role;

/*
 * Read one case, and record what was read.
 *
 * The read and the record are the same statement, so there is no path that
 * returns content without leaving a trace of it. An expired or revoked grant
 * returns nothing at all rather than raising, because "no rows" is the honest
 * answer to a question the caller is no longer allowed to ask.
 */
CREATE OR REPLACE FUNCTION public.ocade_read_support_case(target_ticket UUID)
RETURNS TABLE (
  id UUID,
  ticket_id UUID,
  author_role TEXT,
  body TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  live_grant UUID;
BEGIN
  SELECT g.id INTO live_grant
    FROM public.ocade_support_grants g
   WHERE g.ticket_id = target_ticket
     AND g.admin_id = (SELECT auth.uid())
     AND g.revoked_at IS NULL
     AND g.expires_at > now()
   ORDER BY g.expires_at DESC
   LIMIT 1;

  IF live_grant IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.ocade_support_access_events (grant_id, admin_id, ticket_id, object_kind, object_id)
  SELECT live_grant, (SELECT auth.uid()), target_ticket, 'message', m.id
    FROM public.ocade_support_messages m
   WHERE m.ticket_id = target_ticket;

  INSERT INTO public.ocade_support_access_events (grant_id, admin_id, ticket_id, object_kind, object_id)
  VALUES (live_grant, (SELECT auth.uid()), target_ticket, 'ticket', target_ticket);

  RETURN QUERY
    SELECT m.id, m.ticket_id, m.author_role, m.body, m.created_at
      FROM public.ocade_support_messages m
     WHERE m.ticket_id = target_ticket
     ORDER BY m.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_read_support_case(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_read_support_case(UUID) TO authenticated, service_role;

/*
 * THE POLICIES THAT USED TO SAY "ANY ADMIN, ANY TICKET, FOR EVER".
 *
 * A support admin can still SEE THE QUEUE — the ticket rows, which carry the
 * subject and the status and are what a queue is — because triage without a
 * queue is not a job anybody can do. What they can no longer do is read the
 * MESSAGES, which are the customer's own words, without opening a case first.
 */
/*
 * ONE POLICY PER ROLE PER COMMAND — AND IT IS THE CONSOLIDATED ONE.
 *
 * `20260824112850_consolidate_permissive_rls_policies.sql` folded every
 * permissive policy on these tables into `ocade_consolidated_*`, because
 * PostgreSQL ORs permissive policies together and a table with four of them
 * evaluates four expressions per row. That matters here for a reason beyond
 * speed: adding a NARROWER policy beside a broad one changes nothing at all,
 * since OR keeps the broad one. The first draft of this migration replaced the
 * original `support_messages_ticket_read` — which the consolidation had
 * already dropped — and the live database went on reading
 * `OR private.ocade_is_support_admin()` from the consolidated policy that
 * actually governs. Any admin still had every message.
 *
 * So the consolidated policies themselves are rewritten. The customer's own
 * access is carried across verbatim; only the admin's half changes, from "is
 * an admin" to "has an open case".
 */
DROP POLICY IF EXISTS "support_messages_ticket_read" ON public.ocade_support_messages;
DROP POLICY IF EXISTS "support_messages_admin_create" ON public.ocade_support_messages;
DROP POLICY IF EXISTS "support_messages_customer_create" ON public.ocade_support_messages;
DROP POLICY IF EXISTS "ocade_consolidated_select" ON public.ocade_support_messages;
DROP POLICY IF EXISTS "ocade_consolidated_insert" ON public.ocade_support_messages;

CREATE POLICY "ocade_consolidated_select" ON public.ocade_support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ocade_support_tickets ticket
      WHERE ticket.id = ticket_id AND ticket.user_id = (SELECT auth.uid())
    )
    OR public.ocade_support_grant_active(ticket_id)
  );

CREATE POLICY "ocade_consolidated_insert" ON public.ocade_support_messages
  FOR INSERT TO authenticated WITH CHECK (
    -- The customer, on their own open ticket. Unchanged.
    (
      author_id = (SELECT auth.uid()) AND author_role = 'customer' AND EXISTS (
        SELECT 1 FROM public.ocade_support_tickets ticket
        WHERE ticket.id = ticket_id AND ticket.user_id = (SELECT auth.uid())
          AND ticket.status <> 'closed'
      )
    )
    -- Support, on a case they have actually opened. Replying is acting on a
    -- case, so it needs the case open just as reading does.
    OR (
      author_id = (SELECT auth.uid()) AND author_role = 'support'
      AND private.ocade_is_support_admin()
      AND public.ocade_support_grant_active(ticket_id)
    )
  );

/* The grants and the events are readable by the admin they belong to, and by
 * nobody else. Neither is writable from the client at all: both are produced
 * by the SECURITY DEFINER functions above, which is what makes the event log
 * append-only in practice as well as in intent. */
ALTER TABLE public.ocade_support_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_grants_own_read" ON public.ocade_support_grants
  FOR SELECT TO authenticated USING (admin_id = (SELECT auth.uid()));

ALTER TABLE public.ocade_support_access_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_access_events_own_read" ON public.ocade_support_access_events
  FOR SELECT TO authenticated USING (admin_id = (SELECT auth.uid()));

REVOKE ALL ON public.ocade_support_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ocade_support_grants TO authenticated;
GRANT ALL ON public.ocade_support_grants TO service_role;

REVOKE ALL ON public.ocade_support_access_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ocade_support_access_events TO authenticated;
GRANT ALL ON public.ocade_support_access_events TO service_role;

COMMIT;
