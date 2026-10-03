-- Undo: the account may write its profile address again (20260918081533).
BEGIN;
DROP TRIGGER IF EXISTS ocade_profile_follows_sign_in ON auth.users;
DROP FUNCTION IF EXISTS private.ocade_profile_follows_sign_in();
GRANT UPDATE (email, phone) ON public.profiles TO authenticated;
COMMIT;
