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
ALTER PUBLICATION supabase_realtime ADD TABLE public.msg_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.msg_threads;