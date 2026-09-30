-- ONE AUTHORITY FOR WHO OPERATES OCADE.
--
-- Until now "operator" was one role ('admin' in user_roles), checked three
-- different ways. PLAN.md Phases 31/46 need a company: a Primary Owner, a
-- Backup Owner, Admins and staff (Support, Billing, Operations, Read-only),
-- each seeing only what their role allows, with per-person overrides, grants
-- made by email but held by the account's stable id, pending invitations for
-- people who have not signed up yet, removal that takes effect on the very
-- next request, conversation access only through a case with a reason and an
-- expiry, and every privileged change written down.
--
-- public.ocade_staff is that authority. has_role(..., 'admin') and the old
-- support-admin check now read it, so every existing policy and RPC follows it,
-- and the four operator RPCs ask for the specific permission they exercise.
BEGIN;

-- The roles, and what each may do before any override.
CREATE OR REPLACE FUNCTION private.ocade_role_permissions(p_role text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE p_role
    WHEN 'primary_owner' THEN ARRAY['customers.read', 'usage.read', 'devices.read', 'devices.manage', 'tasks.read', 'security.read', 'sessions.manage', 'grants.manage', 'execution.manage', 'health.read', 'audit.read', 'staff.manage', 'cases.read', 'cases.manage']
    WHEN 'backup_owner' THEN ARRAY['customers.read', 'usage.read', 'devices.read', 'devices.manage', 'tasks.read', 'security.read', 'sessions.manage', 'grants.manage', 'execution.manage', 'health.read', 'audit.read', 'staff.manage', 'cases.read', 'cases.manage']
    WHEN 'admin' THEN ARRAY['customers.read', 'usage.read', 'devices.read', 'devices.manage', 'tasks.read', 'security.read', 'sessions.manage', 'grants.manage', 'execution.manage', 'health.read', 'audit.read', 'cases.read']
    WHEN 'support' THEN ARRAY['customers.read', 'devices.read', 'tasks.read', 'cases.read']
    WHEN 'billing' THEN ARRAY['customers.read', 'usage.read', 'grants.manage']
    WHEN 'operations' THEN ARRAY['devices.read', 'devices.manage', 'tasks.read', 'health.read', 'execution.manage']
    WHEN 'read_only' THEN ARRAY['customers.read', 'usage.read', 'devices.read', 'tasks.read', 'health.read', 'audit.read']
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION private.ocade_known_permissions()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$ SELECT ARRAY['customers.read', 'usage.read', 'devices.read', 'devices.manage', 'tasks.read', 'security.read', 'sessions.manage', 'grants.manage', 'execution.manage', 'health.read', 'audit.read', 'staff.manage', 'cases.read', 'cases.manage'] $$;

CREATE TABLE IF NOT EXISTS public.ocade_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('primary_owner', 'backup_owner', 'admin', 'support',
                                     'billing', 'operations', 'read_only')),
  granted text[] NOT NULL DEFAULT '{}' CHECK (granted <@ private.ocade_known_permissions()),
  denied text[] NOT NULL DEFAULT '{}' CHECK (denied <@ private.ocade_known_permissions()),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Nothing is ever taken from the Primary Owner: they are the one who can fix it.
  CONSTRAINT ocade_staff_owner_is_whole CHECK (role <> 'primary_owner' OR denied = '{}')
);
-- Exactly one Primary Owner, at most.
CREATE UNIQUE INDEX IF NOT EXISTS ocade_staff_one_primary_owner
  ON public.ocade_staff ((true)) WHERE role = 'primary_owner';
CREATE INDEX IF NOT EXISTS ocade_staff_granted_by ON public.ocade_staff (granted_by);
ALTER TABLE public.ocade_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_staff FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ocade_staff TO service_role;

