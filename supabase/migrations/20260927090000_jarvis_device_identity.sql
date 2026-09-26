-- OCADE JARVIS: per-device cryptographic identity, one UI controller, checkpoints.
--
-- ONE KEY PER DEVICE, NEVER A SHARED SECRET. A Device Agent or the browser
-- extension creates its own P-256 key pair on the device and enrolls only the
-- PUBLIC key. Every request it makes is signed; the server stores nothing that
-- could impersonate it. This replaces the earlier bearer token and typed
-- pairing code, which production never held (no device was ever paired).
--
-- ENROLLMENT WITHOUT CODES. A new device registers its public key as a pending
-- row (no account yet). The person, already signed in, approves it once in
-- OCADE; only then does the row belong to an account. A pending row expires in
-- ten minutes and is never visible to any browser role.
--
-- REPLAY. Each signed request carries a millisecond timestamp that must be
-- newer than the last one this device used, so a captured request cannot be
-- sent twice.
--
-- ONE CONTROLLER. A device runs one unfinished task at a time, and each task
-- names the one planning loop (`controller`) allowed to queue its actions, so
-- two tabs or two devices can never drive the same screen at once.

BEGIN;

-- 1. Device identity -------------------------------------------------------------

DELETE FROM public.jarvis_devices WHERE token_hash IS NULL AND revoked_at IS NULL;

ALTER TABLE public.jarvis_devices DROP CONSTRAINT IF EXISTS jarvis_devices_hash_shape;
ALTER TABLE public.jarvis_devices
  DROP COLUMN IF EXISTS token_hash,
  DROP COLUMN IF EXISTS pairing_code_hash,
  DROP COLUMN IF EXISTS pairing_expires_at;

ALTER TABLE public.jarvis_devices ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.jarvis_devices
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS protocol_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS software_version text,
  ADD COLUMN IF NOT EXISTS enrollment_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS key_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_request_ms bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS background_enabled boolean NOT NULL DEFAULT false,
  -- Names of apps the device found locally, for Allowed Apps. Names only.
  ADD COLUMN IF NOT EXISTS installed_apps jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.jarvis_devices
  DROP CONSTRAINT IF EXISTS jarvis_devices_public_key_unique,
  DROP CONSTRAINT IF EXISTS jarvis_devices_public_key_shape,
  DROP CONSTRAINT IF EXISTS jarvis_devices_kind_check,
  DROP CONSTRAINT IF EXISTS jarvis_devices_software_version_check,
  DROP CONSTRAINT IF EXISTS jarvis_devices_pending_shape,
  DROP CONSTRAINT IF EXISTS jarvis_devices_installed_apps_shape;
ALTER TABLE public.jarvis_devices
  ADD CONSTRAINT jarvis_devices_public_key_unique UNIQUE (public_key),
  ADD CONSTRAINT jarvis_devices_public_key_shape
    CHECK (public_key IS NULL OR public_key ~ '^[A-Za-z0-9_-]{80,200}$'),
  ADD CONSTRAINT jarvis_devices_kind_check CHECK (kind IN ('agent', 'extension')),
  ADD CONSTRAINT jarvis_devices_software_version_check
    CHECK (software_version IS NULL OR length(software_version) <= 40),
  ADD CONSTRAINT jarvis_devices_installed_apps_shape CHECK (
    jsonb_typeof(installed_apps) = 'array' AND pg_column_size(installed_apps) <= 32768
  ),
  -- A row without an account is a pending enrollment, and nothing else.
  ADD CONSTRAINT jarvis_devices_pending_shape CHECK (
    (user_id IS NULL) = (enrollment_expires_at IS NOT NULL)
    AND (user_id IS NOT NULL OR (public_key IS NOT NULL AND revoked_at IS NULL))
  );

CREATE INDEX IF NOT EXISTS jarvis_devices_pending_idx
  ON public.jarvis_devices (enrollment_expires_at) WHERE user_id IS NULL;

REVOKE ALL ON TABLE public.jarvis_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, user_id, name, platform, capabilities, last_seen_at, revoked_at, created_at,
  kind, protocol_version, software_version, key_rotated_at, background_enabled, installed_apps
) ON public.jarvis_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jarvis_devices TO service_role;

-- 2. New decisions: commands, Co-work, and Allowed Apps (Always/Never; Ask is no row) --

ALTER TABLE public.jarvis_permissions DROP CONSTRAINT IF EXISTS jarvis_permissions_capability_check;
ALTER TABLE public.jarvis_permissions ADD CONSTRAINT jarvis_permissions_capability_check CHECK (
  capability IN ('master', 'memory', 'autonomous', 'browser', 'browser_real', 'files',
    'screen', 'microphone', 'camera', 'apps', 'messaging', 'devices', 'computer_control',
    'terminal', 'cowork')
  OR capability ~ '^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'
  OR capability ~ '^app:[a-z0-9_ .+&()''-]{1,80}$'
);

-- 3. One controller, one device, and a durable checkpoint --------------------------

ALTER TABLE public.jarvis_tasks
  ADD COLUMN IF NOT EXISTS controller uuid,
  ADD COLUMN IF NOT EXISTS checkpoint jsonb;
ALTER TABLE public.jarvis_tasks DROP CONSTRAINT IF EXISTS jarvis_tasks_checkpoint_shape;
ALTER TABLE public.jarvis_tasks
  ADD CONSTRAINT jarvis_tasks_checkpoint_shape CHECK (
    checkpoint IS NULL
    OR (jsonb_typeof(checkpoint) = 'object' AND pg_column_size(checkpoint) <= 8192)
  );

-- One unfinished task per device: its screen and input have one owner.
CREATE UNIQUE INDEX IF NOT EXISTS jarvis_tasks_one_open_per_device
  ON public.jarvis_tasks (device_id)
  WHERE device_id IS NOT NULL AND status IN ('running', 'waiting', 'taken_over');

COMMIT;
