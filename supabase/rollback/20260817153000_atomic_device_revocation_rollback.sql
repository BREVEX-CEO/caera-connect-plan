-- Rollback for the atomic device-revocation function.
--
-- Dropping the function returns revocation to the client-side sequential
-- writes it replaced, so only roll this back together with the client change
-- that stops calling the RPC — otherwise Revoke stops working entirely.
-- No device or grant row is touched here: revocations already recorded stay
-- recorded.

BEGIN;

DROP FUNCTION IF EXISTS public.revoke_device_for_current_user(UUID);

COMMIT;
