
CREATE TABLE public.data_class_privacy (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_class text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('browser_only','pc_vault','private_sync')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, data_class)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_class_privacy TO authenticated;
GRANT ALL ON public.data_class_privacy TO service_role;
ALTER TABLE public.data_class_privacy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dcp_self_all" ON public.data_class_privacy FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Migrate existing per-class choices from user_settings
INSERT INTO public.data_class_privacy (user_id, data_class, mode)
SELECT user_id, dc.data_class,
  CASE WHEN dc.mode::text = 'device_only' THEN 'browser_only' ELSE dc.mode::text END
FROM public.user_settings us,
LATERAL (VALUES
  ('chats', us.privacy_chats),
  ('files', us.privacy_files),
  ('images', us.privacy_images),
  ('copilot', us.privacy_copilot),
  ('recordings', us.privacy_recordings),
  ('resumes', us.privacy_resumes),
  ('company', us.privacy_company),
  ('timesheets', us.privacy_timesheets)
) AS dc(data_class, mode)
ON CONFLICT DO NOTHING;

-- Seed sensible defaults for newer classes (Private Sync for accounting; Browser Only for learning replays)
INSERT INTO public.data_class_privacy (user_id, data_class, mode)
SELECT user_id, 'accounting', 'private_sync' FROM public.user_settings
ON CONFLICT DO NOTHING;
INSERT INTO public.data_class_privacy (user_id, data_class, mode)
SELECT user_id, 'learning_replays', 'browser_only' FROM public.user_settings
ON CONFLICT DO NOTHING;

CREATE TABLE public.vault_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_kind text NOT NULL CHECK (credential_kind IN ('passphrase','webauthn_prf')),
  kdf_algo text NOT NULL DEFAULT 'PBKDF2-SHA256',
  kdf_salt text NOT NULL,          -- base64
  kdf_iterations integer NOT NULL DEFAULT 600000,
  wrapped_dek text NOT NULL,       -- base64 AES-GCM ciphertext of the DEK
  wrapped_dek_iv text NOT NULL,    -- base64 12-byte IV
  webauthn_credential_id text,     -- base64url, when credential_kind = webauthn_prf
  webauthn_prf_salt text,          -- base64, stable per user for PRF
  recovery_wrapped_dek text,       -- base64 ciphertext under recovery key
  recovery_wrapped_dek_iv text,
  recovery_salt text,              -- base64
  recovery_verifier text,          -- base64 SHA-256(recovery_key) — for "have you kept it?" checks
  lock_timeout_seconds integer NOT NULL DEFAULT 900 CHECK (lock_timeout_seconds BETWEEN 60 AND 86400),
  last_unlocked_at timestamptz,
  last_rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_config TO authenticated;
GRANT ALL ON public.vault_config TO service_role;
ALTER TABLE public.vault_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault_config_self_all" ON public.vault_config FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER vault_config_set_updated_at
  BEFORE UPDATE ON public.vault_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
