-- Restore the pre-claim permit schema. Existing usage settlement stays intact.
BEGIN;

DROP TRIGGER IF EXISTS ocade_generation_permits_reset_transport_claim
  ON public.ocade_generation_permits;
DROP FUNCTION IF EXISTS public.ocade_reset_generation_transport_claim();
DROP FUNCTION IF EXISTS public.ocade_claim_generation_transport(
  uuid, uuid, text, text, text
);

ALTER TABLE public.ocade_generation_permits
  DROP COLUMN IF EXISTS transport_claimed_at;

COMMIT;
