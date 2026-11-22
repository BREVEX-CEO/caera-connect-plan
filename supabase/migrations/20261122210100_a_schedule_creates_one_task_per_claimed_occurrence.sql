BEGIN;

ALTER TABLE public.jarvis_schedules ADD COLUMN claim_token uuid;

-- A reclaim gets a new lease even if it is for the same occurrence. Editors
-- and Pause already clear both claimed timestamps, invalidating the lease.
DROP FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer);
CREATE FUNCTION public.jarvis_claim_due_schedules(p_now timestamptz, p_limit integer)
RETURNS TABLE (
  id uuid, user_id uuid, what text, repeat text, time_zone text,
  occurrence timestamptz, claim_token uuid, occurrence_key text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
SET timezone TO 'UTC'
AS $$
  UPDATE public.jarvis_schedules AS s
     SET claimed_at = p_now, claimed_occurrence = coalesce(s.claimed_occurrence, s.next_at),
         claim_token = gen_random_uuid()
   WHERE s.id IN (
     SELECT d.id FROM public.jarvis_schedules AS d
      WHERE d.active
        AND d.next_at <= p_now
        AND (d.claimed_at IS NULL OR d.claimed_at < p_now - interval '10 minutes')
      ORDER BY d.next_at
      LIMIT least(greatest(p_limit, 1), 50)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING s.id, s.user_id, s.what, s.repeat, s.time_zone, s.claimed_occurrence, s.claim_token,
            'schedule:' || s.id::text || ':' || (to_json(s.claimed_occurrence) #>> '{}');
$$;
REVOKE ALL ON FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer) TO service_role;

-- A reminder or task and its occurrence are persisted together. Retry finds
-- that same task even after it finished. Use only the locked schedule's scope.
CREATE FUNCTION public.jarvis_run_schedule(
  p_user uuid, p_id uuid, p_occurrence timestamptz, p_claim_token uuid, p_online_consent_version text
)
RETURNS TABLE (task_id uuid, wake_needed boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
SET timezone TO 'UTC'
AS $$
DECLARE
  v_schedule public.jarvis_schedules%ROWTYPE;
  v_key text;
  v_task record;
BEGIN
  SELECT s.* INTO v_schedule
    FROM public.jarvis_schedules AS s
   WHERE s.id = p_id AND s.user_id = p_user AND s.active
     AND s.claimed_occurrence = p_occurrence AND s.claim_token = p_claim_token
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- Keep the previous PostgREST timestamp representation in occurrence keys.
  v_key := 'schedule:' || p_id::text || ':' || (to_json(p_occurrence) #>> '{}');
  IF v_schedule.device_id IS NULL THEN
    INSERT INTO public.ocade_messages (conversation_id, user_id, role, content, client_key)
    VALUES (v_schedule.conversation_id, p_user, 'assistant', 'Reminder: ' || v_schedule.what, v_key)
    ON CONFLICT (user_id, client_key) DO NOTHING;
    RETURN QUERY SELECT NULL::uuid, false;
    RETURN;
  END IF;

  SELECT t.id, t.status INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.schedule_occurrence = v_key AND t.user_id = p_user;
  IF FOUND THEN
    RETURN QUERY SELECT v_task.id, v_task.status = 'running' AND NOT EXISTS (
      SELECT 1 FROM public.jarvis_activity AS a WHERE a.task_id = v_task.id
    );
    RETURN;
  END IF;
  IF NOT public.jarvis_online_consented(p_user, p_online_consent_version) THEN
    RAISE EXCEPTION 'online_not_consented' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v_task FROM public.jarvis_open_task(
    p_user, v_schedule.conversation_id, v_schedule.device_id, v_schedule.what, NULL, '[]'::jsonb
  );
  IF v_task.reused THEN
    -- A manual task with the same objective is still its own task.
    RAISE EXCEPTION 'busy' USING ERRCODE = '55P03';
  END IF;
  UPDATE public.jarvis_tasks AS t SET schedule_occurrence = v_key WHERE t.id = v_task.task_id;
  RETURN QUERY SELECT v_task.task_id, true;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_run_schedule(uuid, uuid, timestamptz, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_run_schedule(uuid, uuid, timestamptz, uuid, text) TO service_role;

DROP FUNCTION public.jarvis_finish_schedule(uuid, timestamptz, timestamptz, text);
CREATE FUNCTION public.jarvis_finish_schedule(
  p_id uuid, p_occurrence timestamptz, p_claim_token uuid, p_next_at timestamptz, p_outcome text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.jarvis_schedules
     SET last_run_at = p_occurrence,
         last_outcome = left(p_outcome, 300),
         next_at = coalesce(p_next_at, next_at),
         active = p_next_at IS NOT NULL,
         claimed_at = NULL, claimed_occurrence = NULL, claim_token = NULL
   WHERE id = p_id AND active AND claimed_occurrence = p_occurrence AND claim_token = p_claim_token;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_finish_schedule(uuid, timestamptz, uuid, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_finish_schedule(uuid, timestamptz, uuid, timestamptz, text)
  TO service_role;

-- Pause or removal cancels work still queued by this watch, including a held
-- occurrence. Already admitted tasks and their receipts remain available.
CREATE FUNCTION public.jarvis_cancel_pending_watch_schedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM public.jarvis_schedules AS s
   WHERE s.watch_id = OLD.id AND s.user_id = OLD.user_id AND s.active;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_cancel_pending_watch_schedules() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER jarvis_watch_pause_cancels_pending_work
  BEFORE UPDATE OF active ON public.jarvis_watches
  FOR EACH ROW WHEN (OLD.active AND NOT NEW.active)
  EXECUTE FUNCTION public.jarvis_cancel_pending_watch_schedules();
CREATE TRIGGER jarvis_watch_delete_cancels_pending_work
  BEFORE DELETE ON public.jarvis_watches FOR EACH ROW
  EXECUTE FUNCTION public.jarvis_cancel_pending_watch_schedules();

COMMIT;
