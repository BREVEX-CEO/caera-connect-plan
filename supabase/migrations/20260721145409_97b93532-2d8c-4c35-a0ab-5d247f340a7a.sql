
-- Country Pack system

CREATE TABLE public.country_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  name text NOT NULL,
  jurisdiction_level text NOT NULL DEFAULT 'national',
  status text NOT NULL DEFAULT 'planned',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT country_packs_status_ck CHECK (status IN ('planned','draft','in_review','pilot','ga','deprecated'))
);
GRANT SELECT ON public.country_packs TO authenticated;
GRANT ALL ON public.country_packs TO service_role;
ALTER TABLE public.country_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read country_packs" ON public.country_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write country_packs" ON public.country_packs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.country_pack_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.country_packs(id) ON DELETE CASCADE,
  version text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  jurisdiction text NOT NULL DEFAULT 'national',
  business_types text[] NOT NULL DEFAULT '{}',
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  ga_ready boolean NOT NULL DEFAULT false,
  review_required_count int NOT NULL DEFAULT 1,
  pilot_evidence_url text,
  changelog text,
  authored_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, version),
  CONSTRAINT cpv_status_ck CHECK (status IN ('draft','in_review','approved','pilot','ga','stale','deprecated'))
);
GRANT SELECT ON public.country_pack_versions TO authenticated;
GRANT ALL ON public.country_pack_versions TO service_role;
ALTER TABLE public.country_pack_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cpv" ON public.country_pack_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write cpv" ON public.country_pack_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.rule_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.country_pack_versions(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  source_type text NOT NULL,
  citation text NOT NULL,
  url text,
  document_ref text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rs_source_type_ck CHECK (source_type IN ('statute','notification','circular','case_law','guidance','form','portal','other'))
);
GRANT SELECT ON public.rule_sources TO authenticated;
GRANT ALL ON public.rule_sources TO service_role;
ALTER TABLE public.rule_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read rule_sources" ON public.rule_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write rule_sources" ON public.rule_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.compliance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.country_pack_versions(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  cadence text NOT NULL,
  due_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_ref text,
  penalty_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, event_key),
  CONSTRAINT ce_category_ck CHECK (category IN ('gst','tds','income_tax','payroll','roc','labour','benefits','other'))
);
GRANT SELECT ON public.compliance_events TO authenticated;
GRANT ALL ON public.compliance_events TO service_role;
ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read compliance_events" ON public.compliance_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write compliance_events" ON public.compliance_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.historical_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.country_pack_versions(id) ON DELETE CASCADE,
  case_key text NOT NULL,
  calculator text NOT NULL,
  description text,
  inputs jsonb NOT NULL,
  expected jsonb NOT NULL,
  tolerance numeric NOT NULL DEFAULT 0,
  last_result jsonb,
  last_status text,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, case_key),
  CONSTRAINT htc_last_status_ck CHECK (last_status IS NULL OR last_status IN ('pass','fail','error'))
);
GRANT SELECT ON public.historical_test_cases TO authenticated;
GRANT ALL ON public.historical_test_cases TO service_role;
ALTER TABLE public.historical_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read htc" ON public.historical_test_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write htc" ON public.historical_test_cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.pack_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.country_pack_versions(id) ON DELETE CASCADE,
  reviewer_user_id uuid REFERENCES auth.users(id),
  reviewer_name text NOT NULL,
  reviewer_credential text NOT NULL,
  credential_id text,
  decision text NOT NULL,
  scope text,
  notes text,
  evidence_url text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pr_decision_ck CHECK (decision IN ('approved','changes_requested','rejected'))
);
GRANT SELECT ON public.pack_reviews TO authenticated;
GRANT ALL ON public.pack_reviews TO service_role;
ALTER TABLE public.pack_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pack_reviews" ON public.pack_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write pack_reviews" ON public.pack_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.company_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.country_pack_versions(id),
  event_key text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  due_date date,
  period_label text,
  status text NOT NULL DEFAULT 'open',
  assignee_user_id uuid REFERENCES auth.users(id),
  evidence_url text,
  notes text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT co_status_ck CHECK (status IN ('open','in_progress','filed','waived','overdue'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_obligations TO authenticated;
GRANT ALL ON public.company_obligations TO service_role;
ALTER TABLE public.company_obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read obligations" ON public.company_obligations FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "tenant members write obligations" ON public.company_obligations FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE TRIGGER trg_cp_updated BEFORE UPDATE ON public.country_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cpv_updated BEFORE UPDATE ON public.country_pack_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_co_updated BEFORE UPDATE ON public.company_obligations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce GA gate: cannot flip ga_ready or status='ga' without approved review + pilot evidence + at least one passing test run
CREATE OR REPLACE FUNCTION public.enforce_pack_ga_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  approvals int;
  passing_tests int;
  total_tests int;
BEGIN
  IF (NEW.status = 'ga' OR NEW.ga_ready = true) THEN
    SELECT COUNT(*) INTO approvals FROM public.pack_reviews
      WHERE version_id = NEW.id AND decision = 'approved';
    IF approvals < COALESCE(NEW.review_required_count, 1) THEN
      RAISE EXCEPTION 'Pack version cannot be GA: requires % approved professional review(s), have %.',
        NEW.review_required_count, approvals USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.pilot_evidence_url IS NULL OR length(trim(NEW.pilot_evidence_url)) = 0 THEN
      RAISE EXCEPTION 'Pack version cannot be GA: pilot evidence URL required.' USING ERRCODE = 'check_violation';
    END IF;
    SELECT COUNT(*), COUNT(*) FILTER (WHERE last_status = 'pass')
      INTO total_tests, passing_tests
      FROM public.historical_test_cases WHERE version_id = NEW.id;
    IF total_tests = 0 OR passing_tests < total_tests THEN
      RAISE EXCEPTION 'Pack version cannot be GA: all historical test cases must pass (% of %).',
        passing_tests, total_tests USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_pack_ga_gate() FROM PUBLIC, authenticated;
CREATE TRIGGER trg_cpv_ga_gate BEFORE UPDATE ON public.country_pack_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pack_ga_gate();

-- Seed: India pack (draft) + planned countries
INSERT INTO public.country_packs (country_code, name, jurisdiction_level, status, description) VALUES
  ('IN', 'India', 'national', 'draft', 'GST, TDS, Income Tax, Payroll, ROC and government benefits.'),
  ('US', 'United States', 'national', 'planned', 'Planned.'),
  ('GB', 'United Kingdom', 'national', 'planned', 'Planned.'),
  ('AE', 'United Arab Emirates', 'national', 'planned', 'Planned.'),
  ('SG', 'Singapore', 'national', 'planned', 'Planned.'),
  ('CA', 'Canada', 'national', 'planned', 'Planned.'),
  ('AU', 'Australia', 'national', 'planned', 'Planned.'),
  ('DE', 'Germany', 'national', 'planned', 'Planned.');

-- Seed India v2025.04 draft version with rules, compliance events, sources, tests
WITH pack AS (SELECT id FROM public.country_packs WHERE country_code = 'IN'),
ver AS (
  INSERT INTO public.country_pack_versions (pack_id, version, effective_from, jurisdiction, business_types, status, changelog, rules)
  SELECT id, '2025.04', DATE '2025-04-01', 'national',
    ARRAY['proprietorship','partnership','llp','private_limited','public_limited','opc'],
    'draft', 'Initial India pack foundation for FY 2025-26.',
    jsonb_build_object(
      'gst', jsonb_build_object(
        'registration_threshold_goods', 4000000,
        'registration_threshold_services', 2000000,
        'composition_threshold', 15000000,
        'slabs', jsonb_build_array(0, 5, 12, 18, 28),
        'gstr1_due_day', 11,
        'gstr3b_due_day', 20
      ),
      'tds', jsonb_build_object(
        'sections', jsonb_build_object(
          '192', jsonb_build_object('label','Salary','rate','slab'),
          '194A', jsonb_build_object('label','Interest','rate',10,'threshold',40000),
          '194C', jsonb_build_object('label','Contractor','rate_individual',1,'rate_other',2,'threshold_single',30000,'threshold_annual',100000),
          '194J', jsonb_build_object('label','Professional','rate',10,'threshold',30000)
        ),
        'monthly_deposit_day', 7,
        'quarterly_return_days', jsonb_build_array(31,31,31,31)
      ),
      'income_tax', jsonb_build_object(
        'assessment_year','2026-27',
        'new_regime_slabs', jsonb_build_array(
          jsonb_build_object('upto',300000,'rate',0),
          jsonb_build_object('upto',700000,'rate',5),
          jsonb_build_object('upto',1000000,'rate',10),
          jsonb_build_object('upto',1200000,'rate',15),
          jsonb_build_object('upto',1500000,'rate',20),
          jsonb_build_object('upto',null,'rate',30)
        ),
        'standard_deduction_salary', 75000,
        'rebate_87a_new_regime_upto', 700000
      ),
      'payroll', jsonb_build_object(
        'pf_employee_rate', 12,
        'pf_employer_rate', 12,
        'esi_employee_rate', 0.75,
        'esi_employer_rate', 3.25,
        'esi_wage_ceiling', 21000,
        'pt_state_specific', true
      ),
      'roc', jsonb_build_object(
        'aoc4_days_after_agm', 30,
        'mgt7_days_after_agm', 60,
        'dir3_kyc_due', '09-30'
      )
    )
  FROM pack RETURNING id
)
INSERT INTO public.rule_sources (version_id, rule_key, source_type, citation, url) VALUES
  ((SELECT id FROM ver), 'gst.registration_threshold_goods', 'notification', 'CGST Notification 10/2019', 'https://www.cbic.gov.in/'),
  ((SELECT id FROM ver), 'gst.slabs', 'statute', 'CGST Act, Rate Notifications', 'https://www.cbic.gov.in/'),
  ((SELECT id FROM ver), 'tds.sections', 'statute', 'Income Tax Act, Chapter XVII-B', 'https://incometaxindia.gov.in/'),
  ((SELECT id FROM ver), 'income_tax.new_regime_slabs', 'statute', 'Finance Act 2024, Section 115BAC', 'https://incometaxindia.gov.in/'),
  ((SELECT id FROM ver), 'payroll.pf_employee_rate', 'statute', 'EPF & MP Act, 1952', 'https://www.epfindia.gov.in/'),
  ((SELECT id FROM ver), 'payroll.esi_wage_ceiling', 'notification', 'ESI Act, Rule 50', 'https://www.esic.gov.in/'),
  ((SELECT id FROM ver), 'roc.aoc4_days_after_agm', 'statute', 'Companies Act 2013, Section 137', 'https://www.mca.gov.in/');

WITH ver AS (SELECT cpv.id FROM public.country_pack_versions cpv JOIN public.country_packs cp ON cp.id = cpv.pack_id WHERE cp.country_code='IN' AND cpv.version='2025.04')
INSERT INTO public.compliance_events (version_id, event_key, category, title, description, cadence, due_rule, form_ref) VALUES
  ((SELECT id FROM ver), 'gstr1', 'gst', 'GSTR-1 Monthly', 'Outward supplies return.', 'monthly', jsonb_build_object('day_of_next_month',11), 'GSTR-1'),
  ((SELECT id FROM ver), 'gstr3b', 'gst', 'GSTR-3B Monthly', 'Summary return and tax payment.', 'monthly', jsonb_build_object('day_of_next_month',20), 'GSTR-3B'),
  ((SELECT id FROM ver), 'tds_deposit', 'tds', 'TDS Monthly Deposit', 'Deposit tax deducted at source.', 'monthly', jsonb_build_object('day_of_next_month',7), 'Challan ITNS-281'),
  ((SELECT id FROM ver), 'tds_q1', 'tds', 'TDS Return Q1 (24Q/26Q)', 'Quarterly TDS return.', 'quarterly', jsonb_build_object('quarter',1,'due','07-31'), '24Q/26Q'),
  ((SELECT id FROM ver), 'itr_individual', 'income_tax', 'ITR — Non-audit', 'Return of income for non-audit cases.', 'annual', jsonb_build_object('due','07-31'), 'ITR-1..4'),
  ((SELECT id FROM ver), 'itr_audit', 'income_tax', 'ITR — Audit cases', 'Return for tax audit cases.', 'annual', jsonb_build_object('due','10-31'), 'ITR-3/5/6'),
  ((SELECT id FROM ver), 'advance_tax_q1', 'income_tax', 'Advance Tax — 15%', 'First instalment of advance tax.', 'annual', jsonb_build_object('due','06-15'), 'Challan 280'),
  ((SELECT id FROM ver), 'pf_ecr', 'payroll', 'PF ECR Monthly', 'EPFO monthly contribution filing.', 'monthly', jsonb_build_object('day_of_next_month',15), 'ECR'),
  ((SELECT id FROM ver), 'esi_monthly', 'payroll', 'ESI Monthly Contribution', 'ESIC monthly contribution.', 'monthly', jsonb_build_object('day_of_next_month',15), 'ESI Return'),
  ((SELECT id FROM ver), 'aoc4', 'roc', 'AOC-4 Financial Statements', 'File financial statements with ROC.', 'annual', jsonb_build_object('after_agm_days',30), 'AOC-4'),
  ((SELECT id FROM ver), 'mgt7', 'roc', 'MGT-7 Annual Return', 'File annual return with ROC.', 'annual', jsonb_build_object('after_agm_days',60), 'MGT-7'),
  ((SELECT id FROM ver), 'dir3_kyc', 'roc', 'DIR-3 KYC', 'Director KYC annual filing.', 'annual', jsonb_build_object('due','09-30'), 'DIR-3 KYC');

-- Historical deterministic test cases (calculator + expected)
WITH ver AS (SELECT cpv.id FROM public.country_pack_versions cpv JOIN public.country_packs cp ON cp.id=cpv.pack_id WHERE cp.country_code='IN' AND cpv.version='2025.04')
INSERT INTO public.historical_test_cases (version_id, case_key, calculator, description, inputs, expected, tolerance) VALUES
  ((SELECT id FROM ver), 'it_new_regime_500k', 'income_tax.new_regime', 'Salaried, gross 5,00,000 — rebate 87A applies.',
    jsonb_build_object('gross_salary',500000,'other_income',0),
    jsonb_build_object('taxable_income',425000,'tax_before_rebate',6250,'rebate_87a',6250,'tax_payable',0), 0),
  ((SELECT id FROM ver), 'it_new_regime_1000k', 'income_tax.new_regime', 'Salaried, gross 10,00,000.',
    jsonb_build_object('gross_salary',1000000,'other_income',0),
    jsonb_build_object('taxable_income',925000,'tax_before_rebate',42500,'rebate_87a',0,'tax_payable',42500), 0),
  ((SELECT id FROM ver), 'tds_194c_individual_50k', 'tds.section', 'Contractor payment 50,000 to individual.',
    jsonb_build_object('section','194C','payee_type','individual','amount',50000),
    jsonb_build_object('tds',500,'rate',1), 0),
  ((SELECT id FROM ver), 'tds_194j_25k_below_threshold', 'tds.section', 'Professional fee 25,000 — below 30,000 threshold.',
    jsonb_build_object('section','194J','amount',25000),
    jsonb_build_object('tds',0,'rate',0,'below_threshold',true), 0),
  ((SELECT id FROM ver), 'pf_25k_wage', 'payroll.pf', 'PF on wage 25,000.',
    jsonb_build_object('wage',25000),
    jsonb_build_object('employee',3000,'employer',3000), 0),
  ((SELECT id FROM ver), 'esi_18k_eligible', 'payroll.esi', 'ESI on wage 18,000 (within ceiling).',
    jsonb_build_object('wage',18000),
    jsonb_build_object('employee',135,'employer',585,'covered',true), 0),
  ((SELECT id FROM ver), 'esi_25k_not_covered', 'payroll.esi', 'ESI on wage 25,000 (above ceiling).',
    jsonb_build_object('wage',25000),
    jsonb_build_object('employee',0,'employer',0,'covered',false), 0);