CREATE TABLE IF NOT EXISTS public.ocade_staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(btrim(email)) AND email ~ '^[^@\s]+@[^@\s]+$'
                             AND length(email) <= 320),
  role text NOT NULL CHECK (role IN ('backup_owner', 'admin', 'support', 'billing',
                                     'operations', 'read_only')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  withdrawn_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ocade_staff_invites_one_open
  ON public.ocade_staff_invites (email) WHERE accepted_at IS NULL AND withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS ocade_staff_invites_invited_by ON public.ocade_staff_invites (invited_by);
CREATE INDEX IF NOT EXISTS ocade_staff_invites_accepted_by ON public.ocade_staff_invites (accepted_by);
ALTER TABLE public.ocade_staff_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_staff_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ocade_staff_invites TO service_role;

CREATE TABLE IF NOT EXISTS public.ocade_support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  opened_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  closed_at timestamptz,
  CONSTRAINT ocade_support_cases_window
    CHECK (expires_at > opened_at AND expires_at <= opened_at + interval '72 hours')
);
CREATE INDEX IF NOT EXISTS ocade_support_cases_customer ON public.ocade_support_cases (customer, expires_at DESC);
CREATE INDEX IF NOT EXISTS ocade_support_cases_opened_by ON public.ocade_support_cases (opened_by);
ALTER TABLE public.ocade_support_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_support_cases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ocade_support_cases TO service_role;

-- Everything privileged is written down here.
ALTER TABLE public.ocade_admin_actions DROP CONSTRAINT IF EXISTS ocade_admin_actions_action_check;
ALTER TABLE public.ocade_admin_actions ADD CONSTRAINT ocade_admin_actions_action_check CHECK (
  action IN ('remove_device', 'owner_bootstrap', 'owner_transfer', 'staff_grant', 'staff_invite',
             'staff_invite_withdrawn', 'staff_invite_accepted', 'staff_permissions', 'staff_revoke',
             'staff_sessions_ended', 'customer_sessions_ended', 'case_open', 'case_close', 'case_read')
);

-- The people who operated OCADE before keep doing so: one admin becomes the
-- Primary Owner; several stay Admins until the owner is set explicitly.
INSERT INTO public.ocade_staff (user_id, role)
SELECT r.user_id,
       CASE WHEN (SELECT count(*) FROM public.user_roles WHERE role = 'admin'::public.app_role) = 1
            THEN 'primary_owner' ELSE 'admin' END
  FROM public.user_roles AS r
 WHERE r.role = 'admin'::public.app_role
ON CONFLICT (user_id) DO NOTHING;
-- The old 'admin' rows in user_roles are deliberately LEFT for now. Nothing on
-- the server trusts them after this migration (has_role and the support-admin
-- check below read ocade_staff), but the release still live on production opens
-- its admin screen by reading that row, and deleting it here would lock the
-- owner out until the new console ships. They are removed by a later migration
-- once it has (ToRemove.md).

