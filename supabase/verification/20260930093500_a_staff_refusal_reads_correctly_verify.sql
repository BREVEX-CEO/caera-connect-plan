-- The recency refusal for staff changes no longer reuses the action phrase.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'private' AND p.proname = 'ocade_staff_require'
       AND p.prosrc LIKE '%making this change%'
  ) THEN
    RAISE EXCEPTION 'the staff recency refusal still reuses the action phrase';
  END IF;
  IF has_function_privilege('authenticated', 'private.ocade_staff_require(text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'signed-in people must not call the staff gate directly';
  END IF;
END
$$;
