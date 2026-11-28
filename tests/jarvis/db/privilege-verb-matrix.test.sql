-- DB-01: every public table, every write verb, every client role. anon writes nothing; a client role that
-- can write a table has row-level security on and a policy for that exact verb that is not unconditional.
-- Disposable DB only.
\set ON_ERROR_STOP on
DO $$
DECLARE r record; bad text := '';
BEGIN
  FOR r IN
    SELECT c.relname, v.verb, g.role,
           has_table_privilege(g.role, c.oid, v.verb) AS granted,
           c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) v(verb)
      CROSS JOIN (VALUES ('anon'), ('authenticated')) g(role)
     WHERE c.relkind IN ('r', 'p')
  LOOP
    CONTINUE WHEN NOT r.granted;
    IF r.role = 'anon' THEN
      bad := bad || format('anon can %s public.%s; ', r.verb, r.relname);
    ELSIF NOT r.rls THEN
      bad := bad || format('authenticated can %s public.%s without row-level security; ', r.verb, r.relname);
    ELSIF NOT EXISTS (
        SELECT 1 FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = r.relname
           AND p.cmd IN (r.verb, 'ALL')
           AND ('authenticated' = ANY (p.roles) OR 'public' = ANY (p.roles))
           AND coalesce(nullif(btrim(p.qual), 'true'), nullif(btrim(p.with_check), 'true')) IS NOT NULL) THEN
      bad := bad || format('authenticated can %s public.%s with no conditional policy for that verb; ', r.verb, r.relname);
    END IF;
  END LOOP;
  IF bad <> '' THEN RAISE EXCEPTION 'privilege matrix: %', bad; END IF;
END $$;
