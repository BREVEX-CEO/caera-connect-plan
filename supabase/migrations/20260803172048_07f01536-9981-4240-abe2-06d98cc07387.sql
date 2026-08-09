DROP POLICY IF EXISTS grants_update ON public.msg_cross_company_grants;
CREATE POLICY grants_update ON public.msg_cross_company_grants
FOR UPDATE TO authenticated
USING (
  public.has_tenant_role(from_tenant_id, auth.uid(), 'owner'::tenant_role)
  OR public.has_tenant_role(from_tenant_id, auth.uid(), 'manager'::tenant_role)
  OR public.has_tenant_role(to_tenant_id, auth.uid(), 'owner'::tenant_role)
  OR public.has_tenant_role(to_tenant_id, auth.uid(), 'manager'::tenant_role)
)
WITH CHECK (
  public.has_tenant_role(from_tenant_id, auth.uid(), 'owner'::tenant_role)
  OR public.has_tenant_role(from_tenant_id, auth.uid(), 'manager'::tenant_role)
  OR public.has_tenant_role(to_tenant_id, auth.uid(), 'owner'::tenant_role)
  OR public.has_tenant_role(to_tenant_id, auth.uid(), 'manager'::tenant_role)
);

ALTER TABLE public.msg_messages REPLICA IDENTITY FULL;
ALTER TABLE public.msg_threads REPLICA IDENTITY FULL;

-- Realtime publication membership, guarded on the publication existing.
--
-- DEFECT DB-02, found the moment DB-01 stopped hiding it.
--
-- `supabase_realtime` is created by the Supabase platform's own bootstrap, not
-- by any migration in this repository. On the hosted project it exists and
-- these two statements behave exactly as written. On bare PostgreSQL — a
-- from-scratch rebuild, or the PGlite twin the tests run against — it does not,
-- and the migration aborted with `publication "supabase_realtime" does not
-- exist`, taking the last migration in the set with it.
--
-- This was invisible for as long as DB-01 stood: the twin stops applying at the
-- first failure, so the run never reached this file. Fixing one defect is what
-- exposed the next, which is the argument for not carrying known-failure
-- exceptions in a migration suite.
--
-- Guarded rather than removed. Adding a table to a publication it already
-- belongs to is an error too, so membership is checked as well — that makes
-- this migration re-runnable, which an `ALTER PUBLICATION … ADD TABLE` is not.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'msg_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.msg_messages;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'msg_threads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.msg_threads;
    END IF;
  END IF;
END
$$;