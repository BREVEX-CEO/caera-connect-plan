-- Undo: the 20260930093000 / 20261001096000 / 20260902120000 definitions.
BEGIN;

ALTER TABLE public.ocade_library_items DROP CONSTRAINT IF EXISTS ocade_library_items_own_folder;

DROP FUNCTION IF EXISTS public.ocade_case_open(uuid, text, integer, uuid, uuid);
DROP FUNCTION IF EXISTS public.ocade_case_conversations(uuid);
CREATE FUNCTION public.ocade_case_open(p_customer uuid, p_reason text, p_hours integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_case uuid;
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
  INSERT INTO public.ocade_support_cases (customer, opened_by, reason, expires_at)
  VALUES (p_customer, auth.uid(), btrim(p_reason), now() + make_interval(hours => p_hours))
  RETURNING id INTO v_case;
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (auth.uid(), p_customer, v_case, 'case_open', btrim(p_reason));
  RETURN v_case;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_case_open(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_case_open(uuid, text, integer) TO authenticated;

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
  SELECT c.customer INTO v_customer FROM public.ocade_support_cases AS c
   WHERE c.id = p_case AND c.closed_at IS NULL AND c.expires_at > now();
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'This case is closed or has expired.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ocade_conversations AS v
                  WHERE v.id = p_conversation AND v.user_id = v_customer) THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (auth.uid(), v_customer, p_case, 'case_read', 'Read a conversation under an open case.');
  RETURN QUERY
    SELECT m.role, m.content, m.created_at FROM public.ocade_messages AS m
     WHERE m.conversation_id = p_conversation AND m.user_id = v_customer
     ORDER BY m.created_at
     LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_staff_set_permissions(
  p_user uuid, p_granted text[], p_denied text[], p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_user = v_me THEN
    RAISE EXCEPTION 'Nobody changes their own access.' USING ERRCODE = '42501';
  END IF;
  v_role := private.ocade_staff_role_of(p_user);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF v_role = 'primary_owner'
     OR (v_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner') THEN
    RAISE EXCEPTION 'Only the Primary Owner changes an owner''s access.' USING ERRCODE = '42501';
  END IF;
  IF NOT private.ocade_staff_role_of(v_me) IN ('primary_owner', 'backup_owner')
     AND EXISTS (SELECT 1 FROM unnest(COALESCE(p_granted, '{}')) AS p(name)
                  WHERE NOT private.ocade_staff_has(p.name)) THEN
    RAISE EXCEPTION 'You can only give access you hold yourself.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ocade_staff
     SET granted = COALESCE(p_granted, '{}'), denied = COALESCE(p_denied, '{}'), updated_at = now()
   WHERE user_id = p_user;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_user, 'staff_permissions', btrim(p_reason));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_replace_mfa_recovery_codes(
  p_user_id UUID,
  p_code_hashes text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation integer;
  v_count integer;
BEGIN
  IF p_code_hashes IS NULL OR array_length(p_code_hashes, 1) IS NULL THEN
    RAISE EXCEPTION 'a recovery batch cannot be empty'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT COALESCE(MAX(generation), 0) + 1 INTO v_generation
    FROM public.ocade_mfa_recovery_codes WHERE user_id = p_user_id;
  DELETE FROM public.ocade_mfa_recovery_codes WHERE user_id = p_user_id;
  INSERT INTO public.ocade_mfa_recovery_codes (user_id, code_hash, generation)
    SELECT p_user_id, hash, v_generation FROM unnest(p_code_hashes) AS hash;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.ocade_mfa_recovery_attempts WHERE user_id = p_user_id;
  RETURN v_count;
END;
$$;

DROP FUNCTION IF EXISTS private.ocade_staff_user_has(uuid, text);
DROP INDEX IF EXISTS public.ocade_support_cases_assignee;
DROP INDEX IF EXISTS public.ocade_support_cases_conversation;
ALTER TABLE public.ocade_support_cases DROP COLUMN IF EXISTS assignee, DROP COLUMN IF EXISTS conversation;

COMMIT;
