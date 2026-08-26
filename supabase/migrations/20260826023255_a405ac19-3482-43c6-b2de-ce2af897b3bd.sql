CREATE TABLE IF NOT EXISTS public.legal_consent_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  source text not null default 'gate',
  accepted_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.legal_consent_receipts TO authenticated;
GRANT ALL ON public.legal_consent_receipts TO service_role;

ALTER TABLE public.legal_consent_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own consent receipts" ON public.legal_consent_receipts;
CREATE POLICY "Users read their own consent receipts"
  ON public.legal_consent_receipts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users record their own consent receipts" ON public.legal_consent_receipts;
CREATE POLICY "Users record their own consent receipts"
  ON public.legal_consent_receipts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS legal_consent_receipts_user_accepted_idx
  ON public.legal_consent_receipts (user_id, accepted_at DESC);

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider_event_at timestamptz;