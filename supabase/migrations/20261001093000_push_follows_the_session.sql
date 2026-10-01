-- A BROWSER'S NOTIFICATIONS END WITH ITS SESSION.
--
-- 20261001091000 kept a browser's push address per account only, so a session
-- ended by "sign out everywhere", an emergency sign-out or a lost device's
-- removal left that browser showing the account's reminders and task titles on
-- its lock screen. The address now belongs to the session that turned it on and
-- goes when that session goes. And an address already recorded moves to another
-- account only when the same browser presents it (the same keys): knowing
-- somebody's push address is not enough to take their notifications away.
BEGIN;

ALTER TABLE public.ocade_push_subscriptions
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES auth.sessions (id) ON DELETE CASCADE;
-- Addresses recorded before this knew no session; their browsers turn it on again.
DELETE FROM public.ocade_push_subscriptions WHERE session_id IS NULL;
ALTER TABLE public.ocade_push_subscriptions ALTER COLUMN session_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS ocade_push_subscriptions_session
  ON public.ocade_push_subscriptions (session_id);

CREATE OR REPLACE FUNCTION public.ocade_push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session uuid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  v_written integer;
BEGIN
  IF v_user IS NULL OR v_session IS NULL THEN
    RAISE EXCEPTION 'Sign in to turn on notifications.' USING ERRCODE = '42501';
  END IF;
  IF p_endpoint IS NULL OR length(p_endpoint) > 1000
     OR p_endpoint !~ '^(https://|http://127\.0\.0\.1:)'
     OR p_p256dh IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{80,100}$'
     OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{16,32}$' THEN
    RAISE EXCEPTION 'That is not a browser''s notification address.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ocade_push_subscriptions (endpoint, user_id, session_id, p256dh, auth)
  VALUES (p_endpoint, v_user, v_session, p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id, session_id = EXCLUDED.session_id,
        created_at = now(), failures = 0
    WHERE public.ocade_push_subscriptions.p256dh = EXCLUDED.p256dh
      AND public.ocade_push_subscriptions.auth = EXCLUDED.auth;
  GET DIAGNOSTICS v_written = ROW_COUNT;
  IF v_written = 0 THEN
    RAISE EXCEPTION 'That is not a browser''s notification address.' USING ERRCODE = '22023';
  END IF;
  -- Twenty browsers is plenty for one person; the oldest goes first.
  DELETE FROM public.ocade_push_subscriptions
   WHERE user_id = v_user
     AND endpoint NOT IN (SELECT endpoint FROM public.ocade_push_subscriptions
                           WHERE user_id = v_user ORDER BY created_at DESC LIMIT 20);
END;
$$;

COMMIT;
