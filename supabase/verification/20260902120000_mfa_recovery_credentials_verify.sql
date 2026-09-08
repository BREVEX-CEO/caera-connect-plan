-- Prove the recovery credentials are single-use, batch-replaceable, and that
-- guessing them is genuinely bounded.
--
-- Exercised through the RPCs rather than by reading the schema. A lockout that
-- looks right in the source and does not hold is exactly the failure this
-- guards against, and only calls can tell the difference.
--
-- `user_id` is a foreign key into the auth schema, so the probe creates an
-- account, uses it, and deletes it. Safe in both directions: on success the
-- DELETE below removes it, and any RAISE aborts the surrounding transaction,
-- which undoes the insert along with everything else.

DO $$
DECLARE
  probe_user uuid := gen_random_uuid();
  -- A SECOND REAL ACCOUNT, not a random uuid. `user_id` is a foreign key, so a
  -- uuid belonging to nobody fails at the constraint before it ever reaches the
  -- account-binding check — the probe would pass on the wrong error and prove
  -- nothing about whose codes are whose.
  other_user uuid := gen_random_uuid();
  hash_a text := repeat('a', 64);
  hash_b text := repeat('b', 64);
  hash_c text := repeat('c', 64);
  wrong  text := repeat('f', 64);
  written integer;
  status text;
  remaining integer;
  total integer;
  refused boolean;
BEGIN
  INSERT INTO auth.users (id, email)
    VALUES (probe_user, 'mfa-recovery-probe-' || probe_user || '@invalid.test');
  INSERT INTO auth.users (id, email)
    VALUES (other_user, 'mfa-recovery-other-' || other_user || '@invalid.test');

  ------------------------------------------------------------------ batches --
  written := public.ocade_replace_mfa_recovery_codes(probe_user, ARRAY[hash_a, hash_b, hash_c]);
  IF written <> 3 THEN RAISE EXCEPTION 'wrote % codes rather than 3', written; END IF;

  SELECT r.remaining, r.total INTO remaining, total
    FROM public.ocade_count_mfa_recovery_codes(probe_user) AS r;
  IF remaining <> 3 OR total <> 3 THEN
    RAISE EXCEPTION 'a fresh batch reported %/% rather than 3/3', remaining, total;
  END IF;

  -- An empty batch is refused. Silently storing nothing would leave an account
  -- believing it had recovery codes when it had none.
  refused := false;
  BEGIN
    PERFORM public.ocade_replace_mfa_recovery_codes(probe_user, ARRAY[]::text[]);
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'an empty recovery batch was accepted'; END IF;

  ---------------------------------------------------------------- single use --
  status := public.ocade_consume_mfa_recovery_code(probe_user, hash_a);
  IF status <> 'consumed' THEN RAISE EXCEPTION 'a valid code returned %', status; END IF;

  -- THE ONE THAT MATTERS. The same code a second time must not work; a replayed
  -- code is a code somebody read over a shoulder.
  status := public.ocade_consume_mfa_recovery_code(probe_user, hash_a);
  IF status <> 'rejected' THEN
    RAISE EXCEPTION 'a consumed code was accepted again (returned %)', status;
  END IF;

  SELECT r.remaining INTO remaining FROM public.ocade_count_mfa_recovery_codes(probe_user) AS r;
  IF remaining <> 2 THEN RAISE EXCEPTION 'after one use, % remained rather than 2', remaining; END IF;

  ------------------------------------------------------------ cross-account --
  -- A code is bound to its account. Without this, one leaked sheet would reset
  -- every account whose row happened to share a hash.
  status := public.ocade_consume_mfa_recovery_code(other_user, hash_b);
  IF status <> 'rejected' THEN
    RAISE EXCEPTION 'another account consumed this account''s code (returned %)', status;
  END IF;

  --------------------------------------------------------------- the lockout --
  -- Four wrong guesses on top of the one rejection above reaches the fifth
  -- failure, which locks.
  FOR i IN 1..3 LOOP
    status := public.ocade_consume_mfa_recovery_code(probe_user, wrong);
    IF status <> 'rejected' THEN
      RAISE EXCEPTION 'guess % returned % rather than rejected', i, status;
    END IF;
  END LOOP;

  status := public.ocade_consume_mfa_recovery_code(probe_user, wrong);
  IF status <> 'locked' THEN
    RAISE EXCEPTION 'the fifth failed guess returned % rather than locked', status;
  END IF;

  -- AND A CORRECT CODE IS REFUSED WHILE LOCKED. A lockout that a right answer
  -- walks straight through is not a lockout: an attacker who reaches the
  -- correct code on the next guess would be let in.
  status := public.ocade_consume_mfa_recovery_code(probe_user, hash_b);
  IF status <> 'locked' THEN
    RAISE EXCEPTION 'a correct code bypassed the lockout (returned %)', status;
  END IF;

  ------------------------------------------------------- regeneration clears --
  -- Replacing the batch retires every earlier code AND clears the lockout: the
  -- owner has just proved themselves to get here.
  written := public.ocade_replace_mfa_recovery_codes(probe_user, ARRAY[hash_a, hash_b]);
  IF written <> 2 THEN RAISE EXCEPTION 'regeneration wrote % rather than 2', written; END IF;

  SELECT r.remaining, r.total INTO remaining, total
    FROM public.ocade_count_mfa_recovery_codes(probe_user) AS r;
  IF remaining <> 2 OR total <> 2 THEN
    RAISE EXCEPTION 'after regeneration %/% rather than 2/2 — an old batch survived',
      remaining, total;
  END IF;

  -- `hash_a` was consumed in the OLD batch and is a fresh code in the new one.
  status := public.ocade_consume_mfa_recovery_code(probe_user, hash_a);
  IF status <> 'consumed' THEN
    RAISE EXCEPTION 'a regenerated code was refused (returned %) — the lockout survived', status;
  END IF;

  ---------------------------------------------------------------- the shape --
  refused := false;
  BEGIN
    PERFORM public.ocade_replace_mfa_recovery_codes(probe_user, ARRAY['not-a-hash']);
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  IF NOT refused THEN
    RAISE EXCEPTION 'a value that is not a 64-character hex digest was stored as a code';
  END IF;

  DELETE FROM auth.users WHERE id IN (probe_user, other_user);

  RAISE NOTICE 'mfa recovery credentials verified: single use, account-bound, lockout holds against a correct code, regeneration retires the old batch.';
END $$;

-- The browser must never be able to read or write these tables directly.
DO $$
DECLARE
  leaked text;
BEGIN
  SELECT string_agg(grantee || ' on ' || table_name, ', ') INTO leaked
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('ocade_mfa_recovery_codes', 'ocade_mfa_recovery_attempts')
      AND grantee IN ('anon', 'authenticated', 'PUBLIC');
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'recovery credentials are reachable from a browser role: %', leaked;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO leaked
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'ocade_replace_mfa_recovery_codes',
        'ocade_consume_mfa_recovery_code',
        'ocade_count_mfa_recovery_codes'
      )
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      );
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'a browser role can execute recovery functions: %', leaked;
  END IF;

  RAISE NOTICE 'recovery credentials are service_role only.';
END $$;
