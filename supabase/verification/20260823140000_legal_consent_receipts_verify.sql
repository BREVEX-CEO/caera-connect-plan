-- Verifies that consent evidence cannot be edited or erased by its subject.

DO $$
BEGIN
  IF to_regclass('public.legal_consent_receipts') IS NULL THEN
    RAISE EXCEPTION 'public.legal_consent_receipts is missing; consent cannot be proven';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'public.legal_consent_receipts'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'legal_consent_receipts does not have row level security enabled';
  END IF;

  -- The two policies that must exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'legal_consent_receipts' AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'no SELECT policy: a person cannot see what they agreed to';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'legal_consent_receipts' AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'no INSERT policy: acceptance could not be recorded';
  END IF;

  -- And the two that must NOT. This is the substance of "append-only": a
  -- consent record the subject can edit is not evidence of anything.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'legal_consent_receipts'
      AND cmd IN ('UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION
      'legal_consent_receipts has an UPDATE or DELETE policy; historical consent could be overwritten';
  END IF;

  IF has_table_privilege('anon', 'public.legal_consent_receipts', 'select') THEN
    RAISE EXCEPTION 'consent receipts are readable without signing in';
  END IF;

  IF has_table_privilege('authenticated', 'public.legal_consent_receipts', 'update')
     OR has_table_privilege('authenticated', 'public.legal_consent_receipts', 'delete') THEN
    RAISE EXCEPTION 'authenticated holds update or delete on consent receipts';
  END IF;

  -- Versions are separate columns so a terms-only revision can be answered
  -- without guessing what the privacy version was at the time.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_consent_receipts'
      AND column_name IN ('terms_version', 'privacy_version')
    GROUP BY table_name HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION 'consent receipts do not record both document versions separately';
  END IF;
END;
$$;

-- The source check exists and rejects an unknown collection point.
DO $$
DECLARE
  _rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.legal_consent_receipts
      (user_id, terms_version, privacy_version, source)
    VALUES ('00000000-0000-0000-0000-000000000000', 'v1', 'v1', 'somewhere_else');
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    _rejected := true;
  END;

  DELETE FROM public.legal_consent_receipts WHERE terms_version = 'v1' AND privacy_version = 'v1';

  IF NOT _rejected THEN
    RAISE EXCEPTION 'legal_consent_receipts.source accepted a value outside its check constraint';
  END IF;
END;
$$;
