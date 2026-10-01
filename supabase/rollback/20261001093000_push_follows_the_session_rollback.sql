-- Undo: addresses belong to the account alone again (20261001091000's function).
BEGIN;
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
  DELETE FROM public.ocade_push_subscriptions
   WHERE user_id = v_user
     AND endpoint NOT IN (SELECT endpoint FROM public.ocade_push_subscriptions
                           WHERE user_id = v_user ORDER BY created_at DESC LIMIT 20);
END;
$$;
DROP INDEX IF EXISTS public.ocade_push_subscriptions_session;
ALTER TABLE public.ocade_push_subscriptions DROP COLUMN IF EXISTS session_id;
COMMIT;
