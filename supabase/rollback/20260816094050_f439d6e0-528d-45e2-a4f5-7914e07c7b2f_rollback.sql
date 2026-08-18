-- Rollback for profile contact columns and the admin read policies.
--
-- The email/phone columns are mirrored from auth.users and can be rebuilt by
-- re-running the migration, so dropping them loses nothing that is not already
-- held in the auth schema. handle_new_user() is deliberately left in place:
-- removing the trigger function would stop new accounts getting a profile,
-- settings row and default role, which is worse than the change being undone.

BEGIN;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS email;

COMMIT;
