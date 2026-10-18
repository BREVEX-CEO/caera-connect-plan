-- Each operator change names its target in the action its proof must have been spent on.
DO $$
DECLARE
  v_fn text;
  v_def text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.ocade_staff_grant(text, text, text)',
    'public.ocade_staff_set_permissions(uuid, text[], text[], text)',
    'public.ocade_staff_revoke(uuid, text)',
    'public.ocade_staff_withdraw_invite(uuid, text)'
  ] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc AS p WHERE p.oid = v_fn::regprocedure;
    IF position('change who operates OCADE: ' IN v_def) = 0 THEN
      RAISE EXCEPTION '% does not name its target in its staff proof', v_fn;
    END IF;
  END LOOP;
END
$$;
