-- TENANT-06, TENANT-08, ADMIN-02, PRIVACY-06: support can read a conversation only while its owner shares it
-- (1 to 72 hours); expiry and withdrawal end it at once; only the owner can share, withdraw or see the share.
-- Disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE ss_ids AS SELECT gen_random_uuid() AS a, gen_random_uuid() AS b, gen_random_uuid() AS conv;
INSERT INTO auth.users (id, email) SELECT a, a::text || '@example.test' FROM ss_ids;
INSERT INTO auth.users (id, email) SELECT b, b::text || '@example.test' FROM ss_ids;
INSERT INTO public.ocade_conversations (id, user_id, title) SELECT conv, a, 'Support one' FROM ss_ids;
GRANT SELECT ON ss_ids TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_a uuid := (SELECT a FROM ss_ids);
  v_b uuid := (SELECT b FROM ss_ids);
  v_conv uuid := (SELECT conv FROM ss_ids);
  v_refused boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  v_refused := false;
  BEGIN PERFORM public.ocade_support_share(v_conv, 1);
  EXCEPTION WHEN insufficient_privilege THEN v_refused := true; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'support-share: a stranger shared someone else''s conversation'; END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  v_refused := false;
  BEGIN PERFORM public.ocade_support_share(v_conv, 0);
  EXCEPTION WHEN invalid_parameter_value THEN v_refused := true; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'support-share: 0 hours accepted'; END IF;
  v_refused := false;
  BEGIN PERFORM public.ocade_support_share(v_conv, 73);
  EXCEPTION WHEN invalid_parameter_value THEN v_refused := true; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'support-share: more than 72 hours accepted'; END IF;

  PERFORM public.ocade_support_share(v_conv, 2);
END $$;
RESET ROLE;
DO $$
DECLARE
  v_a uuid := (SELECT a FROM ss_ids);
  v_conv uuid := (SELECT conv FROM ss_ids);
  v_until timestamptz := private.ocade_support_shared_until(v_a, v_conv);
BEGIN
  IF v_until IS NULL OR v_until > now() + interval '2 hours 1 minute' OR v_until < now() + interval '1 hour 59 minutes' THEN
    RAISE EXCEPTION 'support-share: wrong window %', v_until;
  END IF;
  IF private.ocade_support_shared_until((SELECT b FROM ss_ids), v_conv) IS NOT NULL THEN
    RAISE EXCEPTION 'support-share: a share leaked to another customer id';
  END IF;
END $$;
-- a stranger sees no share rows and cannot withdraw it
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', (SELECT b FROM ss_ids), 'role', 'authenticated')::text, true);
  IF (SELECT count(*) FROM public.ocade_support_shares) <> 0 THEN RAISE EXCEPTION 'support-share: a stranger can read share rows'; END IF;
  PERFORM public.ocade_support_unshare((SELECT conv FROM ss_ids));
END $$;
RESET ROLE;
DO $$
BEGIN
  IF private.ocade_support_shared_until((SELECT a FROM ss_ids), (SELECT conv FROM ss_ids)) IS NULL THEN
    RAISE EXCEPTION 'support-share: a stranger withdrew the owner''s share';
  END IF;
END $$;
-- time passes: expiry alone ends it
UPDATE public.ocade_support_shares SET expires_at = now() - interval '1 second' WHERE conversation = (SELECT conv FROM ss_ids);
DO $$
BEGIN
  IF private.ocade_support_shared_until((SELECT a FROM ss_ids), (SELECT conv FROM ss_ids)) IS NOT NULL THEN
    RAISE EXCEPTION 'support-share: an expired share still counts';
  END IF;
END $$;
-- withdrawal by the owner ends a live share at once
UPDATE public.ocade_support_shares SET expires_at = now() + interval '1 hour' WHERE conversation = (SELECT conv FROM ss_ids);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', (SELECT a FROM ss_ids), 'role', 'authenticated')::text, true);
  IF (SELECT count(*) FROM public.ocade_support_shares) <> 1 THEN RAISE EXCEPTION 'support-share: owner cannot see own share'; END IF;
  PERFORM public.ocade_support_unshare((SELECT conv FROM ss_ids));
END $$;
RESET ROLE;
DO $$
BEGIN
  IF private.ocade_support_shared_until((SELECT a FROM ss_ids), (SELECT conv FROM ss_ids)) IS NOT NULL THEN
    RAISE EXCEPTION 'support-share: a withdrawn share still counts';
  END IF;
END $$;
ROLLBACK;
