-- Apply the two high-impact, behavior-preserving recommendations from the live
-- Supabase performance advisor:
--   1. cache auth helper values once per statement in every RLS policy;
--   2. index every foreign-key column tuple that has no covering index.

BEGIN;

-- devices and browser_grants already grant authenticated UPDATE and enforce
-- auth.uid() ownership through RLS. Invoker rights preserve the atomic RPC while
-- removing an unnecessary privilege bypass.
ALTER FUNCTION public.revoke_device_for_current_user(UUID) SECURITY INVOKER;

DO $$
DECLARE
  policy_row RECORD;
  optimized_qual TEXT;
  optimized_check TEXT;
BEGIN
  FOR policy_row IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname AS policy_name,
      pg_get_expr(p.polqual, p.polrelid) AS using_sql,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_sql
    FROM pg_policy AS p
    JOIN pg_class AS c ON c.oid = p.polrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'storage')
      AND (
        COALESCE(pg_get_expr(p.polqual, p.polrelid), '') ~ 'auth\.(uid|role|jwt)\(\)'
        OR COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ 'auth\.(uid|role|jwt)\(\)'
      )
  LOOP
    -- Existing SELECT wrappers may become a harmless nested scalar SELECT. This
    -- keeps the transform deterministic while ensuring no per-row auth helper
    -- invocation remains.
    optimized_qual := replace(
      replace(
        replace(policy_row.using_sql, 'auth.uid()', '(select auth.uid())'),
        'auth.role()', '(select auth.role())'
      ),
      'auth.jwt()', '(select auth.jwt())'
    );
    optimized_check := replace(
      replace(
        replace(policy_row.check_sql, 'auth.uid()', '(select auth.uid())'),
        'auth.role()', '(select auth.role())'
      ),
      'auth.jwt()', '(select auth.jwt())'
    );

    IF policy_row.using_sql IS NOT NULL AND policy_row.check_sql IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
        policy_row.policy_name,
        policy_row.schema_name,
        policy_row.table_name,
        optimized_qual,
        optimized_check
      );
    ELSIF policy_row.using_sql IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        policy_row.policy_name,
        policy_row.schema_name,
        policy_row.table_name,
        optimized_qual
      );
    ELSE
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        policy_row.policy_name,
        policy_row.schema_name,
        policy_row.table_name,
        optimized_check
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  foreign_key RECORD;
  index_name TEXT;
BEGIN
  FOR foreign_key IN
    SELECT
      constraint_row.conname,
      constraint_row.conrelid,
      constraint_row.conkey,
      namespace_row.nspname AS schema_name,
      table_row.relname AS table_name,
      (
        SELECT string_agg(quote_ident(attribute_row.attname), ', ' ORDER BY key_row.ordinality)
        FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_row(attnum, ordinality)
        JOIN pg_attribute AS attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
      ) AS columns_sql
    FROM pg_constraint AS constraint_row
    JOIN pg_class AS table_row ON table_row.oid = constraint_row.conrelid
    JOIN pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
    WHERE constraint_row.contype = 'f'
      AND namespace_row.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index AS index_row
        WHERE index_row.indrelid = constraint_row.conrelid
          AND index_row.indisvalid
          AND (
            SELECT array_agg(index_key.attnum ORDER BY index_key.ordinality)
            FROM unnest(index_row.indkey::smallint[]) WITH ORDINALITY
              AS index_key(attnum, ordinality)
            WHERE index_key.ordinality <= cardinality(constraint_row.conkey)
          ) = constraint_row.conkey
      )
  LOOP
    index_name :=
      left(foreign_key.conname, 46)
      || '_'
      || substr(md5(foreign_key.conrelid::text || foreign_key.conname), 1, 10)
      || '_idx';

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      index_name,
      foreign_key.schema_name,
      foreign_key.table_name,
      foreign_key.columns_sql
    );
  END LOOP;
END;
$$;

COMMIT;
