-- The consent record and the one way to write it exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'profiles' AND column_name = 'online_ai_consent_at') THEN
    RAISE EXCEPTION 'profiles.online_ai_consent_at is missing';
  END IF;
  IF to_regprocedure('public.ocade_record_online_ai_consent(text, boolean)') IS NULL THEN
    RAISE EXCEPTION 'ocade_record_online_ai_consent is missing';
  END IF;
END
$$;
