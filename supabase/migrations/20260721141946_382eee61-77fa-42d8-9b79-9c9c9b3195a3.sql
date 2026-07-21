
-- Enums
CREATE TYPE public.launch_gate_status AS ENUM (
  'not_started','in_progress','pending_review','evidence_required','complete','waived'
);

CREATE TYPE public.feature_flag_stage AS ENUM (
  'demo','private_alpha','beta','ga'
);

-- Launch gate items
CREATE TABLE public.launch_gate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  status public.launch_gate_status NOT NULL DEFAULT 'not_started',
  owner text,
  reviewer text,
  evidence_url text,
  applicable_modules text[] NOT NULL DEFAULT '{}',
  due_date date,
  blocker boolean NOT NULL DEFAULT true,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.launch_gate_items TO authenticated;
GRANT ALL ON public.launch_gate_items TO service_role;
ALTER TABLE public.launch_gate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "launch_gate_items_admin_read" ON public.launch_gate_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "launch_gate_items_admin_write" ON public.launch_gate_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER launch_gate_items_set_updated_at
  BEFORE UPDATE ON public.launch_gate_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Append-only history
CREATE TABLE public.launch_gate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.launch_gate_items(id) ON DELETE CASCADE,
  from_status public.launch_gate_status,
  to_status public.launch_gate_status NOT NULL,
  evidence_url text,
  note text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.launch_gate_history TO authenticated;
GRANT ALL ON public.launch_gate_history TO service_role;
ALTER TABLE public.launch_gate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "launch_gate_history_admin_read" ON public.launch_gate_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No write policy: only service_role (server function) may insert.

CREATE INDEX launch_gate_history_item_idx ON public.launch_gate_history(item_id, changed_at DESC);

-- Feature flag stage
ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS stage public.feature_flag_stage NOT NULL DEFAULT 'demo',
  ADD COLUMN IF NOT EXISTS applicable_modules text[] NOT NULL DEFAULT '{}';

-- Guard: refuse GA when required blockers are unresolved for applicable modules
CREATE OR REPLACE FUNCTION public.enforce_ga_launch_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_count int;
BEGIN
  IF NEW.stage = 'ga' AND NEW.enabled = true THEN
    SELECT COUNT(*) INTO open_count
    FROM public.launch_gate_items i
    WHERE i.blocker = true
      AND i.status <> 'complete'
      AND i.status <> 'waived'
      AND (
        cardinality(NEW.applicable_modules) = 0
        OR i.applicable_modules && NEW.applicable_modules
        OR cardinality(i.applicable_modules) = 0
      );
    IF open_count > 0 THEN
      RAISE EXCEPTION 'Feature flag % cannot go GA: % launch-gate blocker(s) unresolved.', NEW.id, open_count
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_ga_launch_gate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS feature_flags_enforce_ga ON public.feature_flags;
CREATE TRIGGER feature_flags_enforce_ga
  BEFORE INSERT OR UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ga_launch_gate();

-- Seed the 23 required items (all pending)
INSERT INTO public.launch_gate_items (key, category, title, description, blocker) VALUES
  ('terms_of_service', 'Legal', 'Terms of Service', 'Public ToS reviewed by counsel and published.', true),
  ('privacy_policy', 'Legal', 'Privacy Policy', 'Public privacy policy covering all data classes.', true),
  ('cookie_policy', 'Legal', 'Cookie Policy', 'Cookie disclosures and consent UI.', true),
  ('acceptable_use_policy', 'Legal', 'Acceptable Use Policy', 'Publicly linked AUP with enforcement path.', true),
  ('dpa', 'Legal', 'Data Processing Addendum', 'DPA available for tenants processing personal data.', true),
  ('provider_disclosure', 'Transparency', 'Provider disclosure & consent', 'Users can see and consent to AI providers used.', true),
  ('cross_border_transfer', 'Legal', 'Cross-border transfer notice', 'Clear notice of data locations and transfer basis.', true),
  ('employee_monitoring_consent', 'Legal', 'Employee monitoring consent', 'Timesheet / activity capture requires explicit consent.', true),
  ('retention_policy', 'Data', 'Retention policy', 'Documented retention windows per data class.', true),
  ('user_tenant_export', 'Data', 'User and tenant data export', 'Working export flow for accounts and tenants.', true),
  ('account_tenant_deletion', 'Data', 'Account and tenant deletion', 'Working deletion flow with verified erasure.', true),
  ('professional_review_boundaries', 'Compliance', 'Professional-review boundaries', 'Clear scope where a licensed professional must sign off.', true),
  ('supported_jurisdictions', 'Compliance', 'Supported jurisdiction list', 'Published list of jurisdictions with country packs.', true),
  ('secret_management', 'Security', 'Secret management', 'Server-only secrets, no credentials in client bundles.', true),
  ('key_rotation', 'Security', 'Key rotation', 'Documented and drilled rotation of signing/API keys.', true),
  ('sbom', 'Security', 'Software bill of materials', 'Generated SBOM tracked for each release.', true),
  ('incident_response', 'Security', 'Incident response', 'Runbook, on-call and user-notification path defined.', true),
  ('vulnerability_reporting', 'Security', 'Vulnerability reporting', 'Public security.txt and intake for reports.', true),
  ('backups', 'Operations', 'Backups', 'Automated backups with retention and offsite copy.', true),
  ('restoration_drills', 'Operations', 'Restoration drills', 'Restore-from-backup drill executed and logged.', true),
  ('status_degraded_mode', 'Operations', 'Status / degraded-mode behaviour', 'Documented degraded behaviour and user messaging.', true),
  ('monitoring_slos', 'Operations', 'Monitoring & service targets', 'SLOs and alerting defined for user-facing services.', true),
  ('external_security_review', 'Security', 'External security review', 'Independent security review completed.', true);
