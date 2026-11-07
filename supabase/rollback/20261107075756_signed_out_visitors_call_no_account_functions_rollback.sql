-- Restores the anonymous execute grants removed by 20261107075756.
BEGIN;
GRANT EXECUTE ON FUNCTION public.ocade_save_notification_preferences(boolean, jsonb, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.ocade_delete_all_library_items() TO PUBLIC, anon;
COMMIT;
