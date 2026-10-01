-- Undo browser notifications: browsers stop being reachable (each would have
-- to turn notifications on again after a reapply).
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_set_notification_delivery(uuid, text, text);
DROP FUNCTION IF EXISTS public.ocade_push_unsubscribe(text);
DROP FUNCTION IF EXISTS public.ocade_push_subscribe(text, text, text);
DROP TABLE IF EXISTS public.ocade_push_subscriptions;
COMMIT;
