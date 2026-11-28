BEGIN;
DROP TRIGGER IF EXISTS ocade_profile_inherits_free_window ON public.profiles;
DROP FUNCTION IF EXISTS public.ocade_profile_inherits_free_window();
DROP FUNCTION IF EXISTS public.ocade_free_identity_key(text);
DROP FUNCTION IF EXISTS public.ocade_canonical_mailbox(text);
DROP TABLE IF EXISTS public.ocade_free_identity_salt;
DROP TABLE IF EXISTS public.ocade_free_identity;
COMMIT;
