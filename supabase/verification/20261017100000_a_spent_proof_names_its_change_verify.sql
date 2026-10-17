-- A spent proof is adopted only for the action it was spent on.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ocade_staff_require') THEN
    RAISE EXCEPTION 'private.ocade_staff_require is missing';
  END IF;
  IF position('action = left(p_action, 120)' IN
              pg_get_functiondef('private.ocade_staff_require(text, text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'the staff gate does not compare the spent proof''s action';
  END IF;
END
$$;
