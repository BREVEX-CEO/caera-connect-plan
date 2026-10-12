-- One JARVIS task is one use, charged only when the server has recorded it completed
-- (owner decision, 13 October 2026; PLAN P05/P18).
--
-- Before: every model turn of a task was charged as a use, so one real task spent
-- 28 uses (a whole Free session) and still had not finished. Now:
--
-- 1. A JARVIS permit settled while its account has a task open, or one that finished
--    in the last ten minutes, belongs to that task and costs nothing. A task holds at
--    most 150 such turns: past that, turns are charged as ordinary requests, so one
--    request cannot become unlimited work.
-- 2. The turn that starts a task is settled before the task exists. The boundary, which
--    sees the model's reply, settles a JARVIS turn whose reply calls start_task at cost
--    0 (only the server holds the key that settles permits).
-- 3. When the server records a task completed — only the server can, after checking
--    what the device read back (20261012090000) — exactly one use is charged, once:
--    `ocade_jarvis_task_charges` has one row per task, so a replayed, refreshed or
--    concurrent completion charges nothing more. Failed, stopped or unverified tasks
--    are never charged.
-- 4. A JARVIS answer with no task is one request, charged as before.
BEGIN;

ALTER TABLE public.ocade_generation_permits
  ADD COLUMN IF NOT EXISTS task_id uuid;
CREATE INDEX IF NOT EXISTS ocade_generation_permits_task_idx
  ON public.ocade_generation_permits (task_id) WHERE task_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ocade_jarvis_task_charges (
  task_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charged_hundredths bigint NOT NULL CHECK (charged_hundredths = 100),
  charged_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE public.ocade_jarvis_task_charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocade_jarvis_task_charges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ocade_jarvis_task_charges TO service_role;

/** The account's current session and week windows, as acquisition computes them. */
CREATE OR REPLACE FUNCTION public.ocade_usage_windows_now(p_user_id uuid)
RETURNS TABLE (session_start timestamptz, week_start timestamptz)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT u.created_at + FLOOR(GREATEST(0, EXTRACT(epoch FROM (statement_timestamp() - u.created_at))) / 23280)
           * INTERVAL '23280 seconds',
         u.created_at + FLOOR(GREATEST(0, EXTRACT(epoch FROM (statement_timestamp() - u.created_at))) / 604800)
           * INTERVAL '604800 seconds'
    FROM public.profiles AS u
   WHERE u.id = p_user_id
$$;
REVOKE ALL ON FUNCTION public.ocade_usage_windows_now(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_finalize_generation_permit(
  p_user_id uuid,
  p_idempotency_key text,
  p_cost_hundredths bigint
)
RETURNS TABLE (charged_hundredths bigint, outcome text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_permit record;
  v_total bigint;
  v_difference bigint;
  v_task uuid;
  v_now timestamptz := statement_timestamp();
BEGIN
  IF p_cost_hundredths IS NULL OR p_cost_hundredths < 0 OR p_cost_hundredths > 1000000000 THEN
    RAISE EXCEPTION 'invalid commercial usage cost' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
  PERFORM public.ocade_expire_commercial_permits(p_user_id, v_now);
  SELECT p.* INTO v_permit
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::bigint, 'missing'::text;
    RETURN;
  END IF;
  IF v_permit.status = 'succeeded' THEN
    RETURN QUERY SELECT v_permit.charged_hundredths, 'succeeded'::text;
    RETURN;
  END IF;
  IF v_permit.status <> 'reserved' THEN
    RETURN QUERY SELECT 0::bigint, v_permit.status::text;
    RETURN;
  END IF;

  v_total := CASE WHEN v_permit.tier = 'free' THEN 100
                  ELSE GREATEST(25, p_cost_hundredths) END;

  -- A turn of a task is part of that task's one use (charged when it completes): the
  -- turn that starts one (the boundary settles it at 0), and every turn while one is open.
  IF v_permit.surface = 'jarvis' AND p_cost_hundredths = 0 THEN
    v_total := 0;
  ELSIF v_permit.surface = 'jarvis' THEN
    SELECT t.id INTO v_task
      FROM public.jarvis_tasks AS t
     WHERE t.user_id = p_user_id
       AND (t.status IN ('running', 'waiting', 'taken_over')
            OR t.finished_at > v_now - INTERVAL '10 minutes')
       AND (SELECT count(*) FROM public.ocade_generation_permits AS q WHERE q.task_id = t.id) < 150
     ORDER BY t.updated_at DESC
     LIMIT 1;
    IF v_task IS NOT NULL THEN
      v_total := 0;
    END IF;
  END IF;

  v_difference := v_total - v_permit.reserved_hundredths;

  IF v_difference > 0 THEN
    PERFORM public.ocade_consume_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, v_difference, NULL
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_consume_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, v_difference, NULL
      );
    END IF;
  ELSIF v_difference < 0 THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, -v_difference
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, -v_difference
      );
    END IF;
  END IF;

  UPDATE public.ocade_generation_permits AS p
     SET status = 'succeeded', charged_hundredths = v_total, task_id = v_task,
         finalized_at = v_now, updated_at = v_now
   WHERE p.id = v_permit.id;

  RETURN QUERY SELECT v_total, 'succeeded'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_finalize_generation_permit(uuid, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_finalize_generation_permit(uuid, text, bigint)
  TO service_role;

/** A completed task is one use, charged exactly once. */
CREATE OR REPLACE FUNCTION public.jarvis_completed_task_is_one_use()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_windows record;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.ocade_jarvis_task_charges (task_id, user_id, charged_hundredths)
  VALUES (NEW.id, NEW.user_id, 100)
  ON CONFLICT (task_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN NEW; -- charged already
  END IF;
  SELECT * INTO v_windows FROM public.ocade_usage_windows_now(NEW.user_id);
  PERFORM public.ocade_consume_commercial_work(
    NEW.user_id, public.ocade_usage_window_kind('jarvis', 'session'), v_windows.session_start, 100, NULL
  );
  PERFORM public.ocade_consume_commercial_work(
    NEW.user_id, public.ocade_usage_window_kind('jarvis', 'week'), v_windows.week_start, 100, NULL
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_completed_task_is_one_use() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS jarvis_completed_task_is_one_use ON public.jarvis_tasks;
CREATE TRIGGER jarvis_completed_task_is_one_use
AFTER UPDATE OF status ON public.jarvis_tasks
FOR EACH ROW EXECUTE FUNCTION public.jarvis_completed_task_is_one_use();

COMMIT;
