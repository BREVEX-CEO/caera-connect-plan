-- Deleting an account must never be blocked or erase other people's records (179).
-- A staff member who once granted a plan could not have their own account deleted
-- (granted_by ON DELETE RESTRICT), and deleting a staff member who was assigned a
-- customer's case deleted the case itself (assignee ON DELETE CASCADE). Both now keep
-- the record and forget who it was, like every other "who did this" column.
BEGIN;
ALTER TABLE public.ocade_entitlement_grants ALTER COLUMN granted_by DROP NOT NULL;
ALTER TABLE public.ocade_entitlement_grants DROP CONSTRAINT ocade_entitlement_grants_granted_by_fkey,
  ADD CONSTRAINT ocade_entitlement_grants_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ocade_support_cases DROP CONSTRAINT ocade_support_cases_assignee_fkey,
  ADD CONSTRAINT ocade_support_cases_assignee_fkey
    FOREIGN KEY (assignee) REFERENCES auth.users(id) ON DELETE SET NULL;
COMMIT;
