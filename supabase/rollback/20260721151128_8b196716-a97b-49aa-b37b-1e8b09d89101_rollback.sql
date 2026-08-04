-- Rollback for 20260721151128 (FICIA HR: locations, departments, teams,
-- employments, custom roles, role grants, approval policies/requests/decisions).
-- Idempotent, reverse FK order. Not applied automatically here.
-- NOTE: set_updated_at() is CREATE OR REPLACE here but owned by the base
-- migration (20260720120222), so it is intentionally NOT dropped.
BEGIN;
DROP TABLE IF EXISTS public.ficia_approval_decisions CASCADE;
DROP TABLE IF EXISTS public.ficia_approval_requests CASCADE;
DROP TABLE IF EXISTS public.ficia_approval_policies CASCADE;
DROP TABLE IF EXISTS public.ficia_role_grants CASCADE;
DROP TABLE IF EXISTS public.ficia_custom_roles CASCADE;
DROP TABLE IF EXISTS public.ficia_employments CASCADE;
DROP TABLE IF EXISTS public.ficia_teams CASCADE;
DROP TABLE IF EXISTS public.ficia_departments CASCADE;
DROP TABLE IF EXISTS public.ficia_locations CASCADE;
DROP FUNCTION IF EXISTS public.ficia_has_permission(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.ficia_sync_membership();
DROP FUNCTION IF EXISTS public.is_tenant_owner_or_manager(uuid, uuid);
DROP TYPE IF EXISTS public.approval_decision;
DROP TYPE IF EXISTS public.approval_status;
DROP TYPE IF EXISTS public.approval_subject;
DROP TYPE IF EXISTS public.employment_status;
DROP TYPE IF EXISTS public.worker_type;
COMMIT;
