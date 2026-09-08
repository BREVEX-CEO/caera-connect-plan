-- Verification for 20260904150000_high_risk_organization_actions_require_recent_strong_auth.

-- The four helpers exist with the signatures the mutations call.
DO $$
DECLARE
  missing text;
BEGIN
  FOREACH missing IN ARRAY ARRAY[
    'public.ocade_recent_proof_window()',
    'public.ocade_session_has_verified_factor()',
    'public.ocade_session_last_proof_at()',
    'public.ocade_require_recent_strong_auth(text)'
  ] LOOP
    IF to_regprocedure(missing) IS NULL THEN
      RAISE EXCEPTION 'assurance helper % is missing', missing;
    END IF;
  END LOOP;
END $$;

-- None of them is reachable from outside. A SECURITY DEFINER function granted
-- to PUBLIC is granted to anon, which is every visitor.
DO $$
DECLARE
  fn text;
  grantee text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.ocade_recent_proof_window()',
    'public.ocade_session_has_verified_factor()',
    'public.ocade_session_last_proof_at()',
    'public.ocade_require_recent_strong_auth(text)'
  ] LOOP
    FOREACH grantee IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(grantee, fn, 'EXECUTE') THEN
        RAISE EXCEPTION '% may execute %', grantee, fn;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- The window is the one the product documents.
DO $$
BEGIN
  IF public.ocade_recent_proof_window() <> interval '10 minutes' THEN
    RAISE EXCEPTION 'the recent-proof window is %, not ten minutes',
      public.ocade_recent_proof_window();
  END IF;
END $$;

-- Every high-risk mutation actually calls the guard. A migration that replaced
-- one of these bodies later and dropped the line would leave the helper in
-- place and the action unprotected, which is exactly the shape of the defect
-- this migration closed.
DO $$
DECLARE
  fn text;
  body text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.ocade_delete_organization(uuid, text)',
    'public.ocade_transfer_organization_ownership(uuid, uuid)',
    'public.ocade_set_organization_member_role(uuid, text)',
    'public.ocade_remove_organization_member(uuid)'
  ] LOOP
    SELECT prosrc INTO body FROM pg_proc WHERE oid = to_regprocedure(fn);
    IF body IS NULL THEN
      RAISE EXCEPTION 'high-risk mutation % is missing', fn;
    END IF;
    IF body NOT LIKE '%ocade_require_recent_strong_auth%' THEN
      RAISE EXCEPTION '% does not require recent strong authentication', fn;
    END IF;
  END LOOP;
END $$;

-- And the reversible action deliberately does not, so the list above is a
-- decision rather than an accident of which bodies were edited.
DO $$
DECLARE
  body text;
BEGIN
  SELECT prosrc INTO body FROM pg_proc
   WHERE oid = to_regprocedure('public.ocade_set_organization_member_state(uuid, text)');
  IF body LIKE '%ocade_require_recent_strong_auth%' THEN
    RAISE EXCEPTION
      'deactivation now demands a factor challenge; it is the cautious action an administrator reaches for when locked out';
  END IF;
END $$;
