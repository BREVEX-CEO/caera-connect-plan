-- Remove the durable permit lifecycle and restore the two pre-existing
-- counter functions to their exact earlier execution posture.
BEGIN;

DROP FUNCTION IF EXISTS public.ocade_release_generation_permit(uuid, text, text);
DROP FUNCTION IF EXISTS public.ocade_read_commercial_usage(uuid);
DROP FUNCTION IF EXISTS public.ocade_finalize_generation_permit(uuid, text, bigint);
DROP FUNCTION IF EXISTS public.ocade_acquire_generation_permit(
  uuid, text, text, text, text, bigint, bigint, bigint
);
DROP FUNCTION IF EXISTS public.ocade_expire_commercial_permits(uuid, timestamptz);
DROP TABLE IF EXISTS public.ocade_generation_permits;

ALTER FUNCTION public.ocade_consume_commercial_work(UUID, text, TIMESTAMPTZ, bigint, bigint)
  SECURITY DEFINER;
ALTER FUNCTION public.ocade_consume_commercial_work(UUID, text, TIMESTAMPTZ, bigint, bigint)
  SET search_path TO public;
ALTER FUNCTION public.ocade_release_commercial_work(UUID, text, TIMESTAMPTZ, bigint)
  SECURITY DEFINER;
ALTER FUNCTION public.ocade_release_commercial_work(UUID, text, TIMESTAMPTZ, bigint)
  SET search_path TO public;

COMMIT;