CREATE OR REPLACE FUNCTION private.ocade_staff_role_of(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$ SELECT role FROM public.ocade_staff WHERE user_id = p_user $$;

-- Does the caller hold this permission at all (role default or override), on a
-- session that has not been ended?
CREATE OR REPLACE FUNCTION private.ocade_staff_has(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_staff AS s
     WHERE s.user_id = auth.uid()
       AND (p_permission = ANY (private.ocade_role_permissions(s.role))
            OR p_permission = ANY (s.granted))
       AND NOT (p_permission = ANY (s.denied))
  ) AND private.ocade_caller_session_live();
$$;

-- May the caller use it now? Staff other than the Primary Owner must also have
-- answered their second factor in this session, so a stolen staff password
-- alone reads nothing (the Primary Owner may look, never change, while
-- setting two-step up).
CREATE OR REPLACE FUNCTION public.ocade_staff_can(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT private.ocade_staff_has(p_permission)
     AND (private.ocade_staff_role_of(auth.uid()) = 'primary_owner'
          OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2');
$$;

-- What the caller's own console shows: never anybody else's.
CREATE OR REPLACE FUNCTION public.ocade_my_staff()
RETURNS TABLE (role text, permissions text[], second_factor boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT s.role,
         ARRAY(SELECT DISTINCT p FROM unnest(private.ocade_role_permissions(s.role) || s.granted) AS p
                WHERE NOT (p = ANY (s.denied)) ORDER BY p),
         COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
    FROM public.ocade_staff AS s
   WHERE s.user_id = auth.uid();
$$;

-- What each role holds before any per-person change, for whoever manages staff
-- (so the console shows the database's matrix, not a second copy of it).
CREATE OR REPLACE FUNCTION public.ocade_staff_role_defaults()
RETURNS TABLE (role text, permissions text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT r.role, private.ocade_role_permissions(r.role)
    FROM unnest(ARRAY['primary_owner', 'backup_owner', 'admin', 'support', 'billing',
                      'operations', 'read_only']) AS r(role)
   WHERE public.ocade_staff_can('staff.manage');
$$;

-- A privileged change: permission, a second factor, and a recent one.
CREATE OR REPLACE FUNCTION private.ocade_staff_require(p_permission text, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT private.ocade_staff_has(p_permission) THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Confirm the code from your authenticator app to %.', p_action
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth(p_action);
END;
$$;

-- has_role(…, 'admin') — used by older policies — now means "an owner or an
-- Admin", and for a signed-in caller other than the Primary Owner it also
-- needs this session's second factor: those policies open every profile and
-- usage row, which a stolen staff password alone must not reach. The server
-- (no JWT) asks without a session and is answered from the role alone.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    WHEN _role = 'admin'::public.app_role THEN EXISTS (
      SELECT 1 FROM public.ocade_staff
       WHERE user_id = _user_id AND role IN ('primary_owner', 'backup_owner', 'admin')
         AND (auth.uid() IS NULL OR role = 'primary_owner'
              OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
    )
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
    )
  END;
$$;

CREATE OR REPLACE FUNCTION private.ocade_is_support_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_staff
     WHERE user_id = (SELECT auth.uid()) AND role IN ('primary_owner', 'backup_owner', 'admin')
       AND (role = 'primary_owner' OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  );
$$;

-- Both releases read manual grants through the server. This policy was the only
-- way to read every account's grants straight from a browser session, and the
-- second SELECT policy on the table; an account still reads its own.
DROP POLICY IF EXISTS entitlement_grants_admin_read ON public.ocade_entitlement_grants;

-- Grant by email. The server resolves the address to the account's stable id;
-- a verified address with no account yet becomes an invitation that turns
-- into access when that person signs up and verifies it.
CREATE OR REPLACE FUNCTION public.ocade_staff_grant(p_email text, p_role text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_me uuid := auth.uid();
  v_target uuid;
  v_current text;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE');
  IF p_role NOT IN ('backup_owner', 'admin', 'support', 'billing', 'operations', 'read_only') THEN
    RAISE EXCEPTION 'That is not a staff role.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner names a Backup Owner.' USING ERRCODE = '42501';
  END IF;

  SELECT u.id INTO v_target FROM auth.users AS u
   WHERE lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL
   LIMIT 1;

  IF v_target IS NULL THEN
    UPDATE public.ocade_staff_invites SET withdrawn_at = now()
     WHERE email = v_email AND accepted_at IS NULL AND withdrawn_at IS NULL;
    INSERT INTO public.ocade_staff_invites (email, role, invited_by, expires_at)
    VALUES (v_email, p_role, v_me, now() + interval '14 days');
    INSERT INTO public.ocade_admin_actions (actor, action, reason)
    VALUES (v_me, 'staff_invite', btrim(p_reason));
    RETURN jsonb_build_object('status', 'invited');
  END IF;

  IF v_target = v_me THEN
    RAISE EXCEPTION 'Nobody changes their own access.' USING ERRCODE = '42501';
  END IF;
  v_current := private.ocade_staff_role_of(v_target);
  IF v_current = 'primary_owner' THEN
    RAISE EXCEPTION 'The Primary Owner''s access is changed only by handing ownership over.'
      USING ERRCODE = '42501';
  END IF;
  IF v_current = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner changes the Backup Owner.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ocade_staff (user_id, role, granted_by)
  VALUES (v_target, p_role, v_me)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by, updated_at = now();
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, v_target, 'staff_grant', btrim(p_reason));
  RETURN jsonb_build_object('status', 'granted', 'user_id', v_target);
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_staff_set_permissions(
  p_user uuid, p_granted text[], p_denied text[], p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_user = v_me THEN
    RAISE EXCEPTION 'Nobody changes their own access.' USING ERRCODE = '42501';
  END IF;
  v_role := private.ocade_staff_role_of(p_user);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF v_role = 'primary_owner'
     OR (v_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner') THEN
    RAISE EXCEPTION 'Only the Primary Owner changes an owner''s access.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ocade_staff
     SET granted = COALESCE(p_granted, '{}'), denied = COALESCE(p_denied, '{}'), updated_at = now()
   WHERE user_id = p_user;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_user, 'staff_permissions', btrim(p_reason));
  RETURN true;
END;
$$;

-- Removal is immediate: every privileged check reads this table on every request.
CREATE OR REPLACE FUNCTION public.ocade_staff_revoke(p_user uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  v_role := private.ocade_staff_role_of(p_user);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF v_role = 'primary_owner' THEN
    RAISE EXCEPTION 'The Primary Owner is removed only by handing ownership over.'
      USING ERRCODE = '42501';
  END IF;
  IF v_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner removes the Backup Owner.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.ocade_staff WHERE user_id = p_user;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_user, 'staff_revoke', btrim(p_reason));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_staff_withdraw_invite(p_invite uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_staff_invites SET withdrawn_at = now()
   WHERE id = p_invite AND accepted_at IS NULL AND withdrawn_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, subject, action, reason)
  VALUES (auth.uid(), p_invite, 'staff_invite_withdrawn', btrim(p_reason));
  RETURN true;
END;
$$;

-- The Primary Owner hands ownership to the Backup Owner, who becomes Primary;
-- the former Primary Owner becomes the Backup Owner.
CREATE OR REPLACE FUNCTION public.ocade_staff_transfer_ownership(p_to uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'hand over ownership');
  IF private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner hands over ownership.' USING ERRCODE = '42501';
  END IF;
  IF private.ocade_staff_role_of(p_to) IS DISTINCT FROM 'backup_owner' THEN
    RAISE EXCEPTION 'Ownership goes to the Backup Owner. Name one first.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_staff SET role = 'backup_owner', updated_at = now() WHERE user_id = v_me;
  UPDATE public.ocade_staff SET role = 'primary_owner', denied = '{}', updated_at = now()
   WHERE user_id = p_to;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_to, 'owner_transfer', btrim(p_reason));
  RETURN true;
END;
$$;

-- Emergency: every staff session everywhere ends, except the one asking.
CREATE OR REPLACE FUNCTION public.ocade_staff_end_all_sessions(p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_keep uuid := NULLIF(auth.jwt() ->> 'session_id', '')::uuid;
  v_removed integer;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'sign every staff member out');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM auth.sessions AS s
   WHERE s.user_id IN (SELECT user_id FROM public.ocade_staff)
     AND (v_keep IS NULL OR s.id <> v_keep);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  INSERT INTO public.ocade_admin_actions (actor, action, reason)
  VALUES (auth.uid(), 'staff_sessions_ended', btrim(p_reason));
  RETURN v_removed;
END;
$$;

-- A customer's account was taken over: end every session it has.
CREATE OR REPLACE FUNCTION public.ocade_staff_end_customer_sessions(p_user uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_removed integer;
BEGIN
  PERFORM private.ocade_staff_require('sessions.manage', 'end a customer''s sessions');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF private.ocade_staff_role_of(p_user) IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'An owner''s sessions are ended by the owner.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM auth.sessions WHERE user_id = p_user;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'customer_sessions_ended', btrim(p_reason));
  RETURN v_removed;
END;
$$;

-- Conversation access exists only as a case: a reason, at most 72 hours, and
-- every read written down.
CREATE OR REPLACE FUNCTION public.ocade_case_open(p_customer uuid, p_reason text, p_hours integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_case uuid;
BEGIN
  PERFORM private.ocade_staff_require('cases.manage', 'open a support case');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 72 THEN
    RAISE EXCEPTION 'A case lasts between 1 and 72 hours.' USING ERRCODE = '22023';
  END IF;
  IF p_customer = auth.uid() THEN
    RAISE EXCEPTION 'A case is about somebody else''s account.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ocade_support_cases (customer, opened_by, reason, expires_at)
  VALUES (p_customer, auth.uid(), btrim(p_reason), now() + make_interval(hours => p_hours))
  RETURNING id INTO v_case;
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (auth.uid(), p_customer, v_case, 'case_open', btrim(p_reason));
  RETURN v_case;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_case_close(p_case uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_customer uuid;
BEGIN
  PERFORM private.ocade_staff_require('cases.manage', 'close a support case');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_support_cases SET closed_at = now()
   WHERE id = p_case AND closed_at IS NULL
  RETURNING customer INTO v_customer;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (auth.uid(), v_customer, p_case, 'case_close', btrim(p_reason));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_case_messages(p_case uuid, p_conversation uuid)
RETURNS TABLE (role text, content text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_customer uuid;
BEGIN
  IF NOT public.ocade_staff_can('cases.read') THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
  SELECT c.customer INTO v_customer FROM public.ocade_support_cases AS c
   WHERE c.id = p_case AND c.closed_at IS NULL AND c.expires_at > now();
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'This case is closed or has expired.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ocade_conversations AS v
                  WHERE v.id = p_conversation AND v.user_id = v_customer) THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (auth.uid(), v_customer, p_case, 'case_read', 'Read a conversation under an open case.');
  RETURN QUERY
    SELECT m.role, m.content, m.created_at FROM public.ocade_messages AS m
     WHERE m.conversation_id = p_conversation AND m.user_id = v_customer
     ORDER BY m.created_at
     LIMIT 500;
END;
$$;

-- Only the service role names the first Primary Owner, and only while there is none.
CREATE OR REPLACE FUNCTION public.ocade_bootstrap_primary_owner(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ocade_staff WHERE role = 'primary_owner') THEN
    RAISE EXCEPTION 'OCADE already has a Primary Owner.' USING ERRCODE = '42501';
  END IF;
  SELECT u.id INTO v_user FROM auth.users AS u
   WHERE lower(u.email) = lower(btrim(p_email)) AND u.email_confirmed_at IS NOT NULL
   LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No verified account uses that address.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ocade_staff (user_id, role)
  VALUES (v_user, 'primary_owner')
  ON CONFLICT (user_id) DO UPDATE SET role = 'primary_owner', denied = '{}', updated_at = now();
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (NULL, v_user, 'owner_bootstrap', 'Primary Owner named by the service operator.');
  RETURN v_user;
END;
$$;

-- An invitation becomes access when its address is verified by that person.
CREATE OR REPLACE FUNCTION private.ocade_accept_staff_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_invite public.ocade_staff_invites;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_invite FROM public.ocade_staff_invites AS i
   WHERE i.email = lower(NEW.email) AND i.accepted_at IS NULL AND i.withdrawn_at IS NULL
     AND i.expires_at > now()
   LIMIT 1;
  IF v_invite.id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.ocade_staff (user_id, role, granted_by)
  VALUES (NEW.id, v_invite.role, v_invite.invited_by)
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.ocade_staff_invites SET accepted_at = now(), accepted_by = NEW.id
   WHERE id = v_invite.id;
  INSERT INTO public.ocade_admin_actions (actor, target_user, subject, action, reason)
  VALUES (v_invite.invited_by, NEW.id, v_invite.id, 'staff_invite_accepted',
          'The invited address was verified by its owner.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ocade_accept_staff_invite ON auth.users;
CREATE TRIGGER ocade_accept_staff_invite
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.ocade_accept_staff_invite();

-- The four operator RPCs ask for the permission they exercise.
CREATE OR REPLACE FUNCTION public.ocade_admin_remove_device(device uuid, remove_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  owner_id uuid;
BEGIN
  IF NOT private.ocade_staff_has('devices.manage') THEN
    RAISE EXCEPTION 'Only support admins may remove a device.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Removing a device needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('removing a device');
  IF remove_reason IS NULL OR length(btrim(remove_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.jarvis_devices
     SET revoked_at = now(), public_key = NULL
   WHERE id = device AND revoked_at IS NULL
  RETURNING user_id INTO owner_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.jarvis_tasks
     SET status = 'stopped', blocker = 'The device was removed.'
   WHERE device_id = device AND status IN ('running', 'waiting', 'taken_over');
  UPDATE public.jarvis_activity
     SET status = 'cancelled', completed_at = now()
   WHERE device_id = device AND status IN ('queued', 'needs_confirmation', 'claimed');

  INSERT INTO public.ocade_admin_actions (actor, target_user, action, subject, reason)
  VALUES ((SELECT auth.uid()), owner_id, 'remove_device', device, btrim(remove_reason));
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ocade_grant_entitlement(target_user uuid, grant_tier text, grant_reason text, days integer DEFAULT 30)
 RETURNS ocade_entitlement_grants
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  created public.ocade_entitlement_grants;
BEGIN
  IF NOT private.ocade_staff_has('grants.manage') THEN
    RAISE EXCEPTION 'Only support admins may grant an entitlement.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Granting an entitlement needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('granting access');

  IF days IS NULL OR days < 1 OR days > 366 THEN
    RAISE EXCEPTION 'A grant runs for between 1 and 366 days.' USING ERRCODE = '22023';
  END IF;

  /*
   * NOBODY GRANTS THEMSELVES. An admin who needs Pro on their own account asks
   * another admin, exactly as they would for any other privileged change, and
   * the record then shows two people rather than one.
   */
  IF target_user = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'An entitlement cannot be granted to the account granting it.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ocade_entitlement_grants (user_id, granted_by, tier, reason, ends_at)
  VALUES (target_user, (SELECT auth.uid()), grant_tier, grant_reason,
          now() + make_interval(days => days))
  RETURNING * INTO created;

  RETURN created;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ocade_revoke_entitlement(grant_id uuid, revoke_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  affected INTEGER;
BEGIN
  IF NOT private.ocade_staff_has('grants.manage') THEN
    RAISE EXCEPTION 'Only support admins may revoke an entitlement.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Revoking an entitlement needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('revoking access');

  UPDATE public.ocade_entitlement_grants
     SET revoked_at = now(),
         revoked_by = (SELECT auth.uid()),
         revoked_reason = revoke_reason
   WHERE id = grant_id
     AND revoked_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ocade_set_service_control(control_key text, pause boolean, change_reason text)
 RETURNS ocade_service_controls
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  changed public.ocade_service_controls;
BEGIN
  IF NOT private.ocade_staff_has('execution.manage') THEN
    RAISE EXCEPTION 'Only support admins may change a service control.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Changing a service control needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('changing a service control');
  IF change_reason IS NULL OR length(btrim(change_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ocade_service_controls
     SET paused = pause, reason = btrim(change_reason),
         changed_by = (SELECT auth.uid()), changed_at = now()
   WHERE key = control_key
  RETURNING * INTO changed;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown service control.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ocade_service_control_events (key, paused, reason, changed_by)
  VALUES (control_key, pause, btrim(change_reason), (SELECT auth.uid()));
  RETURN changed;
END;
$function$;


-- Whoever can pause JARVIS, or watches system health, can see whether it is paused.
CREATE OR REPLACE FUNCTION public.ocade_read_service_controls()
RETURNS SETOF public.ocade_service_controls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT (private.ocade_staff_has('execution.manage') OR private.ocade_staff_has('health.read')) THEN
    RAISE EXCEPTION 'Only support admins may read service controls.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.ocade_service_controls ORDER BY key;
END;
$$;

REVOKE ALL ON FUNCTION private.ocade_role_permissions(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.ocade_known_permissions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_staff_can(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.ocade_staff_has(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_my_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_staff_role_defaults() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.ocade_staff_require(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ocade_staff_role_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ocade_accept_staff_invite() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_staff_grant(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_staff_set_permissions(uuid, text[], text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_staff_revoke(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_staff_withdraw_invite(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_staff_transfer_ownership(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_staff_end_all_sessions(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_staff_end_customer_sessions(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_case_open(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_case_close(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_case_messages(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_bootstrap_primary_owner(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.ocade_role_permissions(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.ocade_known_permissions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_staff_can(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ocade_my_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_staff_role_defaults() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_staff_grant(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_staff_set_permissions(uuid, text[], text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_staff_revoke(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_staff_withdraw_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_staff_transfer_ownership(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_staff_end_all_sessions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_staff_end_customer_sessions(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_case_open(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_case_close(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_case_messages(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_bootstrap_primary_owner(text) TO service_role;

COMMIT;
