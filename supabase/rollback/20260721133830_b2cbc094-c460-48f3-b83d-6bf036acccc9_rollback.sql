-- Rollback for 20260721133830 (activity_log, browser_grants, device uniqueness,
-- purpose/compliance enums). Idempotent, reverse order. Not applied automatically.
--
-- NOTE: enforce_device_cap() is CREATE OR REPLACE here but was first created by
-- the foundational migration (20260720120222), so it is intentionally NOT dropped
-- — its own lifecycle belongs to the base migration's rollback.
BEGIN;
DROP TABLE IF EXISTS public.browser_grants CASCADE;
DROP TABLE IF EXISTS public.activity_log CASCADE;
DROP INDEX IF EXISTS public.devices_user_physical_pc_uniq;
DROP TYPE IF EXISTS public.compliance_category;
DROP TYPE IF EXISTS public.main_purpose_kind;
COMMIT;
