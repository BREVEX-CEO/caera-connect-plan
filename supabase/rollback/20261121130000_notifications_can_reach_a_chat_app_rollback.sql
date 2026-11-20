-- Rollback of 20261121130000: chat-app addresses are removed; deliveries no longer name `chat`.
BEGIN;
DROP TABLE IF EXISTS public.ocade_chat_hooks;
CREATE OR REPLACE FUNCTION public.ocade_set_notification_delivery(p_id uuid, p_channel text, p_state text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_channel NOT IN ('in_app', 'email', 'web_push')
     OR p_state NOT IN ('sent', 'held', 'unavailable', 'failed', 'dead_letter') THEN
    RAISE EXCEPTION 'Unknown delivery channel or state' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_notifications
     SET delivery = jsonb_set(COALESCE(delivery, '{}'::jsonb), ARRAY[p_channel], to_jsonb(p_state))
   WHERE id = p_id;
END;
$$;
COMMIT;
