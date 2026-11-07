-- Signed-out visitors call no account function (169, privilege escalation).
-- Both functions already refuse or do nothing for a caller with no account, but
-- the grant itself is the boundary: a function anonymous callers cannot execute
-- cannot be turned against an account by a future edit of its body.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.ocade_save_notification_preferences(boolean, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ocade_delete_all_library_items() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_save_notification_preferences(boolean, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_delete_all_library_items() TO authenticated;
COMMIT;
