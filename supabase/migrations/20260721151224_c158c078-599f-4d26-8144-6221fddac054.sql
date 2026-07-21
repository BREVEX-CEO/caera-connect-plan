
REVOKE ALL ON FUNCTION public.is_tenant_owner_or_manager(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ficia_has_permission(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner_or_manager(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ficia_has_permission(uuid, uuid, text) TO authenticated, service_role;
