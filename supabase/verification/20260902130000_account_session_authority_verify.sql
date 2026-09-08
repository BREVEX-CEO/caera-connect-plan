-- Prove sessions can be listed and revoked, and that one account cannot touch
-- another's.
--
-- Exercised through the functions rather than by reading the schema: an
-- ownership constraint that looks right and is not bound into the WHERE clause
-- is exactly the failure this guards against, and only calls can tell.
--
-- Two real accounts and real `auth.sessions` rows are created, used and
-- deleted. Safe in both directions: on success the DELETEs below remove them,
-- and any RAISE aborts the surrounding transaction, undoing the inserts along
-- with everything else.

DO $$
DECLARE
  owner_user uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  session_a uuid := gen_random_uuid();
  session_b uuid := gen_random_uuid();
  session_c uuid := gen_random_uuid();
  intruder  uuid := gen_random_uuid();
  listed integer;
  removed integer;
  live boolean;
BEGIN
  INSERT INTO auth.users (id, email)
    VALUES (owner_user, 'session-probe-' || owner_user || '@invalid.test');
  INSERT INTO auth.users (id, email)
    VALUES (other_user, 'session-other-' || other_user || '@invalid.test');

  INSERT INTO auth.sessions (id, user_id, created_at, updated_at, user_agent)
    VALUES
      (session_a, owner_user, now() - interval '2 hours', now() - interval '1 hour', 'Probe/A'),
      (session_b, owner_user, now() - interval '1 hour', now(), 'Probe/B'),
      (session_c, owner_user, now(), now(), 'Probe/C');
  INSERT INTO auth.sessions (id, user_id, created_at, updated_at, user_agent)
    VALUES (intruder, other_user, now(), now(), 'Probe/Other');

  ---------------------------------------------------------------- listing --
  SELECT count(*) INTO listed FROM public.ocade_list_account_sessions(owner_user);
  IF listed <> 3 THEN
    RAISE EXCEPTION 'listed % sessions rather than 3', listed;
  END IF;

  -- ONE ACCOUNT'S SESSIONS ONLY. Without the user_id constraint this would
  -- show every session on the deployment to whoever asked.
  IF EXISTS (
    SELECT 1 FROM public.ocade_list_account_sessions(owner_user) WHERE session_id = intruder
  ) THEN
    RAISE EXCEPTION 'another account''s session appeared in this account''s list';
  END IF;

  -- Nothing replayable is returned. A listing that leaked refresh material
  -- would turn "see where I am signed in" into a way to become those sessions.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ocade_list_account_sessions'
      AND column_name IN ('refresh_token_hmac_key', 'refresh_token_counter')
  ) THEN
    RAISE EXCEPTION 'the session listing exposes refresh material';
  END IF;

  ------------------------------------------------------- targeted revoke --
  removed := public.ocade_revoke_account_session(owner_user, session_a);
  IF removed <> 1 THEN RAISE EXCEPTION 'revoking one session removed % rows', removed; END IF;

  SELECT count(*) INTO listed FROM public.ocade_list_account_sessions(owner_user);
  IF listed <> 2 THEN RAISE EXCEPTION 'after one revocation % sessions remained', listed; END IF;

  -- THE ONE THAT MATTERS. A session id belonging to somebody else must match
  -- no row, so a caller cannot sign another account out.
  removed := public.ocade_revoke_account_session(owner_user, intruder);
  IF removed <> 0 THEN
    RAISE EXCEPTION 'one account revoked another account''s session';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = intruder) THEN
    RAISE EXCEPTION 'another account''s session was deleted';
  END IF;

  -- And revoking a session that never existed is not an error, just nothing.
  removed := public.ocade_revoke_account_session(owner_user, gen_random_uuid());
  IF removed <> 0 THEN RAISE EXCEPTION 'revoking an unknown session removed % rows', removed; END IF;

  ------------------------------------------------------ everywhere else --
  removed := public.ocade_revoke_other_account_sessions(owner_user, session_b);
  IF removed <> 1 THEN
    RAISE EXCEPTION 'signing out everywhere else removed % rather than 1', removed;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = session_b) THEN
    RAISE EXCEPTION 'signing out everywhere else also ended the session being kept';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = intruder) THEN
    RAISE EXCEPTION 'signing out everywhere else reached another account';
  END IF;

  ------------------------------------------------------------- liveness --
  live := public.ocade_session_is_live(owner_user, session_b);
  IF NOT live THEN RAISE EXCEPTION 'a live session reported as dead'; END IF;

  live := public.ocade_session_is_live(owner_user, session_a);
  IF live THEN RAISE EXCEPTION 'a revoked session still reports as live'; END IF;

  -- Cross-account liveness must be false, or it becomes an oracle telling one
  -- account whether another's session exists.
  live := public.ocade_session_is_live(owner_user, intruder);
  IF live THEN RAISE EXCEPTION 'one account can see whether another''s session is live'; END IF;

  ----------------------------------------------------------- revoke all --
  removed := public.ocade_revoke_other_account_sessions(owner_user, NULL);
  IF removed <> 1 THEN RAISE EXCEPTION 'revoking everything removed % rather than 1', removed; END IF;
  SELECT count(*) INTO listed FROM public.ocade_list_account_sessions(owner_user);
  IF listed <> 0 THEN RAISE EXCEPTION 'after revoking everything % sessions remained', listed; END IF;

  DELETE FROM auth.users WHERE id IN (owner_user, other_user);

  RAISE NOTICE 'session authority verified: listed, revoked one, kept one, and no cross-account reach.';
END $$;

-- The browser must never call these directly.
DO $$
DECLARE
  leaked text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO leaked
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'ocade_list_account_sessions',
        'ocade_revoke_account_session',
        'ocade_revoke_other_account_sessions',
        'ocade_session_is_live'
      )
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      );
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'a browser role can execute session functions: %', leaked;
  END IF;

  RAISE NOTICE 'session functions are service_role only.';
END $$;
