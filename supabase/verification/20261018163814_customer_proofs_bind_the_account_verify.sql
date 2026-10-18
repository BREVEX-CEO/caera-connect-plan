-- No schema or ACL change: each protected function must retain its exact-customer gate.
DO $$
DECLARE
  v_fn text;
  v_def text;
BEGIN
  v_def := pg_get_functiondef('private.ocade_staff_require(text, text)'::regprocedure);
  IF position('action = v_action' IN v_def) = 0
     OR position('sha256(convert_to(p_action' IN v_def) = 0 THEN
    RAISE EXCEPTION 'The proof gate truncates long action targets';
  END IF;
  FOREACH v_fn IN ARRAY ARRAY[
    'public.ocade_staff_end_customer_sessions(uuid, text)',
    'public.ocade_staff_reset_second_factor(uuid, text)',
    'public.ocade_staff_adjust_usage(uuid, text, text, bigint, text)',
    'public.ocade_staff_suspend_account(uuid, boolean, text)',
    'public.ocade_staff_begin_account_deletion(uuid, text, text)'
  ] LOOP
    v_def := pg_get_functiondef(v_fn::regprocedure);
    IF position('|| p_user' IN v_def) = 0 OR position('private.ocade_staff_require(' IN v_def) = 0 THEN
      RAISE EXCEPTION '% does not bind the customer in its proof', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '% has unexpected execution privileges', v_fn;
    END IF;
  END LOOP;
END
$$;
