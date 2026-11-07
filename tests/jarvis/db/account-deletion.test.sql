-- Account deletion is never blocked and keeps no one's identity it should not (179).
-- Every reference to an account either goes with it (the person's own data) or forgets it
-- (records of what someone did, kept without who). Checked over the whole schema, then
-- exercised: deleting a staff member who granted a plan and held a case succeeds, and the
-- grant and the case remain without them. Disposable database only; accounts are synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
DO $$
DECLARE
  blocking text;
BEGIN
  SELECT string_agg(c.conrelid::regclass || '.' || a.attname, ', ') INTO blocking
    FROM pg_constraint AS c
    JOIN pg_attribute AS a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
   WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass AND c.confdeltype NOT IN ('c', 'n');
  IF blocking IS NOT NULL THEN
    RAISE EXCEPTION 'account deletion: these references would block deleting an account: %', blocking;
  END IF;
END;
$$;

CREATE TEMP TABLE deletion_ids AS
  SELECT gen_random_uuid() AS staff, gen_random_uuid() AS customer, gen_random_uuid() AS kase;
INSERT INTO auth.users (id, email) SELECT staff, staff || '@example.test' FROM deletion_ids;
INSERT INTO auth.users (id, email) SELECT customer, customer || '@example.test' FROM deletion_ids;
INSERT INTO public.ocade_entitlement_grants (user_id, tier, reason, granted_by, starts_at, ends_at)
  SELECT customer, 'pro', 'a goodwill month', staff, now(), now() + interval '30 days' FROM deletion_ids;
INSERT INTO public.ocade_support_cases (id, customer, assignee, reason, expires_at)
  SELECT kase, customer, staff, 'slow answers on JARVIS', now() + interval '1 day' FROM deletion_ids;
DELETE FROM auth.users WHERE id = (SELECT staff FROM deletion_ids);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.ocade_entitlement_grants
       WHERE user_id = (SELECT customer FROM deletion_ids) AND granted_by IS NULL) <> 1 THEN
    RAISE EXCEPTION 'account deletion: the customer''s grant did not survive its granter''s deletion';
  END IF;
  IF (SELECT assignee FROM public.ocade_support_cases WHERE id = (SELECT kase FROM deletion_ids)) IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.ocade_support_cases WHERE id = (SELECT kase FROM deletion_ids)) THEN
    RAISE EXCEPTION 'account deletion: the customer''s case did not survive its assignee''s deletion';
  END IF;
END;
$$;
DELETE FROM auth.users WHERE id = (SELECT customer FROM deletion_ids);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ocade_entitlement_grants WHERE user_id = (SELECT customer FROM deletion_ids))
     OR EXISTS (SELECT 1 FROM public.ocade_support_cases WHERE customer = (SELECT customer FROM deletion_ids)) THEN
    RAISE EXCEPTION 'account deletion: the customer''s own records outlived the account';
  END IF;
END;
$$;
ROLLBACK;
