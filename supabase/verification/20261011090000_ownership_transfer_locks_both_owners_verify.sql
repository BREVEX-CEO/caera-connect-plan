-- The hand-over locks both Owners and checks that exactly one Primary Owner remains.
DO $$
DECLARE
  v_body text;
BEGIN
  SELECT prosrc INTO v_body FROM pg_proc
   WHERE oid = 'public.ocade_staff_transfer_ownership(uuid, text, boolean)'::regprocedure;
  IF v_body NOT LIKE '%FOR UPDATE%' OR v_body NOT LIKE '%ROW_COUNT%'
     OR v_body NOT LIKE '%role = ''primary_owner'') <> 1%' THEN
    RAISE EXCEPTION 'ownership hand-over is not locked and checked';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_staff_transfer_ownership(uuid, text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous callers can hand over ownership';
  END IF;
END
$$;
