-- PLAN Phase 08 V11: a recovery code that was spent finishes the recovery it started.
--
-- A correct code was used up before the authenticator app was removed and the sessions were
-- signed out; if either failed, the person had spent a code and was still locked out, with
-- one code fewer. The spent code now records the recovery it began: the session that used
-- it and the exact factors it is removing. For fifteen minutes that same session may finish
-- that same recovery with that same code. Nothing else: another session, a later-enrolled
-- factor, or a finished recovery gets no second use, and resuming costs no attempt.
BEGIN;
ALTER TABLE public.ocade_mfa_recovery_codes
  ADD COLUMN IF NOT EXISTS recovering_session uuid,
  ADD COLUMN IF NOT EXISTS recovering_factors text[],
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz;

CREATE OR REPLACE FUNCTION public.ocade_begin_mfa_recovery(
  p_user_id uuid,
  p_code_hash text,
  p_session uuid,
  p_factor_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_status text;
  v_factors text[];
BEGIN
  IF p_session IS NULL THEN
    RETURN jsonb_build_object('status', 'rejected');
  END IF;
  -- The same session finishing the recovery this code started: its own factors, no attempt spent.
  SELECT recovering_factors INTO v_factors
    FROM public.ocade_mfa_recovery_codes
   WHERE user_id = p_user_id AND code_hash = p_code_hash
     AND used_at IS NOT NULL AND recovered_at IS NULL
     AND recovering_session = p_session
     AND used_at > now() - interval '15 minutes'
   FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'resume', 'factors', to_jsonb(v_factors));
  END IF;
  v_status := public.ocade_consume_mfa_recovery_code(p_user_id, p_code_hash);
  IF v_status = 'consumed' THEN
    UPDATE public.ocade_mfa_recovery_codes
       SET recovering_session = p_session, recovering_factors = p_factor_ids
     WHERE user_id = p_user_id AND code_hash = p_code_hash;
    RETURN jsonb_build_object('status', 'consumed', 'factors', to_jsonb(p_factor_ids));
  END IF;
  RETURN jsonb_build_object('status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_begin_mfa_recovery(uuid, text, uuid, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_begin_mfa_recovery(uuid, text, uuid, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.ocade_finish_mfa_recovery(p_user_id uuid, p_code_hash text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.ocade_mfa_recovery_codes SET recovered_at = now()
   WHERE user_id = p_user_id AND code_hash = p_code_hash AND used_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.ocade_finish_mfa_recovery(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_finish_mfa_recovery(uuid, text) TO service_role;
COMMIT;
