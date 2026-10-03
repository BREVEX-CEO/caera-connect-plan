-- Undo the Owner Console customer operations. The adjustment record is kept (append-only
-- evidence); the three permissions leave every staff row first so the checks still hold.
BEGIN;

DROP FUNCTION IF EXISTS public.ocade_staff_begin_account_deletion(uuid, text, text);
DROP FUNCTION IF EXISTS public.ocade_staff_suspend_account(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.ocade_staff_adjust_usage(uuid, text, text, bigint, text);
DROP FUNCTION IF EXISTS private.ocade_stop_account(uuid);
DROP FUNCTION IF EXISTS private.ocade_staff_may_act_on(uuid, text);
DROP FUNCTION IF EXISTS private.ocade_require_reason(text);

UPDATE public.ocade_staff
   SET granted = array(SELECT p FROM unnest(granted) p WHERE p NOT IN ('usage.manage', 'accounts.manage', 'accounts.delete')),
       denied = array(SELECT p FROM unnest(denied) p WHERE p NOT IN ('usage.manage', 'accounts.manage', 'accounts.delete'));

CREATE OR REPLACE FUNCTION private.ocade_known_permissions()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$ SELECT ARRAY['customers.read', 'usage.read', 'devices.read', 'devices.manage', 'tasks.read',
  'security.read', 'sessions.manage', 'grants.manage', 'execution.manage', 'health.read',
  'audit.read', 'staff.manage', 'cases.read', 'cases.manage'] $$;

CREATE OR REPLACE FUNCTION private.ocade_role_permissions(p_role text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$
  SELECT CASE p_role
    WHEN 'primary_owner' THEN private.ocade_known_permissions()
    WHEN 'backup_owner' THEN private.ocade_known_permissions()
    WHEN 'admin' THEN ARRAY['customers.read', 'usage.read', 'devices.read', 'devices.manage', 'tasks.read',
      'security.read', 'sessions.manage', 'grants.manage', 'execution.manage', 'health.read', 'audit.read',
      'cases.read']
    WHEN 'support' THEN ARRAY['customers.read', 'devices.read', 'tasks.read', 'cases.read']
    WHEN 'billing' THEN ARRAY['customers.read', 'usage.read', 'grants.manage']
    WHEN 'operations' THEN ARRAY['devices.read', 'devices.manage', 'tasks.read', 'health.read', 'execution.manage']
    WHEN 'read_only' THEN ARRAY['customers.read', 'usage.read', 'devices.read', 'tasks.read', 'health.read', 'audit.read']
    ELSE ARRAY[]::text[]
  END;
$$;

-- The audit kinds stay: rows recorded with them are evidence, and the wider check harms nothing.

COMMIT;
