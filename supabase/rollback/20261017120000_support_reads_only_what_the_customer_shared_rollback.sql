-- Undo 20261017120000: cases no longer need the customer's share (titles listed before a case).
BEGIN;
CREATE OR REPLACE FUNCTION public.ocade_case_conversations(p_customer uuid)
RETURNS TABLE (id uuid, title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.ocade_staff_check('cases.manage', 'open a support case');
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_customer, 'case_read', 'Listed conversation titles to open a case.');
  RETURN QUERY
    SELECT v.id, v.title FROM public.ocade_conversations AS v
     WHERE v.user_id = p_customer
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
  IF v_reader = p_customer OR NOT private.ocade_staff_user_has(v_reader, 'cases.read') THEN
    RAISE EXCEPTION 'The person reading must be staff who may read cases.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ocade_support_cases (customer, opened_by, assignee, conversation, reason, expires_at)
  VALUES (p_customer, auth.uid(), v_reader, p_conversation, btrim(p_reason),
          now() + make_interval(hours => p_hours))
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
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (auth.uid(), v_customer, p_case, 'case_read', 'Read the conversation under an open case.');
  RETURN QUERY
    SELECT m.role, m.content, m.created_at FROM public.ocade_messages AS m
     WHERE m.conversation_id = p_conversation AND m.user_id = v_customer
     ORDER BY m.created_at
     LIMIT 500;
END;
$$;

DROP FUNCTION IF EXISTS public.ocade_support_unshare(uuid);
DROP FUNCTION IF EXISTS public.ocade_support_share(uuid, integer);
DROP FUNCTION IF EXISTS private.ocade_support_shared_until(uuid, uuid);
DROP TABLE IF EXISTS public.ocade_support_shares;
COMMIT;
