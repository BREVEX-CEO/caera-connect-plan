-- Return to bearer-token pairing. Every enrolled device is removed, because a
-- public key cannot be turned back into a token: each device must pair again.
BEGIN;

DELETE FROM public.jarvis_permissions
 WHERE capability IN ('terminal', 'cowork') OR capability LIKE 'app:%';
ALTER TABLE public.jarvis_permissions DROP CONSTRAINT IF EXISTS jarvis_permissions_capability_check;
ALTER TABLE public.jarvis_permissions ADD CONSTRAINT jarvis_permissions_capability_check CHECK (
  capability IN ('master', 'memory', 'autonomous', 'browser', 'browser_real', 'files',
    'screen', 'microphone', 'camera', 'apps', 'messaging', 'devices', 'computer_control')
  OR capability ~ '^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'
);

DROP INDEX IF EXISTS public.jarvis_tasks_one_open_per_device;
ALTER TABLE public.jarvis_tasks DROP CONSTRAINT IF EXISTS jarvis_tasks_checkpoint_shape;
ALTER TABLE public.jarvis_tasks DROP COLUMN IF EXISTS checkpoint, DROP COLUMN IF EXISTS controller;

DELETE FROM public.jarvis_devices;
DROP INDEX IF EXISTS public.jarvis_devices_pending_idx;
ALTER TABLE public.jarvis_devices
  DROP CONSTRAINT IF EXISTS jarvis_devices_pending_shape,
  DROP CONSTRAINT IF EXISTS jarvis_devices_installed_apps_shape,
  DROP CONSTRAINT IF EXISTS jarvis_devices_software_version_check,
  DROP CONSTRAINT IF EXISTS jarvis_devices_kind_check,
  DROP CONSTRAINT IF EXISTS jarvis_devices_public_key_shape,
  DROP CONSTRAINT IF EXISTS jarvis_devices_public_key_unique;
ALTER TABLE public.jarvis_devices
  DROP COLUMN IF EXISTS public_key,
  DROP COLUMN IF EXISTS kind,
  DROP COLUMN IF EXISTS protocol_version,
  DROP COLUMN IF EXISTS software_version,
  DROP COLUMN IF EXISTS enrollment_expires_at,
  DROP COLUMN IF EXISTS key_rotated_at,
  DROP COLUMN IF EXISTS last_request_ms,
  DROP COLUMN IF EXISTS background_enabled,
  DROP COLUMN IF EXISTS installed_apps;
ALTER TABLE public.jarvis_devices ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.jarvis_devices
  ADD COLUMN token_hash text UNIQUE,
  ADD COLUMN pairing_code_hash text UNIQUE,
  ADD COLUMN pairing_expires_at timestamptz,
  ADD CONSTRAINT jarvis_devices_hash_shape CHECK (
    (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$')
    AND (pairing_code_hash IS NULL OR pairing_code_hash ~ '^[0-9a-f]{64}$')
  );
REVOKE ALL ON TABLE public.jarvis_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, name, platform, capabilities, last_seen_at, revoked_at, created_at)
  ON public.jarvis_devices TO authenticated;

COMMIT;
