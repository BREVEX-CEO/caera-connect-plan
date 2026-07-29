-- Verification for 20260721160854 (profiles extended columns present).
DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['full_name','preferred_name','occupation','custom_instructions'] LOOP
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name=c;
    IF NOT FOUND THEN RAISE EXCEPTION 'missing column profiles.%', c; END IF;
  END LOOP;
  RAISE NOTICE 'verify 20260721160854 OK';
END $$;
