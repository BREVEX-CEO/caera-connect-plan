-- Rollback for 20260902130000_account_session_authority.
--
-- Drops the session listing and revocation functions.
--
-- WHAT THIS COSTS, SAID PLAINLY: the Security page can no longer show which
-- sessions are signed in, and "sign out of this other device" stops working.
-- Global sign-out through Supabase's own logout endpoint is unaffected, so
-- nobody is left without any way to end a session — they lose the targeted one.
--
-- No data is destroyed. These functions only read and delete rows in
-- `auth.sessions`, which Supabase owns and continues to manage.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_session_is_live(UUID, UUID);
DROP FUNCTION IF EXISTS public.ocade_revoke_other_account_sessions(UUID, UUID);
DROP FUNCTION IF EXISTS public.ocade_revoke_account_session(UUID, UUID);
DROP FUNCTION IF EXISTS public.ocade_list_account_sessions(UUID);

COMMIT;
