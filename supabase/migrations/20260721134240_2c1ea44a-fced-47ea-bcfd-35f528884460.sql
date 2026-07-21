
-- user_roles: admin-only writes
CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- feature_flags: restrict read to enabled flags for regular users
DROP POLICY IF EXISTS "feature_flags_all_read" ON public.feature_flags;

CREATE POLICY "feature_flags_enabled_read" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'::app_role));
