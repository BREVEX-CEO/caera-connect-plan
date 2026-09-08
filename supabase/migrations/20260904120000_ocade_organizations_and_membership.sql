-- Organizations, membership, invitations and groups, as PLAN.md §F defines them.
--
-- WHY OCADE GETS ITS OWN MODEL RATHER THAN REUSING `tenants`.
--
-- `tenants` and `tenant_members` already exist in this schema and were the
-- obvious shortcut. They are FICIA's company-entity model: a tenant carries a
-- registration number, tax ids, fiscal year, accounting method, branches and
-- subsidiaries, and its roles are owner, manager, employee, accountant,
-- auditor, consultant and advisor. That is a vocabulary for describing a
-- BUSINESS, and OCADE's question is a different one — who may act inside this
-- workspace, and with what authority. Building OCADE's team surface on those
-- tables would have made one product's roles mean something else in another,
-- and the first person to add a role would have had to decide for both.
--
-- THE INVARIANT THIS SCHEMA EXISTS TO HOLD: an organization always has at
-- least one ACTIVE OWNER. §F asks for last-owner protection, ownership-transfer
-- safety and primary-owner transfer, and all three are the same rule seen from
-- three sides. It is enforced in the functions below rather than in the
-- application, because an application-level check is one forgotten call site
-- away from an organization nobody can administer — a state with no recovery
-- that does not involve a database console.
--
-- UI VISIBILITY IS NOT AUTHORIZATION, and §F says so explicitly. Every mutation
-- is a SECURITY DEFINER function that resolves the caller's role in the
-- organization the TARGET ROW belongs to. There is no path where a caller names
-- both a row and the organization it is in, because that is the shape that lets
-- somebody pass their own organization's id alongside somebody else's member.
--
-- INVITATION TOKENS ARE STORED AS HASHES, never as the token. The plaintext is
-- shown once, in the link; a stolen copy of this table is not a list of live
-- invitations somebody can accept.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  /*
   * A URL-safe handle. Unique, lowercase, and NOT derived from the name in the
   * database: two organizations may legitimately be called "Design", and a
   * generated slug that silently became "design-2" is a name nobody chose.
   */
  slug text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_organizations_name CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT ocade_organizations_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  CONSTRAINT ocade_organizations_slug_key UNIQUE (slug)
);

/*
 * `created_by` is ON DELETE RESTRICT and that is deliberate: an account cannot
 * be deleted while it is recorded as having created an organization that still
 * exists. §O asks for ownership transfer BEFORE owner deletion, and this makes
 * the database refuse the unsafe order rather than leaving an organization
 * whose origin is null.
 */

CREATE TABLE IF NOT EXISTS public.ocade_organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.ocade_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  /*
   * `deactivated` is not `removed`. §F asks for both, and they answer different
   * questions: a deactivated member keeps their history and their place in the
   * organization and simply cannot act; a removed one is gone. Conflating them
   * means either losing the record of who did what, or being unable to suspend
   * somebody without it.
   */
  state text NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_organization_members_role CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT ocade_organization_members_state CHECK (state IN ('active', 'deactivated')),
  CONSTRAINT ocade_organization_members_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS ocade_organization_members_user_idx
  ON public.ocade_organization_members (user_id);

-- The last-owner check runs on every role change, state change and removal.
CREATE INDEX IF NOT EXISTS ocade_organization_members_owners_idx
  ON public.ocade_organization_members (organization_id)
  WHERE role = 'owner' AND state = 'active';

CREATE TABLE IF NOT EXISTS public.ocade_organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.ocade_organizations(id) ON DELETE CASCADE,
  /*
   * Stored lowercase and compared lowercase. An invitation to Sam@Example.com
   * that cannot be accepted by sam@example.com is a support ticket, not a
   * security boundary — and the address is only ever used to ADDRESS the
   * invitation, never to authorise it. Acceptance binds to `auth.uid()`.
   */
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  -- SHA-256 of the token, lowercase hex. The token itself is never stored.
  token_hash text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ocade_organization_invites_role CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT ocade_organization_invites_email CHECK (email = lower(email) AND email LIKE '%_@_%'),
  CONSTRAINT ocade_organization_invites_token CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ocade_organization_invites_token_key UNIQUE (token_hash),
  /*
   * An invitation is either open, accepted or revoked — never accepted AND
   * revoked. Expressed as a constraint because a row in both states makes
   * "is this invitation live?" unanswerable, and every caller would then
   * answer it differently.
   */
  CONSTRAINT ocade_organization_invites_settled CHECK (
    accepted_at IS NULL OR revoked_at IS NULL
  )
);

