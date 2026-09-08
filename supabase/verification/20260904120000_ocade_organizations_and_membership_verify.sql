-- Verification for 20260904120000_ocade_organizations_and_membership.
--
-- Each block RAISES on failure, so a run that returns successfully and prints
-- nothing is the pass. These check the properties the migration exists to
-- guarantee, not that the objects were created: an organization table with row
-- security disabled, or an authorization helper that answers NULL, satisfies
-- "it exists" and fails the only thing that matters.

DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(t, ', ') INTO missing
    FROM unnest(ARRAY[
      'public.ocade_organizations',
      'public.ocade_organization_members',
      'public.ocade_organization_invites',
      'public.ocade_organization_groups',
      'public.ocade_organization_group_members',
      'public.ocade_organization_events'
    ]) AS t
   WHERE to_regclass(t) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'missing organization tables: %', missing;
  END IF;
END $$;

-- Row-level security is on for every one of them.
DO $$
DECLARE
  unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO unprotected
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname LIKE 'ocade_organization%'
     AND c.relkind = 'r'
     AND c.relrowsecurity = false;
  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'row-level security is off for: %', unprotected;
  END IF;
END $$;

-- Authenticated may READ and may not WRITE: every mutation is a function, so a
-- direct grant would be a second, unguarded way to change membership.
DO $$
DECLARE
  writable text;
BEGIN
  SELECT string_agg(DISTINCT table_name, ', ')
    INTO writable
    FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated'
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
     AND table_name LIKE 'ocade_organization%';
  IF writable IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated can write directly to: %', writable;
  END IF;
END $$;

-- RLS decides which rows; GRANT decides whether the table may be read at all.
-- A policy with no grant fails every query with "permission denied for table".
DO $$
DECLARE
  ungranted text;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO ungranted
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname LIKE 'ocade_organization%'
     AND c.relkind = 'r'
     AND NOT has_table_privilege('authenticated', c.oid, 'SELECT');
  IF ungranted IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated has no SELECT grant on: %', ungranted;
  END IF;
END $$;

/*
 * THE AUTHORIZATION HELPERS MUST NEVER ANSWER NULL.
 *
 * This is the defect the behavioural suite caught before this migration was
 * applied anywhere: `role IN ('owner','admin')` is NULL for a non-member, and
 * every guard is written `IF NOT can_administer(...) THEN RAISE`. `NOT NULL` is
 * NULL, which plpgsql does not treat as true — so an outsider walked past every
 * guard. A random id belongs to no organization, which is the non-member case.
 */
DO $$
DECLARE
  administers boolean;
  owns boolean;
BEGIN
  SELECT public.ocade_org_can_administer('00000000-0000-4000-8000-000000000000')
    INTO administers;
  SELECT public.ocade_org_is_owner('00000000-0000-4000-8000-000000000000') INTO owns;
  IF administers IS NULL OR owns IS NULL THEN
    RAISE EXCEPTION 'an organization authorization helper answered NULL for a non-member';
  END IF;
  IF administers OR owns THEN
    RAISE EXCEPTION 'an organization authorization helper said yes to a non-member';
  END IF;
END $$;

-- Every mutation is SECURITY DEFINER, or its guards run as the caller and the
-- caller cannot read the rows the guard needs.
DO $$
DECLARE
  invoker text;
BEGIN
  SELECT string_agg(p.proname, ', ')
    INTO invoker
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'ocade_create_organization', 'ocade_invite_to_organization',
       'ocade_accept_organization_invite', 'ocade_revoke_organization_invite',
       'ocade_resend_organization_invite', 'ocade_set_organization_member_role',
       'ocade_set_organization_member_state', 'ocade_remove_organization_member',
       'ocade_transfer_organization_ownership', 'ocade_create_organization_group',
       'ocade_delete_organization_group', 'ocade_set_organization_group_membership',
       'ocade_rename_organization', 'ocade_delete_organization',
       'ocade_record_organization_event'
     )
     AND NOT p.prosecdef;
  IF invoker IS NOT NULL THEN
    RAISE EXCEPTION 'these organization functions are not SECURITY DEFINER: %', invoker;
  END IF;
END $$;

-- The audit writer is callable only from the functions in this file.
DO $$
BEGIN
  IF has_function_privilege(
       'authenticated',
       'public.ocade_record_organization_event(uuid, text, uuid, jsonb)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can forge organization history';
  END IF;
END $$;

-- An invitation is never both accepted and revoked, and its token is a hash.
DO $$
DECLARE
  found integer;
BEGIN
  SELECT count(*) INTO found
    FROM pg_constraint
   WHERE conrelid = 'public.ocade_organization_invites'::regclass
     AND conname IN (
       'ocade_organization_invites_settled',
       'ocade_organization_invites_token',
       'ocade_organization_invites_token_key'
     );
  IF found <> 3 THEN
    RAISE EXCEPTION 'invitation integrity constraints are missing (found %)', found;
  END IF;
END $$;
