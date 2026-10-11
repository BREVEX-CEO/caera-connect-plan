-- A rule for an app named in another script is accepted; a direction-changing one is not.
DO $$
BEGIN
  IF NOT ('app:हिन्दी नोट्स' ~ '^app:[^[:cntrl:]]{1,80}$') THEN
    RAISE EXCEPTION 'a Devanagari app name is refused';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jarvis_permissions_capability_check'
                  AND pg_get_constraintdef(oid) LIKE '%cntrl%') THEN
    RAISE EXCEPTION 'jarvis_permissions_capability_check was not replaced';
  END IF;
END
$$;
