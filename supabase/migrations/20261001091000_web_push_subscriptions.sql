-- BROWSER NOTIFICATIONS: WHERE EACH OF A PERSON'S BROWSERS ASKED TO BE REACHED.
--
-- A browser that turned notifications on gives OCADE its push service address
-- and two public keys. They are kept per account; only the server reads them,
-- to send. A browser records or removes only its own, for the account signed
-- in now: the same browser later signed in to another account belongs to that
-- one (a shared computer must not keep receiving the last person's alerts).
BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  failures integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ocade_push_subscriptions_user ON public.ocade_push_subscriptions (user_id);
ALTER TABLE public.ocade_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.ocade_push_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.ocade_push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to turn on notifications.' USING ERRCODE = '42501';
  END IF;
  IF p_endpoint IS NULL OR length(p_endpoint) > 1000
     OR p_endpoint !~ '^(https://|http://127\.0\.0\.1:)'
     OR p_p256dh IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{80,100}$'
     OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{16,32}$' THEN
    RAISE EXCEPTION 'That is not a browser''s notification address.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ocade_push_subscriptions (endpoint, user_id, p256dh, auth)
  VALUES (p_endpoint, v_user, p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
        created_at = now(), failures = 0;
  -- Twenty browsers is plenty for one person; the oldest goes first.
  DELETE FROM public.ocade_push_subscriptions
   WHERE user_id = v_user
     AND endpoint NOT IN (SELECT endpoint FROM public.ocade_push_subscriptions
                           WHERE user_id = v_user ORDER BY created_at DESC LIMIT 20);
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_push_unsubscribe(p_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  DELETE FROM public.ocade_push_subscriptions
   WHERE endpoint = p_endpoint AND user_id = auth.uid();
$$;

-- What happened on one channel, written after the provider answered. Server only.
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

REVOKE ALL ON FUNCTION public.ocade_push_subscribe(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_push_unsubscribe(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_set_notification_delivery(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_push_subscribe(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_push_unsubscribe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_set_notification_delivery(uuid, text, text) TO service_role;

COMMIT;
