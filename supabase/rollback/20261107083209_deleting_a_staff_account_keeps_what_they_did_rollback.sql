-- Restores the foreign keys as of before 20261107083209. Fails, changing nothing, if a grant
-- has already lost its granter (NOT NULL cannot be restored then).
BEGIN;
ALTER TABLE public.ocade_support_cases DROP CONSTRAINT ocade_support_cases_assignee_fkey,
  ADD CONSTRAINT ocade_support_cases_assignee_fkey
    FOREIGN KEY (assignee) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ocade_entitlement_grants DROP CONSTRAINT ocade_entitlement_grants_granted_by_fkey,
  ADD CONSTRAINT ocade_entitlement_grants_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.ocade_entitlement_grants ALTER COLUMN granted_by SET NOT NULL;
COMMIT;
