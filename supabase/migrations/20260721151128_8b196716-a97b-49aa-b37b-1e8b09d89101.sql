
-- ================= ENUMS =================
CREATE TYPE public.worker_type AS ENUM ('employee','contractor','advisor','auditor','consultant');
CREATE TYPE public.employment_status AS ENUM ('invited','active','suspended','terminated');
CREATE TYPE public.approval_subject AS ENUM ('expense','invoice','payroll','tax','files','payments','signatures','export');
CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','released','withdrawn');
CREATE TYPE public.approval_decision AS ENUM ('approve','reject');

-- ================= HELPER =================
-- Manager check reusing existing helper
CREATE OR REPLACE FUNCTION public.is_tenant_owner_or_manager(_tenant uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant AND user_id = _uid AND role IN ('owner','manager')
  );
$$;
REVOKE ALL ON FUNCTION public.is_tenant_owner_or_manager(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner_or_manager(uuid, uuid) TO authenticated, service_role;

-- Updated-at util (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

-- ================= LOCATIONS =================
CREATE TABLE public.ficia_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  country text,
  region text,
  city text,
  address text,
  timezone text,
  is_headquarters boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficia_locations TO authenticated;
GRANT ALL ON public.ficia_locations TO service_role;
ALTER TABLE public.ficia_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY loc_sel ON public.ficia_locations FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), 'employee'::tenant_role)
      OR public.has_tenant_role(tenant_id, auth.uid(), 'owner'::tenant_role)
      OR public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE POLICY loc_mut ON public.ficia_locations FOR ALL TO authenticated
  USING (public.is_tenant_owner_or_manager(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE TRIGGER loc_touch BEFORE UPDATE ON public.ficia_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= DEPARTMENTS =================
CREATE TABLE public.ficia_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.ficia_departments(id) ON DELETE SET NULL,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficia_departments TO authenticated;
GRANT ALL ON public.ficia_departments TO service_role;
ALTER TABLE public.ficia_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY dep_sel ON public.ficia_departments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=ficia_departments.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY dep_mut ON public.ficia_departments FOR ALL TO authenticated
  USING (public.is_tenant_owner_or_manager(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE TRIGGER dep_touch BEFORE UPDATE ON public.ficia_departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= TEAMS =================
CREATE TABLE public.ficia_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.ficia_departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficia_teams TO authenticated;
GRANT ALL ON public.ficia_teams TO service_role;
ALTER TABLE public.ficia_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_sel ON public.ficia_teams FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=ficia_teams.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY team_mut ON public.ficia_teams FOR ALL TO authenticated
  USING (public.is_tenant_owner_or_manager(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE TRIGGER team_touch BEFORE UPDATE ON public.ficia_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= EMPLOYMENTS =================
CREATE TABLE public.ficia_employments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email text,
  worker_type public.worker_type NOT NULL DEFAULT 'employee',
  status public.employment_status NOT NULL DEFAULT 'invited',
  title text,
  department_id uuid REFERENCES public.ficia_departments(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.ficia_teams(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.ficia_locations(id) ON DELETE SET NULL,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  suspended_reason text,
  terminated_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id),
  CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);
CREATE INDEX emp_tenant_status_idx ON public.ficia_employments(tenant_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficia_employments TO authenticated;
GRANT ALL ON public.ficia_employments TO service_role;
ALTER TABLE public.ficia_employments ENABLE ROW LEVEL SECURITY;
CREATE POLICY emp_sel_member ON public.ficia_employments FOR SELECT TO authenticated
  USING (user_id = auth.uid()
      OR public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE POLICY emp_mut ON public.ficia_employments FOR ALL TO authenticated
  USING (public.is_tenant_owner_or_manager(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE TRIGGER emp_touch BEFORE UPDATE ON public.ficia_employments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= CUSTOM ROLES =================
CREATE TABLE public.ficia_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  base_role public.tenant_role,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
CREATE UNIQUE INDEX role_template_key_idx ON public.ficia_custom_roles(key) WHERE tenant_id IS NULL AND is_template;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficia_custom_roles TO authenticated;
GRANT ALL ON public.ficia_custom_roles TO service_role;
ALTER TABLE public.ficia_custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_sel ON public.ficia_custom_roles FOR SELECT TO authenticated
  USING (tenant_id IS NULL
      OR EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=ficia_custom_roles.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY role_mut ON public.ficia_custom_roles FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_owner_or_manager(tenant_id, auth.uid()))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE TRIGGER role_touch BEFORE UPDATE ON public.ficia_custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= ROLE GRANTS =================
CREATE TABLE public.ficia_role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  UNIQUE (tenant_id, user_id, role_key)
);
CREATE INDEX rg_lookup_idx ON public.ficia_role_grants(tenant_id, user_id) WHERE revoked_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficia_role_grants TO authenticated;
GRANT ALL ON public.ficia_role_grants TO service_role;
ALTER TABLE public.ficia_role_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY rg_sel ON public.ficia_role_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid()
      OR public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE POLICY rg_mut ON public.ficia_role_grants FOR ALL TO authenticated
  USING (public.is_tenant_owner_or_manager(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_owner_or_manager(tenant_id, auth.uid()));

-- ================= APPROVAL POLICIES =================
CREATE TABLE public.ficia_approval_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject public.approval_subject NOT NULL,
  currency text,
  min_amount numeric(18,2),
  max_amount numeric(18,2),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{role_key, min_approvals}]
  sod_enforced boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficia_approval_policies TO authenticated;
GRANT ALL ON public.ficia_approval_policies TO service_role;
ALTER TABLE public.ficia_approval_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY ap_sel ON public.ficia_approval_policies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=ficia_approval_policies.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY ap_mut ON public.ficia_approval_policies FOR ALL TO authenticated
  USING (public.is_tenant_owner_or_manager(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_owner_or_manager(tenant_id, auth.uid()));
CREATE TRIGGER ap_touch BEFORE UPDATE ON public.ficia_approval_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= APPROVAL REQUESTS =================
CREATE TABLE public.ficia_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.ficia_approval_policies(id) ON DELETE SET NULL,
  subject public.approval_subject NOT NULL,
  title text NOT NULL,
  amount numeric(18,2),
  currency text,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at timestamptz,
  status public.approval_status NOT NULL DEFAULT 'pending',
  current_step int NOT NULL DEFAULT 0,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb, -- snapshotted at submission
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sod_override_reason text,
  sod_override_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sod_override_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ar_tenant_status_idx ON public.ficia_approval_requests(tenant_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficia_approval_requests TO authenticated;
GRANT ALL ON public.ficia_approval_requests TO service_role;
ALTER TABLE public.ficia_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ar_sel ON public.ficia_approval_requests FOR SELECT TO authenticated
  USING (submitted_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=ficia_approval_requests.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY ar_ins ON public.ficia_approval_requests FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid()
      AND EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=ficia_approval_requests.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY ar_upd ON public.ficia_approval_requests FOR UPDATE TO authenticated
  USING (public.is_tenant_owner_or_manager(tenant_id, auth.uid())
      OR submitted_by = auth.uid())
  WITH CHECK (public.is_tenant_owner_or_manager(tenant_id, auth.uid())
      OR submitted_by = auth.uid());
CREATE TRIGGER ar_touch BEFORE UPDATE ON public.ficia_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= APPROVAL DECISIONS =================
CREATE TABLE public.ficia_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ficia_approval_requests(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step int NOT NULL,
  approver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision public.approval_decision NOT NULL,
  reason text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, step, approver_user_id)
);
GRANT SELECT, INSERT ON public.ficia_approval_decisions TO authenticated;
GRANT ALL ON public.ficia_approval_decisions TO service_role;
ALTER TABLE public.ficia_approval_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_sel ON public.ficia_approval_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=ficia_approval_decisions.tenant_id AND m.user_id=auth.uid()));
-- Inserts are performed by server functions only; deny direct client insert.
CREATE POLICY ad_ins_deny ON public.ficia_approval_decisions FOR INSERT TO authenticated
  WITH CHECK (false);

-- ================= SUSPENSION -> tenant_members propagation =================
CREATE OR REPLACE FUNCTION public.ficia_sync_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('suspended','terminated') THEN
    -- Never remove the last owner
    IF EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND role='owner') THEN
      IF (SELECT count(*) FROM public.tenant_members WHERE tenant_id=NEW.tenant_id AND role='owner') <= 1 THEN
        RAISE EXCEPTION 'cannot_suspend_last_owner';
      END IF;
    END IF;
    DELETE FROM public.tenant_members WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id;
    DELETE FROM public.ocade_conversations WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id; -- optional; keep messages? keep.
    UPDATE public.ficia_role_grants SET revoked_at=now(), revoked_by=NEW.created_by
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND revoked_at IS NULL;
  ELSIF NEW.status = 'active' THEN
    INSERT INTO public.tenant_members(tenant_id, user_id, role)
    VALUES (NEW.tenant_id, NEW.user_id, 'employee')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
-- (removed the ocade delete on second thought — keep chats hidden by RLS instead)
CREATE OR REPLACE FUNCTION public.ficia_sync_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IN ('suspended','terminated') THEN
    IF EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND role='owner')
       AND (SELECT count(*) FROM public.tenant_members WHERE tenant_id=NEW.tenant_id AND role='owner') <= 1 THEN
      RAISE EXCEPTION 'cannot_suspend_last_owner';
    END IF;
    DELETE FROM public.tenant_members WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id;
    UPDATE public.ficia_role_grants SET revoked_at=now(), revoked_by=NEW.created_by
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND revoked_at IS NULL;
  ELSIF NEW.status = 'active' THEN
    INSERT INTO public.tenant_members(tenant_id, user_id, role)
    VALUES (NEW.tenant_id, NEW.user_id, 'employee')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER emp_sync_membership AFTER INSERT OR UPDATE OF status, user_id
ON public.ficia_employments FOR EACH ROW EXECUTE FUNCTION public.ficia_sync_membership();

-- ================= PERMISSION LOOKUP =================
-- Union permission map across active role grants (custom + template) + owner=all.
CREATE OR REPLACE FUNCTION public.ficia_has_permission(_tenant uuid, _uid uuid, _perm text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ok boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id=_tenant AND user_id=_uid AND role='owner') THEN
    RETURN true;
  END IF;
  SELECT bool_or(coalesce((r.permissions->>_perm)::boolean, false))
    INTO ok
    FROM public.ficia_role_grants g
    JOIN public.ficia_custom_roles r
      ON r.key = g.role_key AND (r.tenant_id = g.tenant_id OR (r.tenant_id IS NULL AND r.is_template))
   WHERE g.tenant_id=_tenant AND g.user_id=_uid AND g.revoked_at IS NULL;
  RETURN coalesce(ok, false);
END; $$;
REVOKE ALL ON FUNCTION public.ficia_has_permission(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ficia_has_permission(uuid, uuid, text) TO authenticated, service_role;

-- ================= ROLE TEMPLATES SEED =================
INSERT INTO public.ficia_custom_roles (tenant_id, key, name, description, base_role, permissions, is_template) VALUES
 (NULL,'owner','Owner','Full company control',           'owner',    '{"*":true}',                                          true),
 (NULL,'ceo','CEO','Chief executive; strategic + approvals','manager','{"ficia.*.view":true,"ficia.expense.approve":true,"ficia.invoice.approve":true,"ficia.payroll.approve":true,"ficia.tax.approve":true,"ficia.payments.approve":true,"ficia.signatures.approve":true,"ficia.export.approve":true}', true),
 (NULL,'ca','Chartered Accountant','Regulated CA sign-offs','accountant','{"ficia.tax.view":true,"ficia.tax.prepare":true,"ficia.tax.approve":true,"ficia.invoice.view":true,"ficia.invoice.approve":true,"ficia.export.approve":true}', true),
 (NULL,'cma','Cost & Management Accountant','Costing & management reports','accountant','{"ficia.reports.view":true,"ficia.expense.view":true,"ficia.expense.approve":true,"ficia.export.approve":true}', true),
 (NULL,'accountant','Accountant','Books, ledgers, day-to-day accounting','accountant','{"ficia.invoice.view":true,"ficia.invoice.create":true,"ficia.expense.view":true,"ficia.expense.create":true,"ficia.reports.view":true}', true),
 (NULL,'payroll','Payroll Officer','Prepare & release payroll',            'employee','{"ficia.payroll.view":true,"ficia.payroll.prepare":true,"ficia.payroll.release":true}', true),
 (NULL,'hr','HR Manager','People, employments, roles',                     'manager','{"ficia.people.view":true,"ficia.people.manage":true,"ficia.roles.manage":true}', true),
 (NULL,'tax','Tax Preparer','Prepare tax filings',                          'employee','{"ficia.tax.view":true,"ficia.tax.prepare":true}', true),
 (NULL,'auditor','Auditor','Read-only auditor access',                      'auditor','{"ficia.reports.view":true,"ficia.invoice.view":true,"ficia.expense.view":true,"ficia.audit.view":true}', true),
 (NULL,'finance','Finance Manager','Finance oversight',                     'manager','{"ficia.reports.view":true,"ficia.invoice.approve":true,"ficia.expense.approve":true,"ficia.payments.approve":true}', true),
 (NULL,'treasury','Treasury','Bank + payment release',                      'employee','{"ficia.payments.view":true,"ficia.payments.release":true}', true),
 (NULL,'procurement','Procurement','Vendor & purchase',                     'employee','{"ficia.invoice.view":true,"ficia.invoice.create":true,"ficia.expense.create":true}', true),
 (NULL,'manager','Manager','Team lead',                                     'manager','{"ficia.people.view":true,"ficia.expense.approve":true,"ficia.files.approve":true}', true),
 (NULL,'employee','Employee','Standard employee',                           'employee','{"ficia.expense.create":true,"ficia.files.view":true}', true),
 (NULL,'consultant','Consultant','External consultant',                     'consultant','{"ficia.files.view":true}', true),
 (NULL,'advisor','Advisor','External advisor',                              'advisor','{"ficia.reports.view":true,"ficia.files.view":true}', true);

-- ================= SEED OWNER EMPLOYMENTS + OWNER GRANTS FOR EXISTING MEMBERS =================
INSERT INTO public.ficia_employments (tenant_id, user_id, worker_type, status, title, created_by)
SELECT m.tenant_id, m.user_id, 'employee'::public.worker_type, 'active'::public.employment_status,
       CASE WHEN m.role='owner' THEN 'Owner' ELSE 'Member' END, m.user_id
  FROM public.tenant_members m
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO public.ficia_role_grants (tenant_id, user_id, role_key, granted_by)
SELECT m.tenant_id, m.user_id, CASE WHEN m.role='owner' THEN 'owner' ELSE m.role::text END, m.user_id
  FROM public.tenant_members m
ON CONFLICT (tenant_id, user_id, role_key) DO NOTHING;
