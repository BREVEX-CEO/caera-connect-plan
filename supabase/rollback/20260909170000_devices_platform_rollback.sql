-- Reverses 20260909170000_devices_platform.sql.
--
-- Dropping `platform` loses which operating system each paired device runs.
-- The device, its trust and its revocation are unaffected — they live in the
-- columns this migration did not touch.

BEGIN;

DROP INDEX IF EXISTS public.devices_user_created_idx;

ALTER TABLE public.devices
  DROP COLUMN IF EXISTS platform;

COMMIT;
