-- Verification for 20260904180000_status_incidents_and_maintenance.

DO $$
BEGIN
  IF to_regclass('public.ocade_status_incidents') IS NULL
     OR to_regclass('public.ocade_status_incident_updates') IS NULL THEN
    RAISE EXCEPTION 'the incident tables are missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
           WHERE oid = 'public.ocade_status_incidents'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class
              WHERE oid = 'public.ocade_status_incident_updates'::regclass) THEN
    RAISE EXCEPTION 'row-level security is off on an incident table';
  END IF;
END $$;

-- Readable by a signed-out visitor, which is the whole point of a status page,
-- and writable by neither browser role directly.
DO $$
DECLARE
  relation text;
  who text;
BEGIN
  FOREACH relation IN ARRAY ARRAY[
    'public.ocade_status_incidents', 'public.ocade_status_incident_updates'
  ] LOOP
    FOREACH who IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF NOT has_table_privilege(who, relation, 'SELECT') THEN
        RAISE EXCEPTION '% cannot read %, so the status page is not public', who, relation;
      END IF;
      IF has_table_privilege(who, relation, 'INSERT')
         OR has_table_privilege(who, relation, 'UPDATE')
         OR has_table_privilege(who, relation, 'DELETE') THEN
        RAISE EXCEPTION '% holds a direct write grant on %', who, relation;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Nothing in either table can carry an account's own data: there is no user
-- reference other than the administrator who acted, which the reader keeps to
-- administrators.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(attname, ', ') INTO offending
    FROM pg_attribute
   WHERE attrelid IN (
           'public.ocade_status_incidents'::regclass,
           'public.ocade_status_incident_updates'::regclass)
     AND attnum > 0 AND NOT attisdropped
     AND attname IN ('user_id', 'account_id', 'email', 'prompt', 'transcript');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'a publicly readable status table carries %', offending;
  END IF;
END $$;

-- The history is append-only, and both tables are read-only to a browser.
--
-- Asserted as "every policy is SELECT" rather than as "no policy is UPDATE or
-- DELETE", because `FOR ALL` is neither of those and grants both. Written the
-- permissive way round, a policy could open the whole table and this check
-- would pass.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(format('%s.%s (%s)', polrelid::regclass, polname, polcmd), ', ')
    INTO offending
    FROM pg_policy
   WHERE polrelid IN (
           'public.ocade_status_incidents'::regclass,
           'public.ocade_status_incident_updates'::regclass)
     AND polcmd <> 'r';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'a status policy admits more than reading: %', offending;
  END IF;
END $$;

-- Both writers check the role AND recent strong authentication, and both are
-- reachable by an administrator's browser but not by a signed-out visitor.
DO $$
DECLARE
  fn text;
  body text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.ocade_open_status_incident(text, text, text, text[], text, timestamptz, timestamptz)',
    'public.ocade_post_status_incident_update(uuid, text, text)'
  ] LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE EXCEPTION 'status writer % is missing', fn;
    END IF;
    SELECT prosrc INTO body FROM pg_proc WHERE oid = to_regprocedure(fn);
    IF body NOT LIKE '%has_role%' THEN
      RAISE EXCEPTION '% does not check the caller''s role', fn;
    END IF;
    IF body NOT LIKE '%ocade_require_recent_strong_auth%' THEN
      RAISE EXCEPTION '% does not require recent proof of identity', fn;
    END IF;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'an administrator cannot call %', fn;
    END IF;
    IF has_function_privilege('anon', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'a signed-out visitor can call %', fn;
    END IF;
  END LOOP;
END $$;

-- A resolved incident carries the instant it ended, and an unresolved one does
-- not pretend to.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ocade_status_incidents'::regclass
       AND conname = 'ocade_status_incidents_resolution'
  ) THEN
    RAISE EXCEPTION 'an incident can say resolved with no end time, or the reverse';
  END IF;
END $$;

-- No history was invented. PLAN.md §K: begin from the first verified
-- observation.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.ocade_status_incidents) > 0 THEN
    RAISE EXCEPTION 'the migration seeded an incident that never happened';
  END IF;
END $$;
