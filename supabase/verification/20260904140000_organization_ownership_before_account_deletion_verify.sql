-- Verification for 20260904140000_organization_ownership_before_account_deletion.

-- Provenance no longer traps an account.
DO $$
DECLARE
  rule text;
BEGIN
  IF (
    SELECT attnotnull FROM pg_attribute
     WHERE attrelid = 'public.ocade_organizations'::regclass AND attname = 'created_by'
  ) THEN
    RAISE EXCEPTION 'ocade_organizations.created_by is still NOT NULL';
  END IF;

  SELECT confdeltype INTO rule
    FROM pg_constraint
   WHERE conrelid = 'public.ocade_organizations'::regclass
     AND conname = 'ocade_organizations_created_by_fkey';
  IF rule IS NULL THEN
    RAISE EXCEPTION 'the created_by foreign key is missing';
  END IF;
  -- 'n' is SET NULL. 'r' (RESTRICT) is the defect this migration removed: it
  -- refuses at the very last step of account deletion, after everything else
  -- has already been destroyed.
  IF rule <> 'n' THEN
    RAISE EXCEPTION 'created_by deletes with rule % rather than SET NULL', rule;
  END IF;
END $$;

-- The invariant is enforced on every path, including a cascade.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.ocade_organization_members'::regclass
       AND tgname = 'ocade_organization_members_keep_an_owner'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'nothing stops a cascade from removing the last active owner';
  END IF;
END $$;

-- The warning a person reads before pressing the button.
DO $$
BEGIN
  IF to_regprocedure('public.ocade_my_organizations_blocking_deletion()') IS NULL THEN
    RAISE EXCEPTION 'the account-deletion warning function is missing';
  END IF;
  IF NOT has_function_privilege(
       'authenticated', 'public.ocade_my_organizations_blocking_deletion()', 'EXECUTE') THEN
    RAISE EXCEPTION 'the screen cannot ask what is blocking deletion';
  END IF;
  -- The id-taking form is for the server, which has no JWT during deletion.
  IF has_function_privilege(
       'authenticated', 'public.ocade_organizations_blocking_deletion(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'a browser can ask this question about somebody else';
  END IF;
END $$;
