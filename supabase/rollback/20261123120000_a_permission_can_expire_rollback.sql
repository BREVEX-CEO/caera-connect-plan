BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_allowed(p_user uuid, p_device uuid, p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT bool_and(coalesce((
    SELECT p.allowed FROM public.jarvis_permissions AS p
     WHERE p.user_id = p_user AND p.capability = wanted
       AND (p.device_id = p_device OR p.device_id IS NULL)
     ORDER BY p.device_id NULLS LAST
     LIMIT 1
  ), false))
  FROM unnest(ARRAY['master', p_capability]) AS wanted;
$$;

ALTER TABLE public.jarvis_permissions DROP COLUMN expires_at;

COMMIT;
