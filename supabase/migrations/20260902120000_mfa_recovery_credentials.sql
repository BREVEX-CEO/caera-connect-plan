-- Recovery credentials for lost second factors, as PLAN.md §B defines them.
--
-- WHAT THESE ARE, AND WHAT THEY ARE NOT. Supabase does not expose customer
-- recovery codes through its TOTP client API, so OCADE's codes are NOT a
-- parallel login factor. A code proves one thing only: that the person holding
-- an already-authenticated AAL1 session is entitled to have their lost factor
-- REMOVED. It buys a factor reset, never access to data.
--
-- That distinction is the whole security argument. A parallel login factor
-- turns a printed sheet of paper into a password; a factor-reset credential
-- only shortens a support conversation, and the session it acts on was already
-- authenticated by other means.
--
-- ONLY KEYED HASHES ARE STORED. The plaintext is shown once and never written.
-- The hash is an HMAC under a server-held pepper rather than a bare digest, so
-- a stolen copy of this table is not a list somebody can attack offline with a
-- rainbow table: without the pepper there is nothing to compare against.
--
-- THE COUNTER LIVES IN THE DATABASE, NOT IN AN ISOLATE. OCADE already has an
-- in-memory rate limiter, and it is the right shape for bounding cost. It is
-- the wrong shape for bounding GUESSES: it resets when an isolate recycles and
-- it is per-isolate, so a distributed deployment multiplies every quota by the
-- number of workers. A credential that can be guessed needs a counter that
-- survives, so the attempt state is a row and the check happens inside the same
-- atomic function that consumes the code.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- HMAC-SHA256 of the plaintext under the server pepper, lowercase hex.
  code_hash text NOT NULL,
  -- Which batch this code belongs to. Regeneration bumps it and retires every
  -- earlier batch, so a printed sheet from last year cannot be used after the
  -- owner has deliberately replaced it.
  generation integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Single use. Set once, never cleared.
  used_at timestamptz,
  CONSTRAINT ocade_mfa_recovery_codes_hash_shape CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ocade_mfa_recovery_codes_user_hash_key UNIQUE (user_id, code_hash)
);

-- The lookup the consume function makes: one indexed probe per attempt, so a
-- guess costs the same whether or not it exists.
CREATE INDEX IF NOT EXISTS ocade_mfa_recovery_codes_user_unused_idx
  ON public.ocade_mfa_recovery_codes (user_id, generation)
  WHERE used_at IS NULL;

/*
 * Durable attempt state, one row per account.
 *
 * Kept in its own table rather than as columns on `profiles`: a failed guess
 * writes here on every attempt, and putting that write on the row every page
 * load reads is how a lock contends with the whole product.
 */
CREATE TABLE IF NOT EXISTS public.ocade_mfa_recovery_attempts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  CONSTRAINT ocade_mfa_recovery_attempts_count_check CHECK (failed_count >= 0)
);

-- Neither table is ever read by a browser. RLS is enabled with NO policy, so
-- `authenticated` and `anon` match nothing at all; the consume function runs as
-- definer and is granted to `service_role` alone.
ALTER TABLE public.ocade_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_mfa_recovery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocade_mfa_recovery_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ocade_mfa_recovery_attempts FROM PUBLIC, anon, authenticated;

/*
 * Replace an account's recovery codes with a new batch.
 *
 * ALL OR NOTHING, and the old batch is deleted rather than marked stale: a
 * retired code that is still present is a code that a later query bug can
 * accept. Deleting them means the only rows that exist are the ones that work.
 *
 * The caller sends hashes. Plaintext never reaches the database, not even
 * transiently, so it cannot reach a statement log.
 */
