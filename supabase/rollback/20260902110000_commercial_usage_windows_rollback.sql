-- Restore the whole-use cloud ledger.
--
-- LOSSY IN ONE DIRECTION, and it says so rather than pretending otherwise:
-- fractional work is rounded UP to whole uses on the way back, because the old
-- column cannot hold a fraction. Rounding up rather than truncating means an
-- account is never handed back allowance it has already spent.
--
-- Weekly rows have nowhere to go in the old shape, which had no weekly window
-- at all. They are removed, which returns that allowance — unavoidable, and
-- the reason this rollback is for recovering the SHAPE rather than for routine
-- use.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_release_commercial_work(UUID, text, TIMESTAMPTZ, bigint);
DROP FUNCTION IF EXISTS public.ocade_consume_commercial_work(UUID, text, TIMESTAMPTZ, bigint, bigint);

DELETE FROM public.ocade_commercial_usage WHERE window_kind <> 'session';

ALTER TABLE public.ocade_commercial_usage
  ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.ocade_commercial_usage
  SET used_count = CEIL(used_hundredths / 100.0)::INTEGER;

ALTER TABLE public.ocade_commercial_usage
  DROP CONSTRAINT IF EXISTS ocade_commercial_usage_used_hundredths_check;
ALTER TABLE public.ocade_commercial_usage
  DROP CONSTRAINT IF EXISTS ocade_commercial_usage_window_kind_check;
ALTER TABLE public.ocade_commercial_usage
  DROP CONSTRAINT IF EXISTS ocade_commercial_usage_user_window_key;

ALTER TABLE public.ocade_commercial_usage DROP COLUMN IF EXISTS used_hundredths;
ALTER TABLE public.ocade_commercial_usage DROP COLUMN IF EXISTS window_kind;

DROP INDEX IF EXISTS public.ocade_commercial_usage_user_window_idx;

ALTER TABLE public.ocade_commercial_usage RENAME TO ocade_cloud_usage;

ALTER TABLE public.ocade_cloud_usage
  ADD CONSTRAINT ocade_cloud_usage_user_id_window_start_key UNIQUE (user_id, window_start);
ALTER TABLE public.ocade_cloud_usage
  ADD CONSTRAINT ocade_cloud_usage_used_count_check CHECK (used_count >= 0);

CREATE INDEX IF NOT EXISTS ocade_cloud_usage_user_window_idx
  ON public.ocade_cloud_usage (user_id, window_start DESC);

CREATE OR REPLACE FUNCTION public.ocade_consume_cloud_use(
  p_user_id UUID,
  p_window_start TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
BEGIN
  INSERT INTO public.ocade_cloud_usage (user_id, window_start, used_count)
  VALUES (p_user_id, p_window_start, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET used_count = public.ocade_cloud_usage.used_count + 1
  RETURNING used_count INTO v_used;

  IF v_used > p_limit THEN
    RAISE EXCEPTION 'allowance_exhausted' USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_used;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER) TO service_role;

COMMENT ON TABLE public.ocade_cloud_usage IS
  'OCADE Cloud allowance ledger (28 per fixed 8-hour UTC window). Local inference is unlimited and never recorded here.';

COMMIT;
