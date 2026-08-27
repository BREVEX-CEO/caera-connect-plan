-- Restores the duplicated state that 20260827180000 removed.
--
-- Only useful if something depended on the duplicates, which nothing should:
-- the second INSERT policy permitted exactly what the first permits, and the
-- second index covered exactly the same columns. Included for symmetry with
-- every other migration in this directory rather than because it is expected
-- to be needed.

BEGIN;

CREATE POLICY "Users record their own consent receipts"
  ON public.legal_consent_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read their own consent receipts" ON public.legal_consent_receipts;
CREATE POLICY "Users read their own consent receipts"
  ON public.legal_consent_receipts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_legal_consent_receipts_user
  ON public.legal_consent_receipts USING btree (user_id, accepted_at DESC);

COMMIT;
