-- Prove the JARVIS surface is separate, closed to other accounts, and that its
-- device secrets are not readable by a browser role.
DO $$
DECLARE
  _table TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'ocade_conversations_surface_check'
                    AND pg_get_constraintdef(oid) LIKE '%jarvis%') THEN
    RAISE EXCEPTION 'conversations have no JARVIS surface discriminator';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ocade_conversations_surface_fixed') THEN
    RAISE EXCEPTION 'a conversation can change surface';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'ocade_commercial_usage_window_kind_check'
                    AND pg_get_constraintdef(oid) LIKE '%jarvis_session%') THEN
    RAISE EXCEPTION 'the ledger has no separate JARVIS windows';
  END IF;
  FOREACH _table IN ARRAY ARRAY['jarvis_devices', 'jarvis_permissions', 'jarvis_tasks',
                                'jarvis_activity', 'jarvis_memories'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = _table AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'public.% has no row-level security', _table;
    END IF;
    IF has_table_privilege('anon', format('public.%I', _table), 'SELECT') THEN
      RAISE EXCEPTION 'an anonymous visitor can read public.%', _table;
    END IF;
  END LOOP;
  -- The credential columns were later replaced by per-device public keys; either
  -- way, no credential column may be readable by a browser role.
  IF EXISTS (SELECT 1 FROM information_schema.column_privileges
              WHERE table_schema = 'public' AND table_name = 'jarvis_devices'
                AND grantee = 'authenticated' AND privilege_type = 'SELECT'
                AND column_name IN ('token_hash', 'pairing_code_hash', 'public_key')) THEN
    RAISE EXCEPTION 'a browser can read device credential material';
  END IF;
  IF has_table_privilege('authenticated', 'public.jarvis_activity', 'INSERT')
     OR has_table_privilege('authenticated', 'public.jarvis_devices', 'UPDATE') THEN
    RAISE EXCEPTION 'a browser can write the device queue or device records directly';
  END IF;
  IF has_function_privilege('authenticated', 'public.jarvis_purge_expired_activity(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'a browser can run the retention purge';
  END IF;
END $$;
