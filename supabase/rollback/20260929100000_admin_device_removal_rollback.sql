-- Remove operator device removal. Customers can still forget their own devices.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_admin_remove_device(uuid, text);
DROP TABLE IF EXISTS public.ocade_admin_actions;
COMMIT;
