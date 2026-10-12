-- Online intelligence runs on Google's free Gemini tier (owner decision, 13 Oct 2026),
-- whose terms let Google use what is sent to improve its products. Nothing goes there
-- until the person has read that and agreed, and the agreement is the account's, kept
-- here, checked by the Online boundary before anything is sent, and withdrawable.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS online_ai_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS online_ai_consent_version text
    CHECK (online_ai_consent_version IS NULL OR length(online_ai_consent_version) BETWEEN 1 AND 40);

-- Only through this function, only for the signed-in person: given with the version
-- of the words they read, or withdrawn.
CREATE OR REPLACE FUNCTION public.ocade_record_online_ai_consent(p_version text, p_given boolean)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_at timestamptz := CASE WHEN p_given THEN statement_timestamp() END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF p_given AND (p_version IS NULL OR length(p_version) NOT BETWEEN 1 AND 40) THEN
    RAISE EXCEPTION 'which words were agreed to is required' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.profiles
     SET online_ai_consent_at = v_at,
         online_ai_consent_version = CASE WHEN p_given THEN p_version END
   WHERE id = auth.uid();
  RETURN v_at;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_record_online_ai_consent(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_record_online_ai_consent(text, boolean) TO authenticated;

COMMIT;
