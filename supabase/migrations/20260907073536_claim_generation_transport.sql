-- A durable commercial permit authorizes one top-level intelligence transport.
-- Claiming it atomically closes the gap between "the row is reserved" and
-- "this server request owns it", so a copied browser permit cannot start two
-- provider/native runs before either one settles the reservation.

BEGIN;

ALTER TABLE public.ocade_generation_permits
  ADD COLUMN transport_claimed_at timestamptz;

COMMENT ON COLUMN public.ocade_generation_permits.transport_claimed_at IS
  'Server-authored one-time claim for the top-level intelligence transport.';

CREATE OR REPLACE FUNCTION public.ocade_reset_generation_transport_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'reserved' AND OLD.status <> 'reserved' THEN
    NEW.transport_claimed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ocade_generation_permits_reset_transport_claim
BEFORE UPDATE ON public.ocade_generation_permits
FOR EACH ROW
EXECUTE FUNCTION public.ocade_reset_generation_transport_claim();

CREATE OR REPLACE FUNCTION public.ocade_claim_generation_transport(
  p_user_id uuid,
  p_permit_id uuid,
  p_generation_id text,
  p_idempotency_key text,
  p_surface text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := statement_timestamp();
BEGIN
  UPDATE public.ocade_generation_permits AS permit
     SET transport_claimed_at = v_now,
         updated_at = v_now
   WHERE permit.id = p_permit_id
     AND permit.user_id = p_user_id
     AND permit.generation_id = p_generation_id
     AND permit.idempotency_key = p_idempotency_key
     AND permit.surface = p_surface
     AND permit.status = 'reserved'
     AND permit.expires_at > v_now
     AND permit.transport_claimed_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_claim_generation_transport(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_reset_generation_transport_claim()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_claim_generation_transport(
  uuid, uuid, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.ocade_reset_generation_transport_claim()
  TO service_role;

COMMIT;
