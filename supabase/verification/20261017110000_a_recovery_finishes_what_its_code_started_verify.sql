-- A spent recovery code records the recovery it began, and only the service may continue it.
DO $$
BEGIN
  IF to_regprocedure('public.ocade_begin_mfa_recovery(uuid, text, uuid, text[])') IS NULL THEN
    RAISE EXCEPTION 'ocade_begin_mfa_recovery is missing';
  END IF;
  IF has_function_privilege('authenticated', 'public.ocade_begin_mfa_recovery(uuid, text, uuid, text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'a signed-in token can call ocade_begin_mfa_recovery';
  END IF;
END
$$;
