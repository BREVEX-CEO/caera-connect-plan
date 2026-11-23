-- Concept 67: a permission granted for a limited time stops working when it ends. An expired
-- decision is "not allowed" and never falls back to a broader account-wide grant; a decision
-- without an end lasts until turned off; another account's grant never applies.
-- Disposable database only; every account/device is synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.expiry_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'permission expiry: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE expiry_ids AS SELECT gen_random_uuid() AS user_id, gen_random_uuid() AS other_id;
INSERT INTO auth.users (id, email)
SELECT id, id::text || '@example.test' FROM expiry_ids, LATERAL (VALUES (user_id), (other_id)) AS u(id);
GRANT SELECT ON expiry_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_user uuid := (SELECT user_id FROM expiry_ids);
  v_other uuid := (SELECT other_id FROM expiry_ids);
  v_key text := repeat(replace(v_user::text, '-', ''), 4);
  v_device uuid;
BEGIN
  PERFORM public.jarvis_enroll_device(v_key, 'Expiry fixture', 'windows', 'test', repeat('c', 64));
  v_device := public.jarvis_approve_device(v_user, public.jarvis_device_code(v_key));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed, expires_at) VALUES
    (v_user, NULL, 'master', true, NULL),
    (v_user, NULL, 'files', true, NULL),
    (v_user, v_device, 'files', true, now() - interval '1 second'),
    (v_user, v_device, 'apps', true, now() + interval '1 hour'),
    (v_user, v_device, 'browser', true, NULL),
    (v_other, v_device, 'screen', true, NULL);

  PERFORM pg_temp.expiry_assert(NOT public.jarvis_allowed(v_user, v_device, 'files'),
    'an expired device grant must not fall back to the account-wide grant');
  PERFORM pg_temp.expiry_assert(public.jarvis_allowed(v_user, v_device, 'apps'),
    'a grant before its end is allowed');
  PERFORM pg_temp.expiry_assert(public.jarvis_allowed(v_user, v_device, 'browser'),
    'a grant with no end is allowed');
  PERFORM pg_temp.expiry_assert(NOT public.jarvis_allowed(v_user, v_device, 'screen'),
    'another account''s grant never applies');
  PERFORM pg_temp.expiry_assert(NOT (public.jarvis_grants(v_user, v_device) ? 'files'),
    'an expired grant is not offered for planning');
  PERFORM pg_temp.expiry_assert(public.jarvis_grants(v_user, v_device) ? 'apps',
    'a live grant is offered for planning');

  UPDATE public.jarvis_permissions SET expires_at = now() - interval '1 second'
   WHERE user_id = v_user AND device_id IS NULL AND capability = 'master';
  PERFORM pg_temp.expiry_assert(NOT public.jarvis_allowed(v_user, v_device, 'browser'),
    'an expired master switch turns every grant off');
END;
$$;
ROLLBACK;
