-- One fresh proof covers exactly one sensitive action (PLAN P05-B).
--
-- A recent sign-in or second-factor answer used to cover every sensitive action
-- for ten minutes, so a stolen token taken right after it could do several. Now
-- the server spends the proof on the action it was given for, recording which
-- action and a digest of its target; the next sensitive action asks again.
BEGIN;

CREATE TABLE IF NOT EXISTS private.ocade_spent_proofs (
  session_id uuid NOT NULL,
  proved_at bigint NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 120),
  target_digest text NOT NULL CHECK (target_digest ~ '^[0-9a-f]{64}$'),
  spent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, proved_at)
);
CREATE INDEX IF NOT EXISTS ocade_spent_proofs_spent_at ON private.ocade_spent_proofs (spent_at);
REVOKE ALL ON private.ocade_spent_proofs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_spend_proof(p_action text, p_target_digest text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session uuid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  v_proved bigint;
BEGIN
  -- No session or no proof time: nothing to spend, so nothing is allowed.
  IF auth.uid() IS NULL OR v_session IS NULL THEN
    RETURN false;
  END IF;
  SELECT max((entry ->> 'timestamp')::bigint) INTO v_proved
    FROM jsonb_array_elements(COALESCE(auth.jwt() -> 'amr', '[]'::jsonb)) AS entry;
  IF v_proved IS NULL THEN
    RETURN false;
  END IF;
  -- Proofs are good for ten minutes; a day of records is more than enough to refuse reuse.
  DELETE FROM private.ocade_spent_proofs WHERE spent_at < now() - interval '1 day';
  INSERT INTO private.ocade_spent_proofs (session_id, proved_at, user_id, action, target_digest)
  VALUES (v_session, v_proved, auth.uid(), p_action, p_target_digest)
  ON CONFLICT DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_spend_proof(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_spend_proof(text, text) TO authenticated;

COMMIT;