-- One OPEN invitation per address per organization. Re-inviting somebody who
-- already has a live invitation is a resend, which §F asks for separately.
CREATE UNIQUE INDEX IF NOT EXISTS ocade_organization_invites_open_idx
  ON public.ocade_organization_invites (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.ocade_organization_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.ocade_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_organization_groups_name CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  CONSTRAINT ocade_organization_groups_unique UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.ocade_organization_group_members (
  group_id uuid NOT NULL REFERENCES public.ocade_organization_groups(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.ocade_organization_members(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, member_id)
);

/*
 * THE AUDIT TRAIL, WHICH §F ASKS FOR BY NAME.
 *
 * Every mutation below writes one row here, and the row is written by the same
 * SECURITY DEFINER function that made the change — so there is no path where a
 * membership changes and the trail does not say so. An audit log the
 * application is trusted to write is an audit log that is missing exactly the
 * events somebody had a reason to omit.
 *
 * There is no UPDATE or DELETE policy and no grant for either: authenticated
 * callers may read their organization's history and nothing else. Corrections
 * are new rows.
 */
CREATE TABLE IF NOT EXISTS public.ocade_organization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.ocade_organizations(id) ON DELETE CASCADE,
  /* Free text would drift into six spellings of the same event. */
  event text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  /* The account the event was ABOUT, when there is one. */
  subject_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_organization_events_event CHECK (
    event IN (
      'organization.created',
      'organization.renamed',
      'organization.deleted',
      'invite.sent',
      'invite.resent',
      'invite.accepted',
      'invite.revoked',
      'member.role_changed',
      'member.deactivated',
      'member.reactivated',
      'member.removed',
      'ownership.transferred',
      'group.created',
      'group.deleted',
      'group.member_added',
      'group.member_removed'
    )
  )
);

CREATE INDEX IF NOT EXISTS ocade_organization_events_org_time_idx
  ON public.ocade_organization_events (organization_id, created_at DESC);

/**
 * Write one audit row.
 *
 * `SECURITY DEFINER` and granted to nobody: it is called only from the
 * functions in this file, so an authenticated caller cannot forge history by
 * calling it directly.
 */
CREATE OR REPLACE FUNCTION public.ocade_record_organization_event(
  p_organization_id uuid,
  p_event text,
  p_subject_id uuid DEFAULT NULL,
  p_detail jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.ocade_organization_events
    (organization_id, event, actor_id, subject_id, detail)
  VALUES (p_organization_id, p_event, auth.uid(), p_subject_id, p_detail)
$$;

/* --------------------------------------------------------------- reading -- */

/**
 * The caller's role in an organization, or NULL.
 *
 * Every policy and every mutation below asks this one question, so it is one
 * function. `STABLE` rather than `VOLATILE` so a policy can call it once per
 * statement instead of once per row.
 *
 * A DEACTIVATED MEMBER HAS NO ROLE HERE. That is the point of deactivation:
 * they remain a member of the organization and can do nothing in it.
 */
CREATE OR REPLACE FUNCTION public.ocade_org_role(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
    FROM public.ocade_organization_members
   WHERE auth.uid() IS NOT NULL
     AND organization_id = p_organization_id
     AND user_id = auth.uid()
     AND state = 'active'
$$;

/**
 * True when the caller may administer this organization.
 *
 * `COALESCE` IS THE WHOLE FUNCTION, AND LEAVING IT OUT WAS A PRIVILEGE
 * ESCALATION. `ocade_org_role` returns NULL for somebody who is not a member,
 * and `NULL IN ('owner', 'admin')` is NULL rather than false. Every guard below
 * is written `IF NOT public.ocade_org_can_administer(...) THEN RAISE`, and
 * `NOT NULL` is NULL — which plpgsql treats as "do not take this branch". So
 * the one caller the guard exists to stop, a complete outsider, was the one
 * caller who walked straight past it.
 *
 * Found by the behavioural suite, not by reading: an account that owned a
 * different organization removed a member from this one and got `1` back.
 * A boolean that can be NULL has three values, and `IF NOT` only handles two.
 */
CREATE OR REPLACE FUNCTION public.ocade_org_can_administer(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE(public.ocade_org_role(p_organization_id) IN ('owner', 'admin'), false)
$$;

/**
 * True when the caller is an OWNER of this organization.
 *
 * Exists for the same reason and is written the same way. The guards it
 * replaces read `IF public.ocade_org_role(...) <> 'owner' THEN RAISE`, which is
 * NULL for a non-member — so ownership transfer and organization deletion were
 * reachable by anybody who knew an id.
 */
CREATE OR REPLACE FUNCTION public.ocade_org_is_owner(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE(public.ocade_org_role(p_organization_id) = 'owner', false)
$$;

ALTER TABLE public.ocade_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_organization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_organization_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_organization_events ENABLE ROW LEVEL SECURITY;

/*
 * READ POLICIES ONLY. Every write goes through a function below, because a
 * write policy cannot express "and the organization must keep an owner" — and a
 * policy permissive enough to allow a legitimate role change is permissive
 * enough to allow the last owner demoting themselves.
 *
 * CROSS-ORGANIZATION ISOLATION IS THE `USING` CLAUSE. A member of organization A
 * matches no row of organization B, so there is nothing to filter in the
 * application and nothing an application bug can widen.
 */
DROP POLICY IF EXISTS ocade_organizations_member_read ON public.ocade_organizations;
CREATE POLICY ocade_organizations_member_read
  ON public.ocade_organizations FOR SELECT TO authenticated
  USING (public.ocade_org_role(id) IS NOT NULL);

DROP POLICY IF EXISTS ocade_organization_members_read ON public.ocade_organization_members;
CREATE POLICY ocade_organization_members_read
  ON public.ocade_organization_members FOR SELECT TO authenticated
  USING (public.ocade_org_role(organization_id) IS NOT NULL);

/*
 * An invitation is visible to the organization's administrators — not to its
 * ordinary members, because the list of who has been invited is a list of who
 * somebody thought of hiring.
 */
DROP POLICY IF EXISTS ocade_organization_invites_admin_read ON public.ocade_organization_invites;
CREATE POLICY ocade_organization_invites_admin_read
  ON public.ocade_organization_invites FOR SELECT TO authenticated
  USING (public.ocade_org_can_administer(organization_id));

DROP POLICY IF EXISTS ocade_organization_groups_read ON public.ocade_organization_groups;
CREATE POLICY ocade_organization_groups_read
  ON public.ocade_organization_groups FOR SELECT TO authenticated
  USING (public.ocade_org_role(organization_id) IS NOT NULL);

DROP POLICY IF EXISTS ocade_organization_group_members_read
  ON public.ocade_organization_group_members;
CREATE POLICY ocade_organization_group_members_read
  ON public.ocade_organization_group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.ocade_organization_groups g
       WHERE g.id = group_id AND public.ocade_org_role(g.organization_id) IS NOT NULL
    )
  );

/*
 * The audit trail is readable by ADMINISTRATORS, not by every member. It names
 * who deactivated whom and who was invited and never joined, which is
 * management information rather than a shared workspace record.
 */
DROP POLICY IF EXISTS ocade_organization_events_admin_read ON public.ocade_organization_events;
CREATE POLICY ocade_organization_events_admin_read
  ON public.ocade_organization_events FOR SELECT TO authenticated
  USING (public.ocade_org_can_administer(organization_id));

/*
 * REVOKE FIRST, AND FROM THE ROLES BY NAME — NOT FROM `PUBLIC`.
 *
 * A Supabase project carries `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES
 * TO anon, authenticated, service_role`, so a table is created with INSERT,
 * UPDATE, DELETE and TRUNCATE already granted DIRECTLY to `authenticated`.
 * `REVOKE ... FROM PUBLIC` does not touch a direct grant, and the local twin
 * has no default privileges at all — so the twin proved "authenticated cannot
 * write these tables" while production had handed it every write on all six.
 *
 * Row-level security still refused those writes, because none of these tables
 * has an INSERT, UPDATE or DELETE policy. But the grant is the second half of a
 * two-part lock, and leaving it open means the day somebody adds a permissive
 * policy for one legitimate case, the direct write path is already there.
 *
 * Caught by the Supabase advisor after applying, and the twin now reproduces
 * the same default privileges so the next migration is checked before it goes.
 */
REVOKE ALL ON TABLE public.ocade_organizations FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_invites FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_groups FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_group_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_events FROM anon, authenticated;

GRANT SELECT ON TABLE public.ocade_organizations TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_members TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_invites TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_groups TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_group_members TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_events TO authenticated;
GRANT ALL ON TABLE public.ocade_organizations TO service_role;
GRANT ALL ON TABLE public.ocade_organization_members TO service_role;
GRANT ALL ON TABLE public.ocade_organization_invites TO service_role;
GRANT ALL ON TABLE public.ocade_organization_groups TO service_role;
GRANT ALL ON TABLE public.ocade_organization_group_members TO service_role;
GRANT ALL ON TABLE public.ocade_organization_events TO service_role;

/* --------------------------------------------------------------- writing -- */

/**
 * Create an organization, with its creator as the first owner.
 *
 * ONE STATEMENT PAIR IN ONE TRANSACTION, because an organization with no owner
 * is the unadministrable state this schema exists to prevent — and creating the
 * row and its first membership as two client calls has a window in which
 * exactly that exists.
 */
CREATE OR REPLACE FUNCTION public.ocade_create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'An organization belongs to an account.';
  END IF;

  INSERT INTO public.ocade_organizations (name, slug, created_by)
  VALUES (trim(p_name), lower(trim(p_slug)), auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.ocade_organization_members (organization_id, user_id, role)
  VALUES (new_id, auth.uid(), 'owner');

  PERFORM public.ocade_record_organization_event(
    new_id, 'organization.created', auth.uid(), jsonb_build_object('slug', lower(trim(p_slug)))
  );

  RETURN new_id;
END;
$$;

/**
 * Invite somebody by email.
 *
 * DUPLICATE AND ALREADY-MEMBER HANDLING, which §F asks for by name, are two
 * different answers and both are given here rather than left to the caller:
 * inviting somebody who is already in the organization is refused with that
 * reason, and inviting an address that already has a live invitation is
 * refused as a duplicate — the caller is told to resend instead, which keeps
 * one token live per address rather than two.
 *
 * The token is hashed by the caller. This function never sees it, so it cannot
 * leak into a statement log.
 */
CREATE OR REPLACE FUNCTION public.ocade_invite_to_organization(
  p_organization_id uuid,
  p_email text,
  p_role text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalised text := lower(trim(p_email));
  invite_id uuid;
BEGIN
  IF NOT public.ocade_org_can_administer(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may invite people to this organization.';
  END IF;
  /*
   * Only an OWNER may create another owner. An admin who could invite an owner
   * could promote themselves through a second account, which is a privilege
   * escalation with an email address in the middle of it.
   */
  IF p_role = 'owner' AND NOT public.ocade_org_is_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner may invite another owner.';
  END IF;
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'An invitation must expire in the future.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.ocade_organization_members m
      JOIN auth.users u ON u.id = m.user_id
     WHERE m.organization_id = p_organization_id AND lower(u.email) = normalised
  ) THEN
    RAISE EXCEPTION 'That person is already in this organization.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ocade_organization_invites
     WHERE organization_id = p_organization_id
       AND email = normalised
       AND accepted_at IS NULL
       AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'That address already has an open invitation. Resend it instead.';
  END IF;

  INSERT INTO public.ocade_organization_invites
    (organization_id, email, role, token_hash, invited_by, expires_at)
  VALUES
    (p_organization_id, normalised, p_role, p_token_hash, auth.uid(), p_expires_at)
  RETURNING id INTO invite_id;

  PERFORM public.ocade_record_organization_event(
    p_organization_id, 'invite.sent', NULL,
    jsonb_build_object('invite_id', invite_id, 'email', normalised, 'role', p_role)
  );

  RETURN invite_id;
END;
$$;

/**
 * Accept an invitation.
 *
 * THE TOKEN IS THE ONLY THING THE CALLER SUPPLIES, and the organization is read
 * from the row it matches. A function that took both would let somebody present
 * a valid token for organization A alongside organization B's id.
 *
 * IDEMPOTENT ON A SECOND PRESS. Somebody who clicks the link twice, or whose
 * browser retries, must not see an error that reads as "your invitation is
 * broken" — so an invitation this account has already accepted returns the
 * organization again rather than raising.
 */
CREATE OR REPLACE FUNCTION public.ocade_accept_organization_invite(p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite public.ocade_organization_invites;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to accept an invitation.';
  END IF;

  SELECT * INTO invite
    FROM public.ocade_organization_invites
   WHERE token_hash = p_token_hash
   FOR UPDATE;

  IF invite.id IS NULL THEN
    RAISE EXCEPTION 'That invitation link is not valid.';
  END IF;
  IF invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'That invitation was withdrawn.';
  END IF;
  IF invite.accepted_at IS NOT NULL THEN
    IF invite.accepted_by = auth.uid() THEN
      RETURN invite.organization_id;
    END IF;
    RAISE EXCEPTION 'That invitation has already been used.';
  END IF;
  IF invite.expires_at <= now() THEN
    RAISE EXCEPTION 'That invitation has expired. Ask for a new one.';
  END IF;

  INSERT INTO public.ocade_organization_members
    (organization_id, user_id, role, invited_by)
  VALUES
    (invite.organization_id, auth.uid(), invite.role, invite.invited_by)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.ocade_organization_invites
     SET accepted_at = now(), accepted_by = auth.uid()
   WHERE id = invite.id;

  PERFORM public.ocade_record_organization_event(
    invite.organization_id, 'invite.accepted', auth.uid(),
    jsonb_build_object('invite_id', invite.id, 'role', invite.role)
  );

  RETURN invite.organization_id;
END;
$$;

/** Withdraw an open invitation. */
CREATE OR REPLACE FUNCTION public.ocade_revoke_organization_invite(p_invite_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
  owning_org uuid;
BEGIN
  UPDATE public.ocade_organization_invites
     SET revoked_at = now(), revoked_by = auth.uid()
   WHERE id = p_invite_id
     AND accepted_at IS NULL
     AND revoked_at IS NULL
     AND public.ocade_org_can_administer(organization_id)
  RETURNING organization_id INTO owning_org;
  GET DIAGNOSTICS affected = ROW_COUNT;

  IF affected > 0 THEN
    PERFORM public.ocade_record_organization_event(
      owning_org, 'invite.revoked', NULL, jsonb_build_object('invite_id', p_invite_id)
    );
  END IF;
  RETURN affected;
END;
$$;

/**
 * Resend an open invitation with a fresh token and a fresh expiry.
 *
 * §F asks for resend separately from invite, and it is a different operation:
 * the previous token stops working, so a link that was forwarded to the wrong
 * person is dead once the real recipient asks for a new one. Reusing the row
 * rather than opening a second one is what keeps ONE live invitation per
 * address, which is the invariant the partial unique index holds.
 */
CREATE OR REPLACE FUNCTION public.ocade_resend_organization_invite(
  p_invite_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_invites;
BEGIN
  SELECT * INTO target
    FROM public.ocade_organization_invites WHERE id = p_invite_id FOR UPDATE;
  IF target.id IS NULL THEN
    RAISE EXCEPTION 'That invitation no longer exists.';
  END IF;
  IF NOT public.ocade_org_can_administer(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may resend an invitation.';
  END IF;
  IF target.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'That invitation has already been accepted.';
  END IF;
  IF target.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'That invitation was withdrawn. Send a new one.';
  END IF;
  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'An invitation must expire in the future.';
  END IF;

  UPDATE public.ocade_organization_invites
     SET token_hash = p_token_hash, expires_at = p_expires_at
   WHERE id = p_invite_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'invite.resent', NULL,
    jsonb_build_object('invite_id', p_invite_id, 'email', target.email)
  );
  RETURN 1;
END;
$$;

/**
 * How many ACTIVE owners an organization would have left.
 *
 * One function, used by every path that could remove one — role change,
 * deactivation and removal — because three copies of this arithmetic is three
 * chances for one of them to count a deactivated owner.
 */
CREATE OR REPLACE FUNCTION public.ocade_org_active_owners(p_organization_id uuid, p_excluding uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
    FROM public.ocade_organization_members
   WHERE organization_id = p_organization_id
     AND role = 'owner'
     AND state = 'active'
     AND (p_excluding IS NULL OR id <> p_excluding)
$$;

/**
 * Change a member's role.
 *
 * LAST-OWNER PROTECTION IS HERE, not in the screen. §F asks for it, and the
 * state it prevents — an organization with no active owner — cannot be repaired
 * from inside the product by anybody, because there is nobody left with the
 * authority to repair it.
 */
CREATE OR REPLACE FUNCTION public.ocade_set_organization_member_role(
  p_member_id uuid,
  p_role text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_members;
  caller_role text;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_members WHERE id = p_member_id FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'That person is not in this organization.'; END IF;

  caller_role := public.ocade_org_role(target.organization_id);
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only an owner or admin may change a role.';
  END IF;
  -- Only an owner may create or unmake an owner.
  IF (p_role = 'owner' OR target.role = 'owner') AND caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner may change an owner''s role.';
  END IF;
  IF target.role = 'owner' AND p_role <> 'owner'
     AND public.ocade_org_active_owners(target.organization_id, target.id) = 0 THEN
    RAISE EXCEPTION 'This is the last owner. Make somebody else an owner first.';
  END IF;

  IF target.role = p_role THEN RETURN 0; END IF;

  UPDATE public.ocade_organization_members
     SET role = p_role, updated_at = now()
   WHERE id = p_member_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'member.role_changed', target.user_id,
    jsonb_build_object('from', target.role, 'to', p_role)
  );
  RETURN 1;
END;
$$;

/** Deactivate or reactivate a member. */
CREATE OR REPLACE FUNCTION public.ocade_set_organization_member_state(
  p_member_id uuid,
  p_state text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_members;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_members WHERE id = p_member_id FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'That person is not in this organization.'; END IF;
  IF NOT public.ocade_org_can_administer(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may deactivate a member.';
  END IF;
  IF target.role = 'owner' AND NOT public.ocade_org_is_owner(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner may deactivate an owner.';
  END IF;
  IF p_state = 'deactivated' AND target.role = 'owner'
     AND public.ocade_org_active_owners(target.organization_id, target.id) = 0 THEN
    RAISE EXCEPTION 'This is the last active owner.';
  END IF;

  IF target.state = p_state THEN RETURN 0; END IF;

  UPDATE public.ocade_organization_members
     SET state = p_state, updated_at = now()
   WHERE id = p_member_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id,
    CASE WHEN p_state = 'deactivated' THEN 'member.deactivated' ELSE 'member.reactivated' END,
    target.user_id,
    '{}'::jsonb
  );
  RETURN 1;
END;
$$;

/** Remove a member entirely. */
CREATE OR REPLACE FUNCTION public.ocade_remove_organization_member(p_member_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_members;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_members WHERE id = p_member_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN 0; END IF;
  IF NOT public.ocade_org_can_administer(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may remove a member.';
  END IF;
  IF target.role = 'owner' AND NOT public.ocade_org_is_owner(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner may remove an owner.';
  END IF;
  IF target.role = 'owner'
     AND public.ocade_org_active_owners(target.organization_id, target.id) = 0 THEN
    RAISE EXCEPTION 'This is the last owner. Transfer ownership first.';
  END IF;

  DELETE FROM public.ocade_organization_members WHERE id = p_member_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'member.removed', target.user_id,
    jsonb_build_object('role', target.role)
  );
  RETURN 1;
END;
$$;

/**
 * Hand primary ownership to somebody else.
 *
 * ONE STATEMENT, BOTH SIDES. Promoting the new owner and demoting the old one
 * as two calls has a window with two owners and a window with none, depending
 * on the order — and the one with none is unrecoverable. Doing both here means
 * neither window exists.
 *
 * The outgoing owner becomes an ADMIN rather than being removed: somebody who
 * hands over a workspace has not asked to leave it.
 */
CREATE OR REPLACE FUNCTION public.ocade_transfer_organization_ownership(
  p_organization_id uuid,
  p_to_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient public.ocade_organization_members;
BEGIN
  IF NOT public.ocade_org_is_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner may transfer ownership.';
  END IF;
  IF p_to_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You already own this organization.';
  END IF;

  SELECT * INTO recipient
    FROM public.ocade_organization_members
   WHERE organization_id = p_organization_id AND user_id = p_to_user_id
   FOR UPDATE;
  IF recipient.id IS NULL THEN
    RAISE EXCEPTION 'That person is not in this organization.';
  END IF;
  IF recipient.state <> 'active' THEN
    RAISE EXCEPTION 'A deactivated member cannot become the owner.';
  END IF;

  UPDATE public.ocade_organization_members
     SET role = 'owner', updated_at = now()
   WHERE id = recipient.id;

  UPDATE public.ocade_organization_members
     SET role = 'admin', updated_at = now()
   WHERE organization_id = p_organization_id AND user_id = auth.uid();

  PERFORM public.ocade_record_organization_event(
    p_organization_id, 'ownership.transferred', p_to_user_id,
    jsonb_build_object('from', auth.uid())
  );

  RETURN 1;
END;
$$;

/* ----------------------------------------------------------------- groups -- */

/**
 * Groups are named sets of members WITHIN one organization.
 *
 * A group never spans organizations, and the schema is what stops it: a group
 * belongs to an organization, and `ocade_organization_group_members` joins a
 * group to a MEMBER row — which already carries its organization — rather than
 * to a user id. Adding somebody else's account to your group would require a
 * membership row in your organization, which is the correct precondition.
 */
CREATE OR REPLACE FUNCTION public.ocade_create_organization_group(
  p_organization_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  group_id uuid;
BEGIN
  IF NOT public.ocade_org_can_administer(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may create a group.';
  END IF;

  INSERT INTO public.ocade_organization_groups (organization_id, name)
  VALUES (p_organization_id, trim(p_name))
  RETURNING id INTO group_id;

  PERFORM public.ocade_record_organization_event(
    p_organization_id, 'group.created', NULL,
    jsonb_build_object('group_id', group_id, 'name', trim(p_name))
  );
  RETURN group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_delete_organization_group(p_group_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_groups;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_groups WHERE id = p_group_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN 0; END IF;
  IF NOT public.ocade_org_can_administer(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may delete a group.';
  END IF;

  DELETE FROM public.ocade_organization_groups WHERE id = p_group_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'group.deleted', NULL,
    jsonb_build_object('group_id', p_group_id, 'name', target.name)
  );
  RETURN 1;
END;
$$;

/**
 * Put a member in a group, or take them out.
 *
 * BOTH IDS ARE RESOLVED TO THEIR OWN ORGANIZATION AND THE TWO MUST MATCH. This
 * is the forged-request case §F names: a caller who administers organization A
 * passing A's group id alongside B's member id. Neither id is trusted to carry
 * the other's organization.
 */
CREATE OR REPLACE FUNCTION public.ocade_set_organization_group_membership(
  p_group_id uuid,
  p_member_id uuid,
  p_present boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  group_org uuid;
  member_org uuid;
  member_user uuid;
  affected integer;
BEGIN
  SELECT organization_id INTO group_org
    FROM public.ocade_organization_groups WHERE id = p_group_id;
  SELECT organization_id, user_id INTO member_org, member_user
    FROM public.ocade_organization_members WHERE id = p_member_id;

  IF group_org IS NULL OR member_org IS NULL THEN
    RAISE EXCEPTION 'That group or member no longer exists.';
  END IF;
  IF group_org <> member_org THEN
    RAISE EXCEPTION 'That member is not in this group''s organization.';
  END IF;
  IF NOT public.ocade_org_can_administer(group_org) THEN
    RAISE EXCEPTION 'Only an owner or admin may change group membership.';
  END IF;

  IF p_present THEN
    INSERT INTO public.ocade_organization_group_members (group_id, member_id)
    VALUES (p_group_id, p_member_id)
    ON CONFLICT (group_id, member_id) DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected > 0 THEN
      PERFORM public.ocade_record_organization_event(
        group_org, 'group.member_added', member_user,
        jsonb_build_object('group_id', p_group_id)
      );
    END IF;
  ELSE
    DELETE FROM public.ocade_organization_group_members
     WHERE group_id = p_group_id AND member_id = p_member_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected > 0 THEN
      PERFORM public.ocade_record_organization_event(
        group_org, 'group.member_removed', member_user,
        jsonb_build_object('group_id', p_group_id)
      );
    END IF;
  END IF;

  RETURN affected;
END;
$$;

/* ------------------------------------------------- settings and deletion -- */

/** Rename an organization. The slug is immutable: links to it are not. */
CREATE OR REPLACE FUNCTION public.ocade_rename_organization(
  p_organization_id uuid,
  p_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous text;
BEGIN
  IF NOT public.ocade_org_can_administer(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may rename this organization.';
  END IF;

  UPDATE public.ocade_organizations
     SET name = trim(p_name), updated_at = now()
   WHERE id = p_organization_id
  RETURNING name INTO previous;
  IF previous IS NULL THEN RETURN 0; END IF;

  PERFORM public.ocade_record_organization_event(
    p_organization_id, 'organization.renamed', NULL,
    jsonb_build_object('name', trim(p_name))
  );
  RETURN 1;
END;
$$;

/**
 * Delete an organization. §G's danger zone.
 *
 * OWNER ONLY, AND THE NAME MUST BE TYPED BACK. §G asks for typed confirmations,
 * and the confirmation is checked HERE rather than only in the dialog, because
 * a dialog is a thing a forged request skips. The comparison is exact — a
 * destructive action confirmed by a near-miss is a destructive action confirmed
 * by autocomplete.
 *
 * Everything the organization owns goes with it by `ON DELETE CASCADE`:
 * memberships, invitations, groups, group membership and the audit trail. The
 * trail is deliberately not preserved — it is a record of who did what INSIDE
 * this organization, and there is no organization left for it to describe.
 */
CREATE OR REPLACE FUNCTION public.ocade_delete_organization(
  p_organization_id uuid,
  p_typed_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organizations;
BEGIN
  SELECT * INTO target FROM public.ocade_organizations WHERE id = p_organization_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN 0; END IF;
  IF NOT public.ocade_org_is_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner may delete this organization.';
  END IF;
  IF p_typed_name IS DISTINCT FROM target.name THEN
    RAISE EXCEPTION 'Type the organization name exactly to confirm.';
  END IF;

  DELETE FROM public.ocade_organizations WHERE id = p_organization_id;
  RETURN 1;
END;
$$;

/*
 * REVOKE FROM PUBLIC BEFORE GRANTING TO `authenticated`.
 *
 * PostgreSQL grants EXECUTE on a new function to PUBLIC by default, and in
 * Supabase PUBLIC includes `anon` — every visitor, signed in or not. The three
 * READ helpers were the ones this was nearly missed on: they carry no mutation,
 * so they read as harmless, and a SECURITY DEFINER function reachable by the
 * whole internet is not. Caught by the schema gate, which checks exactly this.
 */
REVOKE ALL ON FUNCTION public.ocade_org_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_org_can_administer(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_org_is_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_create_organization(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_invite_to_organization(uuid, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_accept_organization_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_revoke_organization_invite(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_set_organization_member_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_set_organization_member_state(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_remove_organization_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_transfer_organization_ownership(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_org_active_owners(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_resend_organization_invite(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_create_organization_group(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_delete_organization_group(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_set_organization_group_membership(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_rename_organization(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_delete_organization(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_record_organization_event(uuid, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ocade_org_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_org_can_administer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_org_is_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_create_organization(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_invite_to_organization(uuid, text, text, text, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_accept_organization_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_revoke_organization_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_set_organization_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_set_organization_member_state(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_remove_organization_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_transfer_organization_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_resend_organization_invite(uuid, text, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_create_organization_group(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_delete_organization_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_set_organization_group_membership(uuid, uuid, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_rename_organization(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_delete_organization(uuid, text) TO authenticated;

COMMIT;
