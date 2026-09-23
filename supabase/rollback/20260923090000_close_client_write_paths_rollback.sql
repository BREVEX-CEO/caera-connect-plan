-- Restore the wider surface constraints and drop the added index.
--
-- The revoked privileges and role-write policies are deliberately NOT restored:
-- they were the defect. Re-granting them needs a new forward migration and a
-- reason.
BEGIN;

DROP INDEX IF EXISTS public.ocade_entitlement_grants_revoked_by_idx;

ALTER TABLE public.ocade_generation_permits
  DROP CONSTRAINT IF EXISTS ocade_generation_permits_surface_check;
ALTER TABLE public.ocade_generation_permits
  ADD CONSTRAINT ocade_generation_permits_surface_check CHECK (surface = ANY (ARRAY[
    'chat', 'cowork', 'code', 'task', 'automation', 'background_agent', 'voice', 'artifact'
  ]));

ALTER TABLE public.ocade_offline_usage_events
  DROP CONSTRAINT IF EXISTS ocade_offline_usage_events_surface_check;
ALTER TABLE public.ocade_offline_usage_events
  ADD CONSTRAINT ocade_offline_usage_events_surface_check CHECK (surface = ANY (ARRAY[
    'chat', 'cowork', 'code', 'task', 'automation', 'background_agent', 'voice', 'artifact'
  ]));

COMMIT;
