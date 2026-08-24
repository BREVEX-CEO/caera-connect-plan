-- Rollback for server-side consent receipts.
--
-- READ THIS BEFORE RUNNING IT. This table is the only durable evidence of
-- which document versions an account accepted and when. Dropping it destroys
-- that evidence permanently -- there is no second copy, because the point of
-- the table was that a copy on the person's own machine is not evidence.
--
-- Export it first. Roll this back only together with reverting the consent
-- gate to localStorage-only, and expect every signed-in person to be asked to
-- accept again on every device afterwards.

BEGIN;

DROP TABLE IF EXISTS public.legal_consent_receipts;

COMMIT;
