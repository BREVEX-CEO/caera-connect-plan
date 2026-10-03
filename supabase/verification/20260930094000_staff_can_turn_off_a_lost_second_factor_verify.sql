-- The reset exists, is refused to anonymous callers, and goes through the staff gate.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.ocade_staff_reset_second_factor(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous callers can reach the second-factor reset';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE oid = 'public.ocade_staff_reset_second_factor(uuid, text)'::regprocedure
       AND prosrc LIKE '%ocade_staff_require%' AND prosrc LIKE '%primary_owner%'
  ) THEN
    RAISE EXCEPTION 'the second-factor reset does not go through the staff gate';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ocade_admin_actions_action_check'
       AND pg_get_constraintdef(oid) LIKE '%second_factor_reset%'
  ) THEN
    RAISE EXCEPTION 'the audit record refuses second_factor_reset';
  END IF;
END
$$;
