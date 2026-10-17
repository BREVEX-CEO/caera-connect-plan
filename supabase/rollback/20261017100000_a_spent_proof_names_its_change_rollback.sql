-- Undo 20261017100000: the staff gate adopts any proof spent in the last minute again.
BEGIN;
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
COMMIT;
