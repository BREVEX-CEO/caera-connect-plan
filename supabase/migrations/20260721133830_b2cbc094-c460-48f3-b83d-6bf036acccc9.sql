
-- 1. main_purpose enum on user_settings
DO $$ BEGIN
  CREATE TYPE public.main_purpose_kind AS ENUM ('solo','small_business','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_settings
  ALTER COLUMN main_purpose TYPE public.main_purpose_kind
  USING CASE WHEN main_purpose IN ('solo','small_business','enterprise')
             THEN main_purpose::public.main_purpose_kind
             ELSE NULL END;

-- 2. Split audit: rename existing audit_log -> compliance_audit_log, harden it, add operational activity_log
ALTER TABLE public.audit_log RENAME TO compliance_audit_log;

DO $$ BEGIN
  CREATE TYPE public.compliance_category AS ENUM (
    'finance','payment','filing','signature','approval',
    'role_change','sensitive_export','deletion','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.compliance_audit_log
  ADD COLUMN IF NOT EXISTS category public.compliance_category NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS prev_hash TEXT,
  ADD COLUMN IF NOT EXISTS row_hash  TEXT;

-- Immutability: revoke UPDATE/DELETE for non-service roles. Any client policy set is intentionally omitted.
REVOKE UPDATE, DELETE ON public.compliance_audit_log FROM authenticated, anon;
GRANT SELECT ON public.compliance_audit_log TO authenticated;
GRANT ALL ON public.compliance_audit_log TO service_role;

-- Operational activity log (short retention, user-clearable)
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  feature_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own activity read" ON public.activity_log;
CREATE POLICY "own activity read" ON public.activity_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own activity insert" ON public.activity_log;
CREATE POLICY "own activity insert" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own activity clear" ON public.activity_log;
CREATE POLICY "own activity clear" ON public.activity_log
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS activity_log_user_time_idx
  ON public.activity_log (user_id, created_at DESC);

-- 3. Devices: add physical_pc_id; browser_grants; corrected cap
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS physical_pc_id UUID;

-- Distinct physical PC uniqueness per user (nullable rows unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS devices_user_physical_pc_uniq
  ON public.devices (user_id, physical_pc_id)
  WHERE physical_pc_id IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.browser_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  browser_install_id TEXT NOT NULL,
  origin TEXT,
  user_agent TEXT,
  approved_by_grant_id UUID REFERENCES public.browser_grants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (device_id, browser_install_id)
);
GRANT SELECT, INSERT, UPDATE ON public.browser_grants TO authenticated;
GRANT ALL ON public.browser_grants TO service_role;
ALTER TABLE public.browser_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own grants" ON public.browser_grants;
CREATE POLICY "own grants" ON public.browser_grants
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS browser_grants_device_idx
  ON public.browser_grants (device_id) WHERE revoked_at IS NULL;

-- 4. Corrected device cap: count distinct active devices per kind. 2 desktop + 2 mobile.
CREATE OR REPLACE FUNCTION public.enforce_device_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count INT;
  cap INT := 2;
BEGIN
  IF NEW.revoked_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO active_count
    FROM public.devices
    WHERE user_id = NEW.user_id
      AND kind = NEW.kind
      AND revoked_at IS NULL
      AND id <> NEW.id;
  IF active_count >= cap THEN
    RAISE EXCEPTION 'Device cap reached for kind %: maximum % active per account. Revoke a device to add a new one.', NEW.kind, cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_device_cap() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_device_cap() TO service_role;
