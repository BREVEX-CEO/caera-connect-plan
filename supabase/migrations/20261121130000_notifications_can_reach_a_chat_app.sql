-- CHAT-APP NOTIFICATIONS (REPO-20): one incoming-webhook address per person, of their own Slack,
-- Discord, Microsoft Teams or ntfy channel. Notification only; the address is the person's own
-- row (it works like a password for that channel, so only they and the server read it). The
-- delivery record gains the `chat` channel.
BEGIN;

CREATE TABLE public.ocade_chat_hooks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  url text NOT NULL,
  failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_chat_hooks_kind_check CHECK (kind IN ('slack', 'discord', 'teams', 'ntfy')),
  CONSTRAINT ocade_chat_hooks_url_check CHECK (
    length(url) <= 700 AND url ~ '^https://(hooks\.slack\.com|discord\.com|discordapp\.com|ntfy\.sh|[a-z0-9-]{1,63}\.(webhook\.office\.com|logic\.azure\.com))/')
);
ALTER TABLE public.ocade_chat_hooks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_chat_hooks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.ocade_chat_hooks TO authenticated;
GRANT UPDATE (kind, url) ON TABLE public.ocade_chat_hooks TO authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.ocade_chat_hooks TO service_role;
CREATE POLICY ocade_chat_hooks_own ON public.ocade_chat_hooks FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY ocade_chat_hooks_service ON public.ocade_chat_hooks FOR ALL TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.ocade_set_notification_delivery(p_id uuid, p_channel text, p_state text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_channel NOT IN ('in_app', 'email', 'web_push', 'chat')
     OR p_state NOT IN ('sent', 'held', 'unavailable', 'failed', 'dead_letter') THEN
    RAISE EXCEPTION 'Unknown delivery channel or state' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_notifications
     SET delivery = jsonb_set(COALESCE(delivery, '{}'::jsonb), ARRAY[p_channel], to_jsonb(p_state))
   WHERE id = p_id;
END;
$$;

COMMIT;
