-- No table policy grants access by the broad admin role any more.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE coalesce(qual, '') ~ 'has_role' OR coalesce(with_check, '') ~ 'has_role') THEN
    RAISE EXCEPTION 'a table policy still grants access by has_role';
  END IF;
END
$$;
