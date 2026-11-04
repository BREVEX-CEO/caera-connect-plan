-- Rollback of 20261102061041_enforce_verifier_target_permissions.sql: restores what it replaced and removes what it added.
-- Data in removed columns is lost; nothing else changes.
BEGIN;

-- public.jarvis_action_allowed: the definition before this migration.
CREATE OR REPLACE FUNCTION public.jarvis_action_allowed(p_user uuid, p_device uuid, p_action jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT public.jarvis_allowed(p_user, p_device, p_action ->> 'capability')
     AND (p_action -> 'target' ->> 'app' IS NULL
          OR public.jarvis_allowed(p_user, p_device, 'app:' || (p_action -> 'target' ->> 'app')))
     AND (p_action -> 'target' ->> 'site' IS NULL
          OR public.jarvis_allowed(p_user, p_device, 'site:' || (p_action -> 'target' ->> 'site')))
     AND (p_action -> 'target' ->> 'mcp' IS NULL
          OR public.jarvis_allowed(p_user, p_device, 'mcp:' || (p_action -> 'target' ->> 'mcp')));
$$;

COMMIT;
