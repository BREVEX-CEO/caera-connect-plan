-- Undo the device write lockdown and the registration lock key.
--
-- This restores the previous grants and policies exactly, which means it also
-- restores the defect they carried: an account could clear its own revoked
-- row's `revoked_at` through the Data API and re-admit a removed browser. Run
-- it only to get back to a known state while a forward fix is prepared.
BEGIN;

DROP POLICY IF EXISTS "devices_self_read" ON public.devices;
CREATE POLICY "devices_self_all" ON public.devices
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "own grants" ON public.browser_grants;
CREATE POLICY "own grants" ON public.browser_grants
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.browser_grants TO authenticated;

-- Removal goes back to the caller's own rights, which the grants above restore.
ALTER FUNCTION public.revoke_device_for_current_user(UUID) SECURITY INVOKER;

-- Back to serialising by browser install id rather than by device kind.
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
    IF _revoked THEN RETURN NULL; END IF;
    UPDATE public.browser_grants
       SET last_seen_at = now()
     WHERE user_id = _uid
       AND device_id = _device_id
       AND browser_install_id = _browser_install_id;
    UPDATE public.devices SET last_active_at = now() WHERE id = _device_id AND user_id = _uid;
    RETURN _device_id;
  END IF;

  INSERT INTO public.devices (user_id, kind, name, user_agent)
  VALUES (_uid, _kind, left(COALESCE(_name, 'Browser'), 200), left(_user_agent, 500))
  RETURNING id INTO _device_id;

  INSERT INTO public.browser_grants (user_id, device_id, browser_install_id, origin, user_agent)
  VALUES (_uid, _device_id, _browser_install_id, left(_origin, 500), left(_user_agent, 500));

  RETURN _device_id;
END;
$$;

COMMIT;
