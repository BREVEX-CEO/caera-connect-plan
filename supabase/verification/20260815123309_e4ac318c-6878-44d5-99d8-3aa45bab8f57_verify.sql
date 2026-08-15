-- Verify the idempotent subscription and cloud-usage replay.
DO $$
BEGIN
  IF to_regclass('public.ocade_subscriptions') IS NULL
     OR to_regclass('public.ocade_cloud_usage') IS NULL THEN
    RAISE EXCEPTION 'OCADE subscription or usage table is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('ocade_subscriptions', 'ocade_cloud_usage')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'An OCADE subscription/usage table is missing RLS';
  END IF;

  IF to_regprocedure('public.ocade_consume_cloud_use(uuid,timestamp with time zone,integer)') IS NULL THEN
    RAISE EXCEPTION 'ocade_consume_cloud_use RPC is missing';
  END IF;
END;
$$;
