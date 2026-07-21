
-- 1. Extend tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS tax_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS address jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fiscal_year_end_month smallint,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS branches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subsidiaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 2. Duplicate prevention (per-country, case-insensitive, only when a value is present)
CREATE UNIQUE INDEX IF NOT EXISTS tenants_country_regnum_uniq
  ON public.tenants (country, lower(registration_number))
  WHERE registration_number IS NOT NULL AND registration_number <> '';

CREATE UNIQUE INDEX IF NOT EXISTS tenants_country_gstin_uniq
  ON public.tenants (country, lower((tax_ids->>'gstin')))
  WHERE tax_ids ? 'gstin' AND (tax_ids->>'gstin') IS NOT NULL AND (tax_ids->>'gstin') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS tenants_country_pan_uniq
  ON public.tenants (country, lower((tax_ids->>'pan')))
  WHERE tax_ids ? 'pan' AND (tax_ids->>'pan') IS NOT NULL AND (tax_ids->>'pan') <> '';

-- 3. Access requests
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role tenant_role NOT NULL DEFAULT 'employee',
  message text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, requester_user_id, status),
  CONSTRAINT ar_status_ck CHECK (status IN ('pending','approved','rejected','withdrawn'))
);
GRANT SELECT, INSERT, UPDATE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ar_requester_read" ON public.access_requests FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid());
CREATE POLICY "ar_owner_read" ON public.access_requests FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), 'owner'));
CREATE POLICY "ar_requester_insert" ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid() AND status = 'pending');
CREATE POLICY "ar_requester_withdraw" ON public.access_requests FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (requester_user_id = auth.uid() AND status IN ('pending','withdrawn'));
CREATE POLICY "ar_owner_decide" ON public.access_requests FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), 'owner'))
  WITH CHECK (public.has_tenant_role(tenant_id, auth.uid(), 'owner'));

CREATE TRIGGER trg_ar_updated BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Duplicate lookup — SECURITY DEFINER, returns only display info
CREATE OR REPLACE FUNCTION public.find_conflicting_legal_id(
  _country text,
  _registration text,
  _gstin text,
  _pan text
) RETURNS TABLE (id uuid, name text, matched text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, 'registration_number'::text
    FROM public.tenants t
   WHERE _registration IS NOT NULL AND _registration <> ''
     AND t.country = _country
     AND lower(t.registration_number) = lower(_registration)
  UNION
  SELECT t.id, t.name, 'gstin'::text
    FROM public.tenants t
   WHERE _gstin IS NOT NULL AND _gstin <> ''
     AND t.country = _country
     AND lower(t.tax_ids->>'gstin') = lower(_gstin)
  UNION
  SELECT t.id, t.name, 'pan'::text
    FROM public.tenants t
   WHERE _pan IS NOT NULL AND _pan <> ''
     AND t.country = _country
     AND lower(t.tax_ids->>'pan') = lower(_pan);
$$;
REVOKE EXECUTE ON FUNCTION public.find_conflicting_legal_id(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_conflicting_legal_id(text, text, text, text) TO authenticated;

-- 5. Similar name lookup
CREATE OR REPLACE FUNCTION public.find_similar_company_names(
  _country text,
  _name text
) RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name
    FROM public.tenants t
   WHERE _name IS NOT NULL AND length(trim(_name)) >= 3
     AND t.country = _country
     AND lower(t.name) LIKE '%' || lower(trim(_name)) || '%'
   LIMIT 10;
$$;
REVOKE EXECUTE ON FUNCTION public.find_similar_company_names(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_similar_company_names(text, text) TO authenticated;

-- 6. Transactional create-company-with-owner
CREATE OR REPLACE FUNCTION public.create_company_with_owner(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _country text := _payload->>'country';
  _registration text := NULLIF(_payload->>'registration_number', '');
  _gstin text := NULLIF(_payload#>>'{tax_ids,gstin}', '');
  _pan text := NULLIF(_payload#>>'{tax_ids,pan}', '');
  _existing uuid;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;
  IF _payload->>'name' IS NULL OR length(trim(_payload->>'name')) < 2 THEN
    RAISE EXCEPTION 'display name required' USING ERRCODE = 'check_violation';
  END IF;
  IF _country IS NULL OR length(_country) <> 2 THEN
    RAISE EXCEPTION 'country ISO-2 required' USING ERRCODE = 'check_violation';
  END IF;

  -- Legal-ID pre-check to give a clean error instead of the unique-index violation
  SELECT id INTO _existing FROM public.find_conflicting_legal_id(_country, _registration, _gstin, _pan) LIMIT 1;
  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate_legal_id:%', _existing USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.tenants (
    name, legal_name, kind, country, region, industry, currency, timezone,
    fiscal_year_start_month, fiscal_year_end_month, accounting_method,
    logo_url, entity_type, registration_number, tax_ids, address, contact,
    description, branches, subsidiaries, status, created_by
  ) VALUES (
    trim(_payload->>'name'),
    NULLIF(_payload->>'legal_name', ''),
    COALESCE((_payload->>'kind')::tenant_kind, 'company'::tenant_kind),
    _country,
    NULLIF(_payload->>'region', ''),
    NULLIF(_payload->>'industry', ''),
    COALESCE(NULLIF(_payload->>'currency',''), 'USD'),
    COALESCE(NULLIF(_payload->>'timezone',''), 'UTC'),
    COALESCE((_payload->>'fiscal_year_start_month')::smallint, 4),
    NULLIF(_payload->>'fiscal_year_end_month','')::smallint,
    NULLIF(_payload->>'accounting_method',''),
    NULLIF(_payload->>'logo_url',''),
    NULLIF(_payload->>'entity_type',''),
    _registration,
    COALESCE(_payload->'tax_ids', '{}'::jsonb),
    COALESCE(_payload->'address', '{}'::jsonb),
    COALESCE(_payload->'contact', '{}'::jsonb),
    NULLIF(_payload->>'description',''),
    COALESCE(_payload->'branches', '[]'::jsonb),
    COALESCE(_payload->'subsidiaries', '[]'::jsonb),
    'active',
    _uid
  ) RETURNING id INTO _new_id;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (_new_id, _uid, 'owner');

  RETURN _new_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_company_with_owner(jsonb) TO authenticated;
