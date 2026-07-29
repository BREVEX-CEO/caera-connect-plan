-- Rollback for 20260720120222 (foundational schema: profiles, roles, tenants,
-- settings, devices, audit, feature flags, signup trigger).
--
-- Reverse-dependency order. Idempotent (IF EXISTS). Never applied automatically
-- in this environment — authored for review and for use through Lovable only.
--
-- ASSUMPTION: run as part of a reverse-order rollback (newest migration first),
-- so no later object still depends on set_updated_at() when this file executes.
-- The shared pgcrypto extension is deliberately NOT dropped — other schema and
-- Supabase internals rely on it.

BEGIN;

-- Signup trigger + its function (created last, dropped first).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Tables (CASCADE also removes their policies, triggers, indexes, grants).
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;
DROP TABLE IF EXISTS public.tenant_members CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Helper functions (after the tables/policies that referenced them are gone).
DROP FUNCTION IF EXISTS public.enforce_device_cap();
DROP FUNCTION IF EXISTS public.has_tenant_role(uuid, uuid, public.tenant_role);
DROP FUNCTION IF EXISTS public.is_tenant_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.set_updated_at();

-- Enums (after every table/function that used them is dropped).
DROP TYPE IF EXISTS public.privacy_mode;
DROP TYPE IF EXISTS public.device_kind;
DROP TYPE IF EXISTS public.tenant_role;
DROP TYPE IF EXISTS public.tenant_kind;
DROP TYPE IF EXISTS public.app_role;

-- pgcrypto intentionally retained (shared infrastructure).

COMMIT;
