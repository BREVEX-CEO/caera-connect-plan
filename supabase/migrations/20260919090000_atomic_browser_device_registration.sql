-- ONE DEVICE REGISTRATION, OR NONE.
--
-- Registering a browser was two writes from the client: insert a device, then
-- insert the grant that ties this browser to it. When the second failed, the
-- client deleted the first and ignored whether that deletion worked — so a
-- failure at the wrong moment left an orphan device holding one of the
-- account's two slots for that kind, with nothing pointing at it and no way for
-- the person to see it or remove it.
--
-- A function body is one transaction, so both writes commit or neither does.
-- The compensating delete disappears with the failure mode it was there for.
--
-- IT ALSO REPLACES A BROWSER LOCK. The client serialised itself with Web Locks,
-- which meant a browser without them (or with them restricted) never registered
-- at all and never said so. The advisory lock below is held by the transaction
-- and covers every tab, window and device at once, which the browser-local lock
-- never could.
--
-- A REVOKED BROWSER STAYS REVOKED. Removing a device from Settings must not be
-- undone by that browser quietly registering itself again on the next visit, so
-- a browser whose grant was revoked gets NULL rather than a new device.
BEGIN;

CREATE OR REPLACE FUNCTION public.register_browser_device_for_current_user(
  _browser_install_id TEXT,
  _kind public.device_kind,
  _name TEXT,
  _origin TEXT,
  _user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _device_id UUID;
  _revoked BOOLEAN;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = 'invalid_authorization_specification';
  END IF;
  IF _browser_install_id IS NULL OR length(_browser_install_id) = 0
     OR length(_browser_install_id) > 200 THEN
    RAISE EXCEPTION 'browser_install_id required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Serialise this account's registrations for this browser. Held by the
  -- transaction, so it is released on commit or rollback without a cleanup path.
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || ':' || _browser_install_id, 0));

  SELECT g.device_id, (g.revoked_at IS NOT NULL OR d.revoked_at IS NOT NULL)
    INTO _device_id, _revoked
    FROM public.browser_grants AS g
    LEFT JOIN public.devices AS d ON d.id = g.device_id AND d.user_id = _uid
   WHERE g.user_id = _uid
     AND g.browser_install_id = _browser_install_id
   ORDER BY g.created_at DESC
   LIMIT 1;

  IF _device_id IS NOT NULL THEN
    -- Revoked here, or its device gone: this browser is not to be re-admitted
    -- without the person explicitly choosing it again.
    IF _revoked THEN RETURN NULL; END IF;
    UPDATE public.browser_grants
       SET last_seen_at = now()
     WHERE user_id = _uid
       AND device_id = _device_id
       AND browser_install_id = _browser_install_id;
    UPDATE public.devices SET last_active_at = now() WHERE id = _device_id AND user_id = _uid;
    RETURN _device_id;
  END IF;

  -- The device cap is a BEFORE INSERT trigger and raises check_violation, which
  -- reaches the browser as 23514 and becomes the one refusal a person can act on.
  INSERT INTO public.devices (user_id, kind, name, user_agent)
  VALUES (_uid, _kind, left(COALESCE(_name, 'Browser'), 200), left(_user_agent, 500))
  RETURNING id INTO _device_id;

  INSERT INTO public.browser_grants (user_id, device_id, browser_install_id, origin, user_agent)
  VALUES (_uid, _device_id, _browser_install_id, left(_origin, 500), left(_user_agent, 500));

  RETURN _device_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_browser_device_for_current_user(
  TEXT, public.device_kind, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_browser_device_for_current_user(
  TEXT, public.device_kind, TEXT, TEXT, TEXT
) TO authenticated;

COMMIT;
