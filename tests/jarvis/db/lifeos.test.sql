\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, email) VALUES
 ('acae0000-0000-4000-8000-000000000001', 'lifeos-a@example.test'),
 ('acae0000-0000-4000-8000-000000000002', 'lifeos-b@example.test');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"acae0000-0000-4000-8000-000000000001","role":"authenticated"}', true);
INSERT INTO public.ocade_lifeos_obligations (user_id, title, source, due_on)
VALUES ('acae0000-0000-4000-8000-000000000001', 'Renew contract', 'Renewal.pdf', '2026-11-30');
UPDATE public.ocade_lifeos_obligations SET snoozed_until = '2026-11-27';

SELECT set_config('request.jwt.claims', '{"sub":"acae0000-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$
DECLARE changed integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ocade_lifeos_obligations) THEN RAISE EXCEPTION 'cross-account read'; END IF;
  UPDATE public.ocade_lifeos_obligations SET completed = true;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'cross-account update'; END IF;
  DELETE FROM public.ocade_lifeos_obligations;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'cross-account delete'; END IF;
  BEGIN
    INSERT INTO public.ocade_lifeos_obligations (user_id, title)
    VALUES ('acae0000-0000-4000-8000-000000000001', 'Forged');
    RAISE EXCEPTION 'cross-account insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
INSERT INTO public.ocade_lifeos_obligations (user_id, title, source)
VALUES ('acae0000-0000-4000-8000-000000000002', 'Renew contract', 'Renewal.pdf');

SELECT set_config('request.jwt.claims', '{"sub":"acae0000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.ocade_lifeos_obligations) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.ocade_lifeos_obligations WHERE snoozed_until = '2026-11-27')
  THEN RAISE EXCEPTION 'owner did not see exactly their own updated record'; END IF;
END $$;
DELETE FROM public.ocade_lifeos_obligations;

SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM count(*) FROM public.ocade_lifeos_obligations;
  RAISE EXCEPTION 'anonymous read';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
DELETE FROM auth.users WHERE id = 'acae0000-0000-4000-8000-000000000002';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.ocade_lifeos_obligations) THEN RAISE EXCEPTION 'account deletion left records'; END IF;
END $$;
ROLLBACK;
