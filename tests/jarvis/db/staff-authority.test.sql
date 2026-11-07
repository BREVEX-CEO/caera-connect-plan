-- Staff and owner boundaries with their audit record (161). A role can only do what it
-- grants; nobody below the Primary Owner removes the Primary Owner; each change needs a fresh
-- second-factor proof and a reason; a change that succeeds is written to the audit record with
-- who, whom and why, and a refused one leaves nothing. Disposable database only; synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE staff_ids (name text PRIMARY KEY, id uuid, session uuid);
GRANT SELECT ON staff_ids TO authenticated;
INSERT INTO staff_ids SELECT name, gen_random_uuid(), gen_random_uuid()
  FROM unnest(ARRAY['owner', 'admin', 'support', 'customer']) AS name;
INSERT INTO auth.users (id, email) SELECT id, name || '-' || id || '@example.test' FROM staff_ids;
-- Each person signed in after setting up their second factor.
INSERT INTO auth.mfa_factors (id, user_id, factor_type, status, created_at)
  SELECT gen_random_uuid(), id, 'totp', 'verified', now() - interval '1 hour' FROM staff_ids;
INSERT INTO auth.sessions (id, user_id, aal) SELECT session, id, 'aal2' FROM staff_ids;
INSERT INTO public.ocade_staff (user_id, role)
  SELECT id, CASE name WHEN 'owner' THEN 'primary_owner' ELSE name END FROM staff_ids WHERE name <> 'customer';

-- The customer and the Primary Owner each have a computer; the customer's runs a task.
CREATE TEMP TABLE staff_devices (name text PRIMARY KEY, device uuid, task uuid);
GRANT SELECT ON staff_devices TO authenticated;
INSERT INTO staff_devices SELECT name, gen_random_uuid(), gen_random_uuid() FROM staff_ids
 WHERE name IN ('customer', 'owner');
INSERT INTO public.jarvis_devices (id, user_id, name, revoked_at)
  SELECT d.device, s.id, 'Laptop', NULL FROM staff_devices AS d JOIN staff_ids AS s USING (name);
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
  SELECT d.task, s.id, 'Task', 'jarvis' FROM staff_devices AS d JOIN staff_ids AS s USING (name);
INSERT INTO public.jarvis_tasks (id, user_id, conversation_id, title, device_id, status)
  SELECT d.task, s.id, d.task, 'A running task', d.device, 'running'
    FROM staff_devices AS d JOIN staff_ids AS s USING (name);

-- Act as one person with a fresh second-factor proof `p_seconds_ago` seconds old.
CREATE FUNCTION pg_temp.as_staff(p_name text, p_seconds_ago integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  who record;
BEGIN
  SELECT * INTO who FROM staff_ids AS s WHERE s.name = p_name;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', who.id, 'role', 'authenticated', 'session_id', who.session, 'aal', 'aal2',
    'amr', jsonb_build_array(jsonb_build_object('method', 'totp',
      'timestamp', extract(epoch FROM now())::bigint - p_seconds_ago)))::text, true);
