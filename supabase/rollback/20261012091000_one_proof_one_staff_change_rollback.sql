-- Undo: staff changes check a recent proof again without spending it.
BEGIN;
CREATE OR REPLACE FUNCTION private.ocade_staff_require(p_permission text, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.ocade_staff_check(p_permission, p_action);
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_staff_require(text, text) FROM PUBLIC, anon, authenticated;
ALTER TABLE private.ocade_spent_proofs DROP COLUMN IF EXISTS changed_in;
COMMIT;
