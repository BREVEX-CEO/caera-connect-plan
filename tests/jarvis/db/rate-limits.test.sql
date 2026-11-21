-- SEC-04: a person's actions are admitted up to the limit in a window, then refused; another
-- person and another action have their own counts; a signed-in person cannot call the step.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
INSERT INTO auth.users (id, email) VALUES
  ('e1e1e1e1-0000-4000-8000-000000000001', 'rate-a@example.test'),
  ('e2e2e2e2-0000-4000-8000-000000000002', 'rate-b@example.test');
SET LOCAL ROLE service_role;
DO $$
DECLARE
  a uuid := 'e1e1e1e1-0000-4000-8000-000000000001';
  b uuid := 'e2e2e2e2-0000-4000-8000-000000000002';
  i integer;
BEGIN
  FOR i IN 1..3 LOOP
    IF NOT public.ocade_rate_admit(a, 'start_task', 3, 60) THEN RAISE EXCEPTION 'rate: refused within the limit'; END IF;
  END LOOP;
  IF public.ocade_rate_admit(a, 'start_task', 3, 60) THEN RAISE EXCEPTION 'rate: admitted over the limit'; END IF;
  IF NOT public.ocade_rate_admit(b, 'start_task', 3, 60) THEN RAISE EXCEPTION 'rate: another person was limited'; END IF;
  IF NOT public.ocade_rate_admit(a, 'save_skill', 3, 60) THEN RAISE EXCEPTION 'rate: another action was limited'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.ocade_rate_admit('e1e1e1e1-0000-4000-8000-000000000001', 'start_task', 1000, 60);
  RAISE EXCEPTION 'rate: a person reset their own limit';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
ROLLBACK;
