-- Rollback for 20260904090000_notification_preferences_and_history.
--
-- DESTRUCTIVE, and it says so at the top rather than in a note somewhere. This
-- drops the notification history, which is a record of what a person was told —
-- including the security alerts they were told. Rolling this back on a
-- deployment that has been running is not a neutral undo.
--
-- The preference document goes with it. Every device falls back to the local
-- copy `notifications/preference-store.ts` already keeps, so nobody is left
-- without settings; they simply stop following the person between devices,
-- which is where they were before this migration.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_save_notification_preferences(boolean, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.ocade_record_notification(uuid, text, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.ocade_mark_all_notifications_read();
DROP FUNCTION IF EXISTS public.ocade_mark_notification_read(uuid);

DROP TABLE IF EXISTS public.ocade_notifications;
DROP TABLE IF EXISTS public.ocade_notification_preferences;

COMMIT;