END;
$$;
CREATE FUNCTION pg_temp.raised(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;
CREATE FUNCTION pg_temp.staff_assert(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'staff authority: %', p_what; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.as_staff(text, integer), pg_temp.raised(text),
  pg_temp.staff_assert(boolean, text) TO authenticated;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  owner_id uuid := (SELECT id FROM staff_ids WHERE name = 'owner');
  support_id uuid := (SELECT id FROM staff_ids WHERE name = 'support');
  customer_id uuid := (SELECT id FROM staff_ids WHERE name = 'customer');
  outcome text;
BEGIN
  -- Support has no staff.manage: it cannot change anyone's permissions, even its own.
  PERFORM pg_temp.as_staff('support', 5);
  outcome := pg_temp.raised(format('SELECT public.ocade_staff_set_permissions(%L, ARRAY[%L], ARRAY[]::text[], %L)',
    support_id, 'staff.manage', 'giving myself staff management'));
  PERFORM pg_temp.staff_assert(outcome <> '', 'support changed its own permissions');
  -- Support may see devices but not remove them.
  PERFORM pg_temp.as_staff('support', 4);
  PERFORM pg_temp.staff_assert(pg_temp.raised(format('SELECT public.ocade_admin_remove_device(%L, %L)',
    (SELECT device FROM staff_devices WHERE name = 'customer'), 'lost laptop reported')) <> '',
    'support removed a device');
  -- A customer is not staff at all.
  PERFORM pg_temp.as_staff('customer', 6);
  PERFORM pg_temp.staff_assert(pg_temp.raised(format('SELECT public.ocade_staff_revoke(%L, %L)',
    support_id, 'removing a staff member')) <> '', 'a customer removed a staff member');
  -- An admin cannot remove the Primary Owner.
  PERFORM pg_temp.as_staff('admin', 7);
  outcome := pg_temp.raised(format('SELECT public.ocade_staff_revoke(%L, %L)', owner_id, 'taking over the company'));
  PERFORM pg_temp.staff_assert(outcome <> '', 'an admin removed the Primary Owner');
  -- A stale second-factor proof is not enough, even for the Primary Owner.
  PERFORM pg_temp.as_staff('owner', 7200);
  PERFORM pg_temp.staff_assert(pg_temp.raised(format('SELECT public.ocade_staff_revoke(%L, %L)', support_id,
    'left the support team')) LIKE '%Confirm it is you%', 'a two-hour-old proof was accepted');
  -- A reason is required.
  PERFORM pg_temp.as_staff('owner', 8);
  PERFORM pg_temp.staff_assert(pg_temp.raised(format('SELECT public.ocade_staff_revoke(%L, %L)', support_id, 'bye'))
    LIKE '%ten characters%', 'a change without a reason');
  -- The Primary Owner removes support with a reason. (One proof per change is enforced across
  -- requests; within one transaction nested steps of the same change share it, so it is not
  -- asserted here.)
  PERFORM pg_temp.as_staff('owner', 9);
  PERFORM pg_temp.staff_assert(public.ocade_staff_revoke(support_id, 'left the support team'), 'owner removes support');
  -- An admin removes the customer's lost computer: its task stops the owner's way.
  PERFORM pg_temp.as_staff('admin', 11);
  PERFORM pg_temp.staff_assert(public.ocade_admin_remove_device(
    (SELECT device FROM staff_devices WHERE name = 'customer'), 'customer reported it stolen'), 'admin removes a device');
  -- An owner's computer is removed by the owner, not by an admin.
  PERFORM pg_temp.as_staff('admin', 12);
  PERFORM pg_temp.staff_assert(pg_temp.raised(format('SELECT public.ocade_admin_remove_device(%L, %L)',
    (SELECT device FROM staff_devices WHERE name = 'owner'), 'taking over the company')) <> '',
    'an admin removed the Primary Owner''s device');
  -- The removed member's access ends at once.
  PERFORM pg_temp.as_staff('support', 10);
  PERFORM pg_temp.staff_assert(pg_temp.raised(format('SELECT public.ocade_staff_end_customer_sessions(%L, %L)',
    customer_id, 'should no longer work')) <> '', 'a removed member still acted');
END;
$$;
RESET ROLE;
DO $$
DECLARE
  owner_id uuid := (SELECT id FROM staff_ids WHERE name = 'owner');
  support_id uuid := (SELECT id FROM staff_ids WHERE name = 'support');
BEGIN
  PERFORM pg_temp.staff_assert((SELECT count(*) FROM public.ocade_admin_actions
    WHERE actor = owner_id AND target_user = support_id AND action = 'staff_revoke'
      AND reason = 'left the support team') = 1, 'the removal is in the audit record with who, whom and why');
  PERFORM pg_temp.staff_assert((SELECT count(*) FROM public.ocade_admin_actions
    WHERE (actor <> owner_id OR target_user <> support_id) AND action <> 'remove_device') = 0,
    'a refused change left an audit entry');
  PERFORM pg_temp.staff_assert((SELECT count(*) FROM public.ocade_admin_actions WHERE action = 'remove_device'
    AND actor = (SELECT id FROM staff_ids WHERE name = 'admin')
    AND target_user = (SELECT id FROM staff_ids WHERE name = 'customer')
    AND subject = (SELECT device FROM staff_devices WHERE name = 'customer')) = 1,
    'the device removal is in the audit record, and only the allowed one');
  PERFORM pg_temp.staff_assert((SELECT revoked_at IS NOT NULL FROM public.jarvis_devices
    WHERE id = (SELECT device FROM staff_devices WHERE name = 'customer')), 'the customer device is revoked');
  PERFORM pg_temp.staff_assert((SELECT status = 'stopped' AND finished_at IS NOT NULL AND controller IS NULL
    FROM public.jarvis_tasks WHERE id = (SELECT task FROM staff_devices WHERE name = 'customer')),
    'the removed device''s task stopped the owner''s way');
  PERFORM pg_temp.staff_assert((SELECT revoked_at IS NULL FROM public.jarvis_devices
    WHERE id = (SELECT device FROM staff_devices WHERE name = 'owner')), 'the owner''s device is untouched');
  PERFORM pg_temp.staff_assert(NOT EXISTS (SELECT 1 FROM public.ocade_staff WHERE user_id = support_id), 'support removed');
  PERFORM pg_temp.staff_assert((SELECT role FROM public.ocade_staff WHERE user_id = owner_id) = 'primary_owner',
    'the Primary Owner is still the Primary Owner');
END;
$$;
ROLLBACK;
