-- Prove the two feature-level stops exist, start running, and the key check allows them.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.ocade_service_controls
       WHERE key IN ('jarvis_agent', 'jarvis_extension') AND paused = false) <> 2 THEN
    RAISE EXCEPTION 'the Device Agent and extension controls are missing or start paused';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ocade_service_controls_key_check'
       AND pg_get_constraintdef(oid) LIKE '%jarvis_agent%'
       AND pg_get_constraintdef(oid) LIKE '%jarvis_extension%'
  ) THEN
    RAISE EXCEPTION 'the service control key check does not allow the feature-level stops';
  END IF;
END
$$;
