-- One fresh proof covers exactly one staff change, in the database too (PLAN P05-B, audit C17).
--
-- OCADE's server spends a proof on the one sensitive action it was given for
-- (20261011100000). A staff member's token could still call the staff change
-- functions directly, several times on one proof. Now every staff change spends
-- the proof as well: the change that follows the server's own spend within a
-- minute takes it over; a change called directly spends it itself; and any
-- further change on the same proof is refused until the person confirms again.
-- Listing a customer's conversation titles to open a case is a read, not a change.
BEGIN;

ALTER TABLE private.ocade_spent_proofs ADD COLUMN IF NOT EXISTS changed_in xid8;

-- The previous rule, unchanged: permission, second factor and a recent proof.
CREATE OR REPLACE FUNCTION private.ocade_staff_check(p_permission text, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT private.ocade_staff_has(p_permission) THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Confirm the code from your authenticator app to %.', p_action
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('making this change');
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_staff_check(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ocade_staff_require(p_permission text, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session uuid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  v_proved bigint;
BEGIN
  PERFORM private.ocade_staff_check(p_permission, p_action);
  SELECT max((entry ->> 'timestamp')::bigint) INTO v_proved
    FROM jsonb_array_elements(COALESCE(auth.jwt() -> 'amr', '[]'::jsonb)) AS entry;
  IF v_session IS NULL OR v_proved IS NULL THEN
    RAISE EXCEPTION 'Confirm it is you again: each confirmation covers one change.'
      USING ERRCODE = '42501';
  END IF;
  -- The change OCADE's server just spent this proof on, or a nested step of this same change.
  UPDATE private.ocade_spent_proofs
     SET changed_in = pg_current_xact_id()
   WHERE session_id = v_session AND proved_at = v_proved
     AND (changed_in = pg_current_xact_id()
          OR (changed_in IS NULL AND spent_at > now() - interval '1 minute'));
  IF FOUND THEN
    RETURN;
  END IF;
  -- Called directly with a proof nothing has spent yet: this change spends it.
  INSERT INTO private.ocade_spent_proofs
    (session_id, proved_at, user_id, action, target_digest, changed_in)
  VALUES (v_session, v_proved, auth.uid(), left('database: ' || p_action, 120),
          encode(sha256(convert_to(p_action, 'UTF8')), 'hex'), pg_current_xact_id())
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Confirm it is you again: each confirmation covers one change.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_staff_require(text, text) FROM PUBLIC, anon, authenticated;

-- A read for choosing a case's conversation: checked and written down, but it spends nothing.
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
REVOKE ALL ON FUNCTION public.ocade_case_conversations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_case_conversations(uuid) TO authenticated;

COMMIT;
