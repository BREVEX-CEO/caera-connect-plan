-- OCADE-IRREVERSIBLE: removing the authenticated EXECUTE grant on
-- public.has_role(uuid, public.app_role) breaks every RLS policy that calls it,
-- so ordinary signed-in reads would fail with permission denied. There is no
-- safe undo; restore prior behaviour with a reviewed forward migration if the
-- privilege model must change.
DO $$
BEGIN
  RAISE NOTICE 'has_role authenticated EXECUTE privilege retained; use a forward migration to change it.';
END;
$$;
