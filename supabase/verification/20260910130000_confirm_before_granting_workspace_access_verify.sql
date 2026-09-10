-- Verifies 20260910130000_confirm_before_granting_workspace_access.sql.
--
-- Reads the function bodies from `pg_proc` rather than exercising them, because
-- exercising them needs a session with an assurance claim and that is what
-- `organization-assurance.test.ts` does against real PostgreSQL. What this
-- catches is the migration being partly applied, or a later edit dropping a
-- gate while keeping the function.

DO $$
DECLARE
  target text;
  body text;
  ungated text := '';
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'ocade_invite_to_organization',
    'ocade_resend_organization_invite',
    'ocade_set_organization_member_state'
  ] LOOP
    SELECT prosrc INTO body
      FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace AND proname = target;
    IF body IS NULL THEN
      RAISE EXCEPTION '% is missing, so the workspace surface it serves cannot work at all', target;
    END IF;
    IF position('ocade_require_recent_strong_auth' IN body) = 0 THEN
      ungated := ungated || ' ' || target;
    END IF;
  END LOOP;

  IF ungated <> '' THEN
    RAISE EXCEPTION
      'these grants of workspace access ask for no recent proof, so an unlocked laptop is enough:%',
      ungated;
  END IF;

  -- Withdrawing access must NOT be gated. A verification that only checked for
  -- the presence of a gate would pass a function that demanded a code before
  -- letting an administrator suspend a compromised account.
  SELECT prosrc INTO body
    FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
     AND proname = 'ocade_set_organization_member_state';
  IF position('p_state <> ''deactivated''' IN body) = 0 THEN
    RAISE EXCEPTION
      'ocade_set_organization_member_state gates every state change, so suspending a compromised account now needs an authenticator code';
  END IF;

  -- The gate itself must stay unreachable from a browser role.
  IF has_function_privilege('authenticated', 'public.ocade_require_recent_strong_auth(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ocade_require_recent_strong_auth(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'a browser role can call the assurance gate directly, so its answer is not the database''s';
  END IF;
END $$;
