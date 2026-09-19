-- Prove both trigram indexes exist, so an operator's search is indexed rather
-- than a sequential scan of every profile.
DO $$
BEGIN
  PERFORM 1 FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'profiles_email_trgm_idx';
  IF NOT FOUND THEN RAISE EXCEPTION 'profiles_email_trgm_idx is missing'; END IF;

  PERFORM 1 FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'profiles_display_name_trgm_idx';
  IF NOT FOUND THEN RAISE EXCEPTION 'profiles_display_name_trgm_idx is missing'; END IF;
END $$;
