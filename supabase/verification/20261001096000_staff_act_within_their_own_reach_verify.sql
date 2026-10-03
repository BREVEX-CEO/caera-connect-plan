-- Staff reach: colleagues are an owner's to act on; nobody gives more than they hold.
DO $$
BEGIN
  IF pg_get_functiondef('public.ocade_staff_reset_second_factor(uuid,text)'::regprocedure) !~ 'changed by an owner'
     OR pg_get_functiondef('public.ocade_staff_end_customer_sessions(uuid,text)'::regprocedure) !~ 'changed by an owner' THEN
    RAISE EXCEPTION 'a colleague can still act on another member of staff';
  END IF;
  IF pg_get_functiondef('public.ocade_staff_set_permissions(uuid,text[],text[],text)'::regprocedure) !~ 'hold yourself'
     OR pg_get_functiondef('public.ocade_staff_grant(text,text,text)'::regprocedure) !~ 'hold yourself' THEN
    RAISE EXCEPTION 'access can still be given beyond what the giver holds';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_staff_set_permissions(uuid,text[],text[],text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon reaches staff permissions';
  END IF;
END
$$;
