-- Prove no browser role can write roles, truncate, or open a retired surface.
DO $$
DECLARE
  _table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND tablename = 'user_roles' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'user_roles still has a write policy';
  END IF;
  IF has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_roles', 'DELETE') THEN
    RAISE EXCEPTION 'a signed-in browser can still write user_roles';
  END IF;
  FOR _table IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND c.relkind = 'r' LOOP
    IF has_table_privilege('authenticated', format('public.%I', _table), 'TRUNCATE')
       OR has_table_privilege('anon', format('public.%I', _table), 'TRUNCATE') THEN
      RAISE EXCEPTION 'a browser role can TRUNCATE public.%', _table;
    END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.ocade_entitlement_grants', 'INSERT') THEN
    RAISE EXCEPTION 'a signed-in browser can insert an entitlement grant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                  WHERE c.relname = 'ocade_entitlement_grants_revoked_by_idx') THEN
    RAISE EXCEPTION 'revoked_by is not indexed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'ocade_generation_permits_surface_check'
                    AND pg_get_constraintdef(oid) LIKE '%''chat''%'
                    AND pg_get_constraintdef(oid) NOT LIKE '%cowork%') THEN
    RAISE EXCEPTION 'permits still accept a retired surface';
  END IF;
END $$;
