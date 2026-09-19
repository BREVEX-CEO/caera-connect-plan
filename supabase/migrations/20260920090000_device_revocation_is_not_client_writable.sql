-- REMOVING A DEVICE MUST NOT BE UNDOABLE BY THE ACCOUNT THAT OWNS IT.
--
-- `authenticated` held INSERT, UPDATE and DELETE on `devices` and INSERT and
-- UPDATE on `browser_grants`, and both policies tested ownership and nothing
-- else. Row-level security decides WHICH ROWS a role may write, never WHICH
-- COLUMNS, so an account could clear its own revoked row's `revoked_at`
-- straight through the Data API and re-admit a browser it had removed. Remove
-- is the only control a person has over which browsers may answer for them
-- without a network, and it could be undone by the caller it protects against.
--
-- Nothing needed that authority. Registration is
-- `register_browser_device_for_current_user` and removal is
-- `revoke_device_for_current_user`; both are SECURITY DEFINER, both check
-- `auth.uid()`, and the cap trigger runs inside the first. The client only ever
-- READS these tables, for the device list under Usage & Limits, so SELECT is
-- all it keeps and the policies say so rather than claiming FOR ALL.
--
-- THE CAP WAS ALSO SERIALISED BY THE WRONG KEY. The advisory lock included the
-- browser install id, so two DIFFERENT browsers of one account took two
-- different locks; the cap is a count-then-insert, so both could see the last
-- slot free and both take it. The lock is per account and kind now, which is
-- exactly what the cap is per. Same browser, two tabs: still one lock, because
-- both carry the same kind.
BEGIN;

REVOKE INSERT, UPDATE, DELETE ON public.devices FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.browser_grants FROM authenticated;

-- Removal was made SECURITY INVOKER in 20260824112646 precisely BECAUSE the
-- caller already held UPDATE on both tables, so definer rights looked like an
-- unnecessary bypass. With the grants gone it is the opposite: this function is
-- the only way an account can remove one of its devices, so it needs the rights
-- the caller no longer has. It scopes every statement to `auth.uid()` itself,
-- which is what makes that safe — `security-definer.test.ts` proves it.
ALTER FUNCTION public.revoke_device_for_current_user(UUID) SECURITY DEFINER;

DROP POLICY IF EXISTS "devices_self_all" ON public.devices;
DROP POLICY IF EXISTS "devices_self_read" ON public.devices;
CREATE POLICY "devices_self_read" ON public.devices
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "own grants" ON public.browser_grants;
CREATE POLICY "own grants" ON public.browser_grants
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

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

  -- Serialise every registration this account makes for this KIND of device,
  -- because that is the scope the cap counts. Held by the transaction, so it is
  -- released on commit or rollback without a cleanup path.
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || ':' || _kind::text, 0));

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
