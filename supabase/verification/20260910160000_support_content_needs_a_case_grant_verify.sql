-- Verifies 20260910160000_support_content_needs_a_case_grant.sql.
--
-- The claim under test is the one PLAN.md Phase 15 makes: support content is
-- readable only through a time-bound, case-scoped grant, and reading leaves a
-- per-object record. Each half is checked by doing it.

DO $$
DECLARE
  customer uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  ticket uuid;
  other_ticket uuid;
  message uuid;
  the_grant public.ocade_support_grants;
  visible integer;
  events integer;
BEGIN
  -- The objects exist, as declared, before anything is done with them.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'ocade_support_grants'
  ) THEN
    RAISE EXCEPTION 'there is no grants table, so support content has no case scope';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'ocade_support_access_events'
  ) THEN
    RAISE EXCEPTION 'there is no access-event table, so nobody can be told who read what';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'ocade_read_support_case'
  ) THEN
    RAISE EXCEPTION 'the recorded read path does not exist';
  END IF;
  /*
   * EVERY policy, not the one this migration happens to name. PostgreSQL ORs
   * permissive policies together, so a narrow policy beside a broad one
   * changes nothing — which is exactly how the first draft of this migration
   * left the live database still reading `OR is_support_admin()` from a
   * consolidated policy it had not touched.
   */
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ocade_support_messages'
       AND cmd = 'SELECT' AND qual LIKE '%is_support_admin%'
  ) THEN
    RAISE EXCEPTION 'some policy still lets any admin read support messages with no case open';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ocade_support_messages'
       AND cmd = 'SELECT' AND qual LIKE '%ocade_support_grant_active%'
  ) THEN
    RAISE EXCEPTION 'no policy consults the case grant, so support content is either open or unreadable';
  END IF;

  INSERT INTO auth.users (id, email) VALUES
    (customer, 'support-customer-' || customer || '@invalid.test'),
    (admin_user, 'support-admin-' || admin_user || '@invalid.test');
  INSERT INTO public.user_roles (user_id, role) VALUES (admin_user, 'admin');

  INSERT INTO public.ocade_support_tickets (user_id, subject, category, status)
  VALUES (customer, 'Probe ticket', 'account', 'open') RETURNING id INTO ticket;
  INSERT INTO public.ocade_support_tickets (user_id, subject, category, status)
  VALUES (customer, 'Another ticket', 'billing', 'open') RETURNING id INTO other_ticket;

  INSERT INTO public.ocade_support_messages (ticket_id, author_id, author_role, body)
  VALUES (ticket, customer, 'customer', 'Here is my problem.') RETURNING id INTO message;

  -- Act as the admin, with a second factor.
  PERFORM set_config('request.jwt.claim.sub', admin_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.aal', 'aal2', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_user::text, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );

  -- With no grant, the case is closed to them.
  IF public.ocade_support_grant_active(ticket) THEN
    RAISE EXCEPTION 'an admin has access to a case nobody opened';
  END IF;
  SELECT count(*) INTO visible FROM public.ocade_read_support_case(ticket);
  IF visible <> 0 THEN
    RAISE EXCEPTION 'support content was returned without a grant';
  END IF;

  -- Opening one needs a reason worth reading.
  BEGIN
    PERFORM public.ocade_open_support_case(ticket, 'x', 60);
    RAISE EXCEPTION 'a case was opened with no real reason';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  the_grant := public.ocade_open_support_case(ticket, 'Customer asked us to check their refund.', 30);
  IF the_grant.expires_at <= the_grant.granted_at THEN
    RAISE EXCEPTION 'the grant does not expire';
  END IF;

  -- It opens THAT case and no other.
  IF NOT public.ocade_support_grant_active(ticket) THEN
    RAISE EXCEPTION 'the grant did not open the case it names';
  END IF;
  IF public.ocade_support_grant_active(other_ticket) THEN
    RAISE EXCEPTION 'a grant on one case opened another';
  END IF;

  -- Reading returns the content and records every object read.
  SELECT count(*) INTO visible FROM public.ocade_read_support_case(ticket);
  IF visible <> 1 THEN
    RAISE EXCEPTION 'the case read returned % messages rather than 1', visible;
  END IF;
  SELECT count(*) INTO events FROM public.ocade_support_access_events
   WHERE ticket_id = ticket AND admin_id = admin_user;
  IF events < 2 THEN
    RAISE EXCEPTION 'reading a case recorded % access events rather than one per object', events;
  END IF;

  -- Closing it early takes the access away immediately.
  IF NOT public.ocade_close_support_case(the_grant.id) THEN
    RAISE EXCEPTION 'the case could not be closed';
  END IF;
  IF public.ocade_support_grant_active(ticket) THEN
    RAISE EXCEPTION 'a closed case is still open';
  END IF;
  SELECT count(*) INTO visible FROM public.ocade_read_support_case(ticket);
  IF visible <> 0 THEN
    RAISE EXCEPTION 'a closed case still returns content';
  END IF;

  -- And an expired grant is as closed as a revoked one.
  the_grant := public.ocade_open_support_case(ticket, 'Second look at the same refund.', 30);
  UPDATE public.ocade_support_grants
     SET granted_at = now() - INTERVAL '2 hours', expires_at = now() - INTERVAL '1 hour'
   WHERE id = the_grant.id;
  IF public.ocade_support_grant_active(ticket) THEN
    RAISE EXCEPTION 'an expired grant still opens the case';
  END IF;

  -- Without a second factor, no case may be opened at all.
  PERFORM set_config('request.jwt.claim.aal', 'aal1', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_user::text, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );
  BEGIN
    PERFORM public.ocade_open_support_case(other_ticket, 'No second factor here at all.', 30);
    RAISE EXCEPTION 'a case was opened without a second factor';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  /*
   * Cleared in dependency order. `ocade_support_messages.author_id` is
   * RESTRICT, deliberately — a message must not lose its author — so the probe
   * has to take its own rows out before its users.
   */
  DELETE FROM public.ocade_support_access_events WHERE admin_id = admin_user;
  DELETE FROM public.ocade_support_grants WHERE admin_id = admin_user;
  DELETE FROM public.ocade_support_messages WHERE ticket_id IN (ticket, other_ticket);
  DELETE FROM public.ocade_support_tickets WHERE id IN (ticket, other_ticket);
  DELETE FROM public.user_roles WHERE user_id = admin_user;
  DELETE FROM auth.users WHERE id IN (customer, admin_user);
END;
$$;
