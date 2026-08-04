-- Verification for 20260721141946 (launch gate).
DO $$
BEGIN
  IF to_regclass('public.launch_gate_items')   IS NULL THEN RAISE EXCEPTION 'missing table launch_gate_items'; END IF;
  IF to_regclass('public.launch_gate_history') IS NULL THEN RAISE EXCEPTION 'missing table launch_gate_history'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('launch_gate_items','launch_gate_history')
      AND c.relrowsecurity=false
  ) THEN RAISE EXCEPTION 'RLS not enabled on launch_gate tables'; END IF;
  PERFORM 1 FROM pg_type WHERE typname='launch_gate_status'; IF NOT FOUND THEN RAISE EXCEPTION 'missing enum launch_gate_status'; END IF;
  PERFORM 1 FROM pg_type WHERE typname='feature_flag_stage'; IF NOT FOUND THEN RAISE EXCEPTION 'missing enum feature_flag_stage'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname='feature_flags_enforce_ga'; IF NOT FOUND THEN RAISE EXCEPTION 'missing trigger feature_flags_enforce_ga'; END IF;
  RAISE NOTICE 'verify 20260721141946 OK';
END $$;