CREATE OR REPLACE FUNCTION public.ocade_replace_mfa_recovery_codes(
  p_user_id UUID,
  p_code_hashes text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_generation integer;
  v_count integer;
BEGIN
  IF p_code_hashes IS NULL OR array_length(p_code_hashes, 1) IS NULL THEN
    RAISE EXCEPTION 'a recovery batch cannot be empty'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(MAX(generation), 0) + 1 INTO v_generation
    FROM public.ocade_mfa_recovery_codes WHERE user_id = p_user_id;

  DELETE FROM public.ocade_mfa_recovery_codes WHERE user_id = p_user_id;

  INSERT INTO public.ocade_mfa_recovery_codes (user_id, code_hash, generation)
    SELECT p_user_id, hash, v_generation FROM unnest(p_code_hashes) AS hash;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- A fresh batch clears the lockout. The owner has just proved themselves to
  -- get here, and leaving them locked out of codes they created a moment ago
  -- would be a product that punishes the recovery it just performed.
  DELETE FROM public.ocade_mfa_recovery_attempts WHERE user_id = p_user_id;

  RETURN v_count;
END;
$$;

/*
 * Check and consume one recovery code, atomically.
 *
 * ONE FUNCTION, because the check and the consumption must not be separable.
 * Two calls — "is this valid?" then "mark it used" — is a race in which the
 * same code is spent twice by two requests that both read "unused".
 *
 * The lockout is evaluated INSIDE this function for the same reason. A limiter
 * that lives in front of the call can be bypassed by reaching the call another
 * way; one that lives inside it cannot.
 *
 * Returns a status word rather than a boolean, because the three outcomes are
 * genuinely different to the person: consumed, rejected, or locked out.
 */
CREATE OR REPLACE FUNCTION public.ocade_consume_mfa_recovery_code(
  p_user_id UUID,
  p_code_hash text,
  p_max_failures integer DEFAULT 5,
  p_window_seconds integer DEFAULT 900,
  p_lock_seconds integer DEFAULT 900
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts public.ocade_mfa_recovery_attempts%ROWTYPE;
  v_code_id uuid;
BEGIN
  -- Locked FOR UPDATE so two concurrent guesses cannot both read the same
  -- failure count and each decide there is one attempt left.
  INSERT INTO public.ocade_mfa_recovery_attempts (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_attempts
    FROM public.ocade_mfa_recovery_attempts
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF v_attempts.locked_until IS NOT NULL AND v_attempts.locked_until > now() THEN
    RETURN 'locked';
  END IF;

  -- A lapsed window starts the count again. Somebody who mistyped a code last
  -- month is not part-way through an attack.
  IF v_attempts.window_started_at < now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.ocade_mfa_recovery_attempts
      SET failed_count = 0, window_started_at = now(), locked_until = NULL
      WHERE user_id = p_user_id;
    v_attempts.failed_count := 0;
  END IF;

  SELECT id INTO v_code_id
    FROM public.ocade_mfa_recovery_codes
    WHERE user_id = p_user_id
      AND code_hash = p_code_hash
      AND used_at IS NULL
    FOR UPDATE;

  IF v_code_id IS NULL THEN
    UPDATE public.ocade_mfa_recovery_attempts
      SET failed_count = v_attempts.failed_count + 1,
          locked_until = CASE
            WHEN v_attempts.failed_count + 1 >= p_max_failures
              THEN now() + make_interval(secs => p_lock_seconds)
            ELSE locked_until
          END
      WHERE user_id = p_user_id;

    IF v_attempts.failed_count + 1 >= p_max_failures THEN
      RETURN 'locked';
    END IF;
    RETURN 'rejected';
  END IF;

  UPDATE public.ocade_mfa_recovery_codes
    SET used_at = now()
    WHERE id = v_code_id;

  -- A correct code clears the count. The window exists to bound guessing, and
  -- somebody who has just proved possession is not guessing.
  DELETE FROM public.ocade_mfa_recovery_attempts WHERE user_id = p_user_id;

  RETURN 'consumed';
END;
$$;

/*
 * How many usable codes remain.
 *
 * Read by the Security page so it can say "3 of 10 left" truthfully rather than
 * implying a full sheet. It returns a COUNT and never a code.
 */
CREATE OR REPLACE FUNCTION public.ocade_count_mfa_recovery_codes(p_user_id UUID)
RETURNS TABLE (remaining integer, total integer, generated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE used_at IS NULL)::integer AS remaining,
    COUNT(*)::integer AS total,
    MAX(created_at) AS generated_at
  FROM public.ocade_mfa_recovery_codes
  WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.ocade_replace_mfa_recovery_codes(UUID, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_replace_mfa_recovery_codes(UUID, text[])
  TO service_role;

REVOKE ALL ON FUNCTION public.ocade_consume_mfa_recovery_code(UUID, text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_consume_mfa_recovery_code(UUID, text, integer, integer, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.ocade_count_mfa_recovery_codes(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_count_mfa_recovery_codes(UUID)
  TO service_role;

COMMENT ON TABLE public.ocade_mfa_recovery_codes IS
  'Single-use factor-reset credentials. Stores only HMAC-SHA256 hashes under a server-held pepper, never plaintext. Not a login factor: a code entitles an already-authenticated AAL1 session to have a lost TOTP factor removed, and grants no access to account data.';

COMMENT ON TABLE public.ocade_mfa_recovery_attempts IS
  'Durable guess counter for recovery codes. Lives in the database rather than in an isolate because a per-worker in-memory limiter multiplies every quota by the number of workers and resets on recycle.';

COMMIT;
