-- Revoke the account-owned device and every browser grant linked to it in one
-- database transaction. Client-side sequential writes can be interrupted after
-- one table changes, leaving the UI and authorization grant state disagreeing.

CREATE OR REPLACE FUNCTION public.revoke_device_for_current_user(_device_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _revoked_at TIMESTAMPTZ := now();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  UPDATE public.devices
  SET revoked_at = COALESCE(revoked_at, _revoked_at)
  WHERE id = _device_id
    AND user_id = _uid;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.browser_grants
  SET revoked_at = COALESCE(revoked_at, _revoked_at)
  WHERE device_id = _device_id
    AND user_id = _uid;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_device_for_current_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_device_for_current_user(UUID) TO authenticated;
