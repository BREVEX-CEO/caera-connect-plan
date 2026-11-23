-- PERSISTENT AUTHORIZED CAPABILITY SCOPES (plan concept 67): a permission may be granted for a
-- limited time. An expired grant is the same as no grant: the database refuses it at the one
-- place every action is checked, so no caller can keep using it by mistake. A grant without an
-- end lasts until the person turns it off, as before. Expiry is per decision (one capability,
-- app or website on one computer); turning a capability on again sets a new end or none.
BEGIN;

ALTER TABLE public.jarvis_permissions ADD COLUMN expires_at timestamptz;

-- The most specific decision wins, as before; an expired decision counts as "not allowed".
-- It never falls through to a broader decision, so an expired app grant cannot be replaced
-- by an older account-wide one.
CREATE OR REPLACE FUNCTION public.jarvis_allowed(p_user uuid, p_device uuid, p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT bool_and(coalesce((
    SELECT p.allowed AND (p.expires_at IS NULL OR p.expires_at > now())
      FROM public.jarvis_permissions AS p
     WHERE p.user_id = p_user AND p.capability = wanted
       AND (p.device_id = p_device OR p.device_id IS NULL)
     ORDER BY p.device_id NULLS LAST
     LIMIT 1
  ), false))
  FROM unnest(ARRAY['master', p_capability]) AS wanted;
$$;

COMMIT;
