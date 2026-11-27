-- BILLING-01, BILLING-05, OFFLINE-08, FRONTEND-01: entitlements, usage, permits and offline leases are written only
-- by the server; no browser role can insert, update or delete them. A lease records the server's issue time and a
-- bounded validity. Disposable DB only.
\set ON_ERROR_STOP on
DO $$
DECLARE
  t text;
  r text;
  p text;
  v_bad text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ocade_commercial_usage', 'ocade_unlimited_grants', 'ocade_usage_adjustments', 'ocade_generation_permits', 'ocade_device_usage_keys', 'ocade_device_usage_leases',
    'ocade_offline_usage_allocations', 'ocade_offline_usage_events', 'ocade_entitlement_grants'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'commercial: table % is missing', t; END IF;
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH p IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
        IF has_table_privilege(r, 'public.' || t, p) THEN v_bad := v_bad || r || ' ' || p || ' ' || t || '; '; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF v_bad <> '' THEN RAISE EXCEPTION 'commercial: browser roles can write: %', v_bad; END IF;
  -- a lease carries the server's issue time (defaulted by the database, not supplied by a caller) and an expiry
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ocade_device_usage_leases'
       AND column_name = 'issued_at' AND column_default LIKE '%statement_timestamp%'
  ) THEN RAISE EXCEPTION 'commercial: a lease does not take its issue time from the server'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ocade_device_usage_leases'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%expires_at%'
  ) THEN RAISE EXCEPTION 'commercial: a lease has no bounded validity check'; END IF;
END $$;
