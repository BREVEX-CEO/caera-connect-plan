-- Undo the legal consent receipt table and the subscriptions provider_event_at
-- column. Both were additive, so the rollback is a clean removal. Dropping the
-- receipts table destroys recorded acceptances: export them first if the rows
-- are needed as evidence.

BEGIN;

DROP POLICY IF EXISTS "Users read their own consent receipts" ON public.legal_consent_receipts;
DROP POLICY IF EXISTS "Users record their own consent receipts" ON public.legal_consent_receipts;
DROP INDEX IF EXISTS public.legal_consent_receipts_user_accepted_idx;
DROP TABLE IF EXISTS public.legal_consent_receipts;

ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS provider_event_at;

COMMIT;
