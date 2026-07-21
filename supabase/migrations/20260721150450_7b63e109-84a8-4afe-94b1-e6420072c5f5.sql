CREATE OR REPLACE FUNCTION public.create_company_with_owner(_uid uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
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
REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_with_owner(uuid, jsonb) TO service_role;

DROP FUNCTION IF EXISTS public.create_company_with_owner(jsonb);