-- The commercial usage ledger, as PLAN §13 defines it.
--
-- WHAT WAS HERE. `ocade_cloud_usage` counted whole uses in a fixed 8-hour UTC
-- window, and its own comment said "Local inference is unlimited and never
-- recorded here". Three things about that are now wrong:
--
--   THE WINDOW. Allowances run for 6h28m, anchored to the ACCOUNT rather than
--   to the clock. A fixed UTC boundary gives every account in the world the
--   same reset instant — mid-morning for some people, mid-sleep for others —
--   and turns the reset into a stampede.
--
--   THE UNIT. Free counts uses, one per logical request. Pro and Max count
--   weighted Standard Work Equivalents, which are fractional. An INTEGER
--   column cannot hold them, and storing them as a float would let the ledger
--   drift by fractions of a unit across a week of additions. They are stored as
--   integer HUNDREDTHS: exact, addable in any order, and the same unit the
--   policy rounds to.
--
--   THE SCOPE. Successful local work consumes commercial usage too. A ledger
--   called `cloud_usage` that records local work is a table whose name is a
--   lie, so it is renamed rather than quietly repurposed.
--
-- THE WEEKLY WINDOW IS NEW. Pro and Max are bounded per session AND per
-- account-week; without the second row an account can spend a week's allowance
-- in a day.
--
-- Renaming rather than creating alongside, deliberately: two usage ledgers is
-- how an allowance comes to be enforced in one place and displayed from the
-- other.

BEGIN;

ALTER TABLE public.ocade_cloud_usage RENAME TO ocade_commercial_usage;

-- Which window this row measures. Existing rows were session-equivalents.
ALTER TABLE public.ocade_commercial_usage
  ADD COLUMN IF NOT EXISTS window_kind text NOT NULL DEFAULT 'session';
ALTER TABLE public.ocade_commercial_usage
  DROP CONSTRAINT IF EXISTS ocade_commercial_usage_window_kind_check;
ALTER TABLE public.ocade_commercial_usage
  ADD CONSTRAINT ocade_commercial_usage_window_kind_check
  CHECK (window_kind IN ('session', 'week'));

-- Exact fractional accounting, in hundredths.
ALTER TABLE public.ocade_commercial_usage
  ADD COLUMN IF NOT EXISTS used_hundredths bigint NOT NULL DEFAULT 0;
ALTER TABLE public.ocade_commercial_usage
  DROP CONSTRAINT IF EXISTS ocade_commercial_usage_used_hundredths_check;
ALTER TABLE public.ocade_commercial_usage
  ADD CONSTRAINT ocade_commercial_usage_used_hundredths_check
  CHECK (used_hundredths >= 0);

-- Carry any existing whole-use counts across before the old column goes, so
-- nobody's spent allowance is silently returned to them.
UPDATE public.ocade_commercial_usage
  SET used_hundredths = used_count * 100
  WHERE used_hundredths = 0 AND used_count > 0;

ALTER TABLE public.ocade_commercial_usage DROP COLUMN IF EXISTS used_count;

-- One row per account, per window kind, per window.
ALTER TABLE public.ocade_commercial_usage
  DROP CONSTRAINT IF EXISTS ocade_cloud_usage_user_id_window_start_key;
ALTER TABLE public.ocade_commercial_usage
  DROP CONSTRAINT IF EXISTS ocade_commercial_usage_user_window_key;
ALTER TABLE public.ocade_commercial_usage
  ADD CONSTRAINT ocade_commercial_usage_user_window_key
  UNIQUE (user_id, window_kind, window_start);

DROP INDEX IF EXISTS public.ocade_cloud_usage_user_window_idx;
CREATE INDEX IF NOT EXISTS ocade_commercial_usage_user_window_idx
  ON public.ocade_commercial_usage (user_id, window_kind, window_start DESC);

-- The old consume function measured the old unit in the old window. Nothing
-- calls it; it is replaced rather than left beside its successor, because two
-- consume paths is how an allowance gets spent twice or not at all.
DROP FUNCTION IF EXISTS public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER);

/*
 * Reserve work against one window, atomically.
 *
 * ONE STATEMENT, so concurrent requests cannot both read "139 used" and both
 * proceed. The insert-or-update returns the new total and the check happens
 * after it, inside the same statement's transaction — so exceeding the
 * allowance raises and rolls the increment back rather than leaving the ledger
 * above the limit.
 *
 * A limit of NULL means the window has no allowance (Free has no weekly one),
 * and the increment is recorded without a ceiling. Recording it anyway is the
 * point: an account's own usage screen is built from these rows, and a window
 * that is not enforced is still a window somebody may want to see.
 */
CREATE OR REPLACE FUNCTION public.ocade_consume_commercial_work(
  p_user_id UUID,
  p_window_kind text,
  p_window_start TIMESTAMPTZ,
  p_cost_hundredths bigint,
  p_limit_hundredths bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used bigint;
BEGIN
  IF p_cost_hundredths < 0 THEN
    RAISE EXCEPTION 'a request cannot cost less than nothing'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.ocade_commercial_usage (
    user_id, window_kind, window_start, used_hundredths
  )
  VALUES (p_user_id, p_window_kind, p_window_start, p_cost_hundredths)
  ON CONFLICT (user_id, window_kind, window_start)
  DO UPDATE SET
    used_hundredths = public.ocade_commercial_usage.used_hundredths + p_cost_hundredths
  RETURNING used_hundredths INTO v_used;

  IF p_limit_hundredths IS NOT NULL AND v_used > p_limit_hundredths THEN
    RAISE EXCEPTION 'allowance_exhausted' USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_used;
END;
$$;

/*
 * Give work back.
 *
 * A request that failed, or that the person cancelled before any output
 * reached them, must not be charged. The gate reserves before routing and
 * releases on those paths, so this is the other half of that pair.
 *
 * FLOORED AT ZERO. A double release, or a release for a reservation that a
 * window rollover has already discarded, must not drive the ledger negative
 * and hand out allowance nobody paid for.
 */
CREATE OR REPLACE FUNCTION public.ocade_release_commercial_work(
  p_user_id UUID,
  p_window_kind text,
  p_window_start TIMESTAMPTZ,
  p_cost_hundredths bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used bigint;
BEGIN
  UPDATE public.ocade_commercial_usage
    SET used_hundredths = GREATEST(0, used_hundredths - GREATEST(0, p_cost_hundredths))
    WHERE user_id = p_user_id
      AND window_kind = p_window_kind
      AND window_start = p_window_start
    RETURNING used_hundredths INTO v_used;

  RETURN COALESCE(v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_consume_commercial_work(UUID, text, TIMESTAMPTZ, bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_consume_commercial_work(UUID, text, TIMESTAMPTZ, bigint, bigint)
  TO service_role;

REVOKE ALL ON FUNCTION public.ocade_release_commercial_work(UUID, text, TIMESTAMPTZ, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_release_commercial_work(UUID, text, TIMESTAMPTZ, bigint)
  TO service_role;

COMMENT ON TABLE public.ocade_commercial_usage IS
  'Commercial usage ledger. One row per account, window kind and window start. Amounts are integer hundredths of a Standard Work Equivalent; Free counts whole uses, so its rows move in multiples of 100. Covers every AI surface and backend, local included.';

COMMIT;
