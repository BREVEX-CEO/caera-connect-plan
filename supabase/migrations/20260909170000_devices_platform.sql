-- One device registry, and it is the account's.
--
-- Paired phones were kept in `localStorage` under `caera:devices:v1` while
-- `public.devices` held the same idea for browsers and PCs. Two registries for
-- one question — "which devices may act for this account" — is the defect, and
-- here it is a safety-critical one: a REVOCATION that lives only in the browser
-- it was performed in is not a revocation. Somebody who loses a phone and
-- revokes it from a laptop would find the phone still trusted on every other
-- device they own, and the revocation gone entirely once that laptop's storage
-- was cleared.
--
-- `platform` is the one field the browser store held that the table did not. It
-- is nullable because rows written before this migration genuinely do not know
-- it, and guessing from a user-agent string would put a value in a column that
-- a person is shown as fact.

BEGIN;

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS platform TEXT
    CHECK (platform IS NULL OR platform IN ('windows', 'macos', 'android', 'ios'));

COMMENT ON COLUMN public.devices.platform IS
  'The operating system this device pairs from. Null on rows registered before it was recorded; never inferred.';

-- The mobile screen lists a person's devices newest first and separates the
-- revoked from the active. Without this it is a sequential scan of every device
-- every account has ever registered.
CREATE INDEX IF NOT EXISTS devices_user_created_idx
  ON public.devices (user_id, created_at DESC);

COMMIT;
