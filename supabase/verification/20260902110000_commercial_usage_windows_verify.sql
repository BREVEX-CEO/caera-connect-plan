-- Prove the ledger accounts exactly, refuses over-spending, and cannot be
-- driven negative.
--
-- Exercised through the RPCs themselves rather than by reading the schema: an
-- allowance check that looks right and does not hold is the failure this
-- guards against, and only a call can tell the difference.
--
-- `user_id` is a foreign key into the auth schema, so the probe creates an
-- account, uses it, and deletes it. That is safe in both directions: on
-- success the DELETEs below remove it, and any RAISE aborts the surrounding
-- transaction, which undoes the insert along with everything else. A probe
-- that left an account behind would be worse than no probe.

DO $$
DECLARE
  probe_user uuid := gen_random_uuid();
  probe_window timestamptz := now();
  used bigint;
  refused boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocade_cloud_usage'
  ) THEN
    RAISE EXCEPTION 'ocade_cloud_usage still exists; the ledger was not renamed.';
  END IF;

  INSERT INTO auth.users (id, email)
    VALUES (probe_user, 'commercial-usage-probe-' || probe_user || '@invalid.test');

  -- Fractional work accumulates exactly.
  used := public.ocade_consume_commercial_work(probe_user, 'session', probe_window, 25, 14000);
  IF used <> 25 THEN RAISE EXCEPTION 'first reservation recorded % rather than 25', used; END IF;

  used := public.ocade_consume_commercial_work(probe_user, 'session', probe_window, 101, 14000);
  IF used <> 126 THEN RAISE EXCEPTION 'second reservation recorded % rather than 126', used; END IF;

  -- The two window kinds are separate ledgers for the same account.
  used := public.ocade_consume_commercial_work(probe_user, 'week', probe_window, 500, 70000);
  IF used <> 500 THEN RAISE EXCEPTION 'the weekly window shares the session total (%)', used; END IF;

  -- A request that exactly exhausts the allowance is accepted.
  used := public.ocade_consume_commercial_work(probe_user, 'session', probe_window, 13874, 14000);
  IF used <> 14000 THEN RAISE EXCEPTION 'exact exhaustion recorded % rather than 14000', used; END IF;

  -- The one after it is refused, and the refusal does not leave the ledger high.
  refused := false;
  BEGIN
    PERFORM public.ocade_consume_commercial_work(probe_user, 'session', probe_window, 1, 14000);
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'the ledger allowed a request past the allowance'; END IF;

  SELECT used_hundredths INTO used FROM public.ocade_commercial_usage
    WHERE user_id = probe_user AND window_kind = 'session' AND window_start = probe_window;
  IF used <> 14000 THEN
    RAISE EXCEPTION 'a refused reservation left the ledger at % rather than 14000', used;
  END IF;

  -- A window with no allowance records without a ceiling.
  used := public.ocade_consume_commercial_work(probe_user, 'week', probe_window, 100000, NULL);
  IF used <> 100500 THEN RAISE EXCEPTION 'an unlimited window refused or miscounted (%)', used; END IF;

  -- Releasing gives work back.
  used := public.ocade_release_commercial_work(probe_user, 'session', probe_window, 14000);
  IF used <> 0 THEN RAISE EXCEPTION 'release left % rather than 0', used; END IF;

  -- And a double release cannot drive it negative and hand out free allowance.
  used := public.ocade_release_commercial_work(probe_user, 'session', probe_window, 14000);
  IF used <> 0 THEN RAISE EXCEPTION 'a double release drove the ledger to %', used; END IF;

  -- Negative work is refused rather than credited.
  refused := false;
  BEGIN
    PERFORM public.ocade_consume_commercial_work(probe_user, 'session', probe_window, -100, 14000);
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'the ledger accepted a negative cost'; END IF;

  DELETE FROM public.ocade_commercial_usage WHERE user_id = probe_user;
  DELETE FROM auth.users WHERE id = probe_user;

  -- The browser may never spend or return allowance directly.
  IF has_function_privilege(
    'authenticated',
    'public.ocade_consume_commercial_work(uuid,text,timestamp with time zone,bigint,bigint)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated can execute the consume function directly';
  END IF;
  IF has_function_privilege(
    'anon',
    'public.ocade_release_commercial_work(uuid,text,timestamp with time zone,bigint)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute the release function directly';
  END IF;
END;
$$;
