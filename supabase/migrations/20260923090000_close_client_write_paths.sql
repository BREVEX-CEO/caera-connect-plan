-- Close write paths a browser session never needs.
--
-- F02: `user_roles` accepted INSERT/UPDATE/DELETE from any admin session at
-- AAL1, a weaker door than the AAL2 grant function. No product code writes
-- roles; they are managed by the service role only, so the policies and the
-- grants go.
--
-- F05: Supabase's default privileges left TRUNCATE, TRIGGER and REFERENCES on
-- every public table for `anon` and `authenticated`. Row-level security does
-- not apply to TRUNCATE. Nothing in the product needs any of the three.
--
-- F15: `ocade_entitlement_grants.revoked_by` is a foreign key with no index,
-- so deleting a user scanned the table.
--
-- F27: Chat is the only generation surface. Every stored permit is `chat`, so
-- the constraint narrows without touching history.

BEGIN;

DROP POLICY IF EXISTS ocade_consolidated_insert ON public.user_roles;
DROP POLICY IF EXISTS ocade_consolidated_update ON public.user_roles;
DROP POLICY IF EXISTS ocade_consolidated_delete ON public.user_roles;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- Tables whose rows only server functions write.
REVOKE INSERT, UPDATE, DELETE ON public.ocade_entitlement_grants FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ocade_commercial_usage FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.storage_tombstones FROM anon, authenticated;
REVOKE DELETE ON public.profiles FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS ocade_entitlement_grants_revoked_by_idx
  ON public.ocade_entitlement_grants (revoked_by);

ALTER TABLE public.ocade_generation_permits
  DROP CONSTRAINT IF EXISTS ocade_generation_permits_surface_check;
ALTER TABLE public.ocade_generation_permits
  ADD CONSTRAINT ocade_generation_permits_surface_check CHECK (surface = 'chat');

ALTER TABLE public.ocade_offline_usage_events
  DROP CONSTRAINT IF EXISTS ocade_offline_usage_events_surface_check;
ALTER TABLE public.ocade_offline_usage_events
  ADD CONSTRAINT ocade_offline_usage_events_surface_check CHECK (surface = 'chat');

COMMIT;
