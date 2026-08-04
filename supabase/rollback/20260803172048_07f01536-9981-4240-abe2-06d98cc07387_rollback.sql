-- Restore the previous cross-company grant policy and remove messenger realtime configuration.
BEGIN;
DROP POLICY IF EXISTS grants_update
ON public.msg_cross_company_grants;

CREATE POLICY grants_update
ON public.msg_cross_company_grants
FOR UPDATE TO authenticated
USING (
  public.has_tenant_role(from_tenant_id, auth.uid(), 'owner')
  OR public.has_tenant_role(from_tenant_id, auth.uid(), 'manager')
  OR public.has_tenant_role(to_tenant_id, auth.uid(), 'owner')
  OR public.has_tenant_role(to_tenant_id, auth.uid(), 'manager')
)
WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'msg_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP ' ||
            'TABLE public.msg_messages';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'msg_threads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP ' ||
            'TABLE public.msg_threads';
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.msg_messages
REPLICA IDENTITY DEFAULT;

ALTER TABLE IF EXISTS public.msg_threads
REPLICA IDENTITY DEFAULT;
COMMIT;