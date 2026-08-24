-- Consolidate overlapping permissive policies into one policy per operation.
-- PostgreSQL ORs permissive policies, so the generated OR expressions preserve
-- the exact signed-in access semantics while avoiding repeated policy plans.
-- Anonymous table grants were removed by the preceding hardening migration;
-- normalizing legacy TO PUBLIC policies to TO authenticated is strictly tighter.

BEGIN;

DO $$
DECLARE
  table_name TEXT;
  authenticated_oid OID := 'authenticated'::regrole::oid;
  select_using TEXT;
  insert_check TEXT;
  update_using TEXT;
  update_check TEXT;
  delete_using TEXT;
  policy_row RECORD;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'access_requests',
    'activity_log',
    'company_obligations',
    'compliance_events',
    'country_pack_versions',
    'country_packs',
    'feature_flags',
    'ficia_approval_policies',
    'ficia_custom_roles',
    'ficia_departments',
    'ficia_employments',
    'ficia_locations',
    'ficia_role_grants',
    'ficia_teams',
    'historical_test_cases',
    'launch_gate_items',
    'ocade_support_messages',
    'ocade_support_tickets',
    'pack_reviews',
    'profiles',
    'rule_sources',
    'user_roles'
  ]
  LOOP
    SELECT
      string_agg(
        '(' || COALESCE(pg_get_expr(p.polqual, p.polrelid), 'true') || ')',
        ' OR ' ORDER BY p.polname
      ) FILTER (WHERE p.polcmd IN ('*', 'r')),
      string_agg(
        '(' || COALESCE(
          pg_get_expr(p.polwithcheck, p.polrelid),
          pg_get_expr(p.polqual, p.polrelid),
          'true'
        ) || ')',
        ' OR ' ORDER BY p.polname
      ) FILTER (WHERE p.polcmd IN ('*', 'a')),
      string_agg(
        '(' || COALESCE(pg_get_expr(p.polqual, p.polrelid), 'true') || ')',
        ' OR ' ORDER BY p.polname
      ) FILTER (WHERE p.polcmd IN ('*', 'w')),
      string_agg(
        '(' || COALESCE(
          pg_get_expr(p.polwithcheck, p.polrelid),
          pg_get_expr(p.polqual, p.polrelid),
          'true'
        ) || ')',
        ' OR ' ORDER BY p.polname
      ) FILTER (WHERE p.polcmd IN ('*', 'w')),
      string_agg(
        '(' || COALESCE(pg_get_expr(p.polqual, p.polrelid), 'true') || ')',
        ' OR ' ORDER BY p.polname
      ) FILTER (WHERE p.polcmd IN ('*', 'd'))
    INTO select_using, insert_check, update_using, update_check, delete_using
    FROM pg_policy AS p
    JOIN pg_class AS c ON c.oid = p.polrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = table_name
      AND p.polpermissive
      AND (0 = ANY(p.polroles) OR authenticated_oid = ANY(p.polroles));

    FOR policy_row IN
      SELECT p.polname
      FROM pg_policy AS p
      JOIN pg_class AS c ON c.oid = p.polrelid
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = table_name
        AND p.polpermissive
        AND (0 = ANY(p.polroles) OR authenticated_oid = ANY(p.polroles))
    LOOP
      EXECUTE format(
        'DROP POLICY %I ON public.%I',
        policy_row.polname,
        table_name
      );
    END LOOP;

    IF select_using IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY ocade_consolidated_select ON public.%I FOR SELECT TO authenticated USING (%s)',
        table_name,
        select_using
      );
    END IF;
    IF insert_check IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY ocade_consolidated_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
        table_name,
        insert_check
      );
    END IF;
    IF update_using IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY ocade_consolidated_update ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
        table_name,
        update_using,
        update_check
      );
    END IF;
    IF delete_using IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY ocade_consolidated_delete ON public.%I FOR DELETE TO authenticated USING (%s)',
        table_name,
        delete_using
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;
