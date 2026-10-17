-- PLAN Phase 08 V10: support reads only what the customer chose to share, while they share it.
--
-- A case limited its reader, conversation and expiry, but the customer was only told; nothing
-- needed their approval, and the conversation titles were listed before any case existed.
-- Now the customer shares one conversation with support for up to 72 hours and can withdraw
-- it at any time. Without a live share staff see no title, open no case and read nothing; a
-- case never outlasts its share, and withdrawing ends reading at once.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ocade_support_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation uuid NOT NULL REFERENCES public.ocade_conversations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ocade_support_shares_live
  ON public.ocade_support_shares (customer, conversation) WHERE revoked_at IS NULL;
ALTER TABLE public.ocade_support_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocade_support_shares FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ocade_support_shares TO authenticated;
DROP POLICY IF EXISTS ocade_support_shares_own ON public.ocade_support_shares;
CREATE POLICY ocade_support_shares_own ON public.ocade_support_shares
  FOR SELECT TO authenticated USING (customer = (SELECT auth.uid()));

-- Until when the customer shares this conversation with support, or NULL.
CREATE OR REPLACE FUNCTION private.ocade_support_shared_until(p_customer uuid, p_conversation uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT max(s.expires_at) FROM public.ocade_support_shares AS s
   WHERE s.customer = p_customer AND s.conversation = p_conversation
     AND s.revoked_at IS NULL AND s.expires_at > now();
$$;
REVOKE ALL ON FUNCTION private.ocade_support_shared_until(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_support_share(p_conversation uuid, p_hours integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_share uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.ocade_conversations AS v
        WHERE v.id = p_conversation AND v.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 72 THEN
    RAISE EXCEPTION 'Share it for between 1 and 72 hours.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ocade_support_shares (customer, conversation, expires_at)
  VALUES (auth.uid(), p_conversation, now() + make_interval(hours => p_hours))
  RETURNING id INTO v_share;
  RETURN v_share;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_support_share(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_support_share(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.ocade_support_unshare(p_conversation uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.ocade_support_shares SET revoked_at = now()
   WHERE customer = auth.uid() AND conversation = p_conversation AND revoked_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.ocade_support_unshare(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_support_unshare(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ocade_case_conversations(p_customer uuid)
RETURNS TABLE (id uuid, title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.ocade_staff_check('cases.manage', 'open a support case');
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_customer, 'case_read', 'Listed the conversations the customer shared, to open a case.');
  -- Only what the customer shared, and only while the share lasts: not even a title else.
  RETURN QUERY
    SELECT v.id, v.title FROM public.ocade_conversations AS v
     WHERE v.user_id = p_customer
       AND private.ocade_support_shared_until(p_customer, v.id) IS NOT NULL
     ORDER BY v.updated_at DESC
     LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_case_open(
  p_customer uuid, p_reason text, p_hours integer, p_conversation uuid, p_assignee uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_case uuid;
  v_reader uuid := COALESCE(p_assignee, auth.uid());
  v_shared_until timestamptz;
BEGIN
  PERFORM private.ocade_staff_require('cases.manage', 'open a support case');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 72 THEN
    RAISE EXCEPTION 'A case lasts between 1 and 72 hours.' USING ERRCODE = '22023';
  END IF;
  IF p_customer = auth.uid() THEN
    RAISE EXCEPTION 'A case is about somebody else''s account.' USING ERRCODE = '22023';
  END IF;
  IF p_conversation IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.ocade_conversations AS v
        WHERE v.id = p_conversation AND v.user_id = p_customer) THEN
    RAISE EXCEPTION 'Choose one of this customer''s conversations.' USING ERRCODE = '22023';
  END IF;
  -- The customer's own share decides, not a notification: no share, no case.
  v_shared_until := private.ocade_support_shared_until(p_customer, p_conversation);
  IF v_shared_until IS NULL THEN
    RAISE EXCEPTION 'The customer has not shared that conversation with support.' USING ERRCODE = '42501';
  END IF;
  IF v_reader = p_customer OR NOT private.ocade_staff_user_has(v_reader, 'cases.read') THEN
    RAISE EXCEPTION 'The person reading must be staff who may read cases.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ocade_support_cases (customer, opened_by, assignee, conversation, reason, expires_at)
  VALUES (p_customer, auth.uid(), v_reader, p_conversation, btrim(p_reason),
          LEAST(now() + make_interval(hours => p_hours), v_shared_until))
  RETURNING id INTO v_case;
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (auth.uid(), p_customer, v_case, 'case_open', btrim(p_reason));
  RETURN v_case;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_case_messages(p_case uuid, p_conversation uuid)
RETURNS TABLE (role text, content text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_customer uuid;
BEGIN
  IF NOT public.ocade_staff_can('cases.read') THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
  -- Only the case's named reader, only its one conversation, only while it is open.
  SELECT c.customer INTO v_customer FROM public.ocade_support_cases AS c
   WHERE c.id = p_case AND c.closed_at IS NULL AND c.expires_at > now()
     AND c.assignee = auth.uid() AND c.conversation = p_conversation;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'This case is closed, has expired or is not yours to read.' USING ERRCODE = '42501';
  END IF;
  -- Withdrawn or lapsed share: the case reads nothing more.
  IF private.ocade_support_shared_until(v_customer, p_conversation) IS NULL THEN
    RAISE EXCEPTION 'The customer no longer shares that conversation with support.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (auth.uid(), v_customer, p_case, 'case_read', 'Read the conversation under an open case.');
  RETURN QUERY
    SELECT m.role, m.content, m.created_at FROM public.ocade_messages AS m
     WHERE m.conversation_id = p_conversation AND m.user_id = v_customer
     ORDER BY m.created_at
     LIMIT 500;
END;
$$;
COMMIT;
