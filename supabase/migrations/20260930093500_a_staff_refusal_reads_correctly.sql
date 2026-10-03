-- A staff change refused for an old proof said "Confirm it is you before sign
-- every staff member out": the action phrase written for "…app to <action>"
-- was reused after "before". The recency refusal now names no action ("before
-- making this change"); the second-factor refusal keeps its own.
BEGIN;

CREATE OR REPLACE FUNCTION private.ocade_staff_require(p_permission text, p_action text)
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
REVOKE ALL ON FUNCTION private.ocade_staff_require(text, text) FROM PUBLIC, anon, authenticated;

COMMIT;
