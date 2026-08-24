-- Assert that authenticated users have at most one permissive policy for each
-- table and command after consolidation.
DO $$
DECLARE
  duplicate_groups INTEGER;
BEGIN
  SELECT count(*)
  INTO duplicate_groups
  FROM (
    SELECT p.polrelid, p.polcmd
    FROM pg_catalog.pg_policy AS p
    JOIN pg_catalog.pg_class AS c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.polpermissive
      AND ('authenticated'::regrole::oid = ANY(p.polroles) OR 0 = ANY(p.polroles))
    GROUP BY p.polrelid, p.polcmd
    HAVING count(*) > 1
  ) AS duplicate_policy_groups;

  IF duplicate_groups <> 0 THEN
    RAISE EXCEPTION 'Permissive RLS consolidation verification failed: % duplicate groups.', duplicate_groups;
  END IF;
END;
$$;
