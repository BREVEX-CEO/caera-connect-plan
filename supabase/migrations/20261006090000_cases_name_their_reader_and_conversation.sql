-- A CASE NAMES WHO MAY READ AND WHAT.
--
-- A support case bound only the customer: every member of staff with
-- cases.read could find every open case and read any of that customer's
-- conversations under it (FULL_ERROR_AUDIT_LEDGER F-014). A case now names
-- one reader (its assignee, the opener unless another named member of staff
-- with cases.read is chosen) and one conversation, and only that reader reads
-- only that conversation while the case is open. Cases opened before this have
-- neither and can no longer be read: they expire within 72 hours anyway.
--
-- Three more repairs ride with it:
--   * staff.manage below an owner could restore a permission an owner had
--     denied by clearing the denial (F-019): the effective permissions before
--     and after a change are compared, under a row lock.
--   * two concurrent recovery-sheet replacements could both survive (F-035):
--     replacement is serialised per account.
--   * a Library row could name another account's object path (F-044): the
--     path must sit in the row owner's own folder (new rows; old rows are
--     already settled by the owner-folder check in the deletion sweep).
BEGIN;

ALTER TABLE public.ocade_support_cases
  ADD COLUMN IF NOT EXISTS assignee uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS conversation uuid REFERENCES public.ocade_conversations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ocade_support_cases_assignee ON public.ocade_support_cases (assignee);
CREATE INDEX IF NOT EXISTS ocade_support_cases_conversation ON public.ocade_support_cases (conversation);

-- Does this (other) member of staff hold a permission, role default or override?
CREATE OR REPLACE FUNCTION private.ocade_staff_user_has(p_user uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_staff AS s
     WHERE s.user_id = p_user
       AND (p_permission = ANY (private.ocade_role_permissions(s.role))
            OR p_permission = ANY (s.granted))
       AND NOT (p_permission = ANY (s.denied))
  );
$$;
REVOKE ALL ON FUNCTION private.ocade_staff_user_has(uuid, text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.ocade_case_open(uuid, text, integer);
CREATE FUNCTION public.ocade_case_open(
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
REVOKE ALL ON FUNCTION public.ocade_case_open(uuid, text, integer, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_case_open(uuid, text, integer, uuid, uuid) TO authenticated;

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
  v_before text[];
  v_after text[];
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_user = v_me THEN
    RAISE EXCEPTION 'Nobody changes their own access.' USING ERRCODE = '42501';
  END IF;
  -- Locked, so two editors compare against the same before.
  SELECT s.role,
         ARRAY(SELECT DISTINCT p FROM unnest(private.ocade_role_permissions(s.role) || s.granted) AS p
                WHERE NOT (p = ANY (s.denied)))
    INTO v_role, v_before
    FROM public.ocade_staff AS s WHERE s.user_id = p_user FOR UPDATE;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF v_role = 'primary_owner'
     OR (v_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner') THEN
    RAISE EXCEPTION 'Only the Primary Owner changes an owner''s access.' USING ERRCODE = '42501';
  END IF;
  v_after := ARRAY(SELECT DISTINCT p
                     FROM unnest(private.ocade_role_permissions(v_role) || COALESCE(p_granted, '{}')) AS p
                    WHERE NOT (p = ANY (COALESCE(p_denied, '{}'))));
  -- Nobody below an owner gives more than they hold, however it is given: a new grant, or a
  -- denial taken away that brings a role default back.
  IF NOT private.ocade_staff_role_of(v_me) IN ('primary_owner', 'backup_owner')
     AND EXISTS (SELECT 1 FROM unnest(v_after) AS p(name)
                  WHERE NOT (p.name = ANY (v_before)) AND NOT private.ocade_staff_has(p.name)) THEN
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

  -- One replacement per account at a time: the second waits for the first and then retires
  -- its batch, so exactly the newest sheet works.
  PERFORM pg_advisory_xact_lock(hashtextextended('ocade-recovery:' || p_user_id::text, 0));

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

ALTER TABLE public.ocade_library_items
  DROP CONSTRAINT IF EXISTS ocade_library_items_own_folder;
ALTER TABLE public.ocade_library_items
  ADD CONSTRAINT ocade_library_items_own_folder
  CHECK (storage_path LIKE user_id::text || '/%') NOT VALID;

COMMIT;
