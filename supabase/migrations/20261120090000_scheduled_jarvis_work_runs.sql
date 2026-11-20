-- REPO-60/70, plan Part 27: scheduled JARVIS work and reminders actually run. The table and the
-- every-minute cron existed with no consumer. These are the server-only steps the cron and the
-- website use: save a schedule after checking the conversation and computer are the person's;
-- pause or resume one; claim due occurrences exactly once; finish an occurrence with its outcome
-- and the next run (computed by the server in the person's time zone). Every run starts a NEW
-- task with fresh permission checks; nothing here grants or replays an authorization.
BEGIN;

-- Save (create or edit) one schedule for one person. The id is null to create.
CREATE FUNCTION public.jarvis_save_schedule(
  p_user uuid,
  p_id uuid,
  p_conversation uuid,
  p_device uuid,
  p_what text,
  p_next_at timestamptz,
  p_repeat text,
  p_zone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ocade_conversations
     WHERE id = p_conversation AND user_id = p_user AND surface = 'jarvis'
  ) THEN
    RAISE EXCEPTION 'schedule_conversation_unavailable';
  END IF;
  IF p_device IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.jarvis_devices
     WHERE id = p_device AND user_id = p_user AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'schedule_device_unavailable';
  END IF;
  IF p_next_at < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'schedule_in_past';
  END IF;
  IF p_id IS NULL THEN
    IF (SELECT count(*) FROM public.jarvis_schedules WHERE user_id = p_user) >= 50 THEN
      RAISE EXCEPTION 'schedule_limit';
    END IF;
    INSERT INTO public.jarvis_schedules
      (user_id, conversation_id, device_id, what, next_at, repeat, time_zone)
    VALUES (p_user, p_conversation, p_device, btrim(p_what), p_next_at, p_repeat, p_zone)
    RETURNING id INTO v_id;
  ELSE
    -- An edit is a fresh schedule from now on: any claim of the old time is dropped.
    UPDATE public.jarvis_schedules
       SET conversation_id = p_conversation, device_id = p_device, what = btrim(p_what),
           next_at = p_next_at, repeat = p_repeat, time_zone = p_zone, active = true,
           claimed_at = NULL, claimed_occurrence = NULL
     WHERE id = p_id AND user_id = p_user
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'schedule_not_found';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_save_schedule(uuid, uuid, uuid, uuid, text, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_save_schedule(uuid, uuid, uuid, uuid, text, timestamptz, text, text)
  TO service_role;

-- Pause or resume one of the person's schedules. Resuming takes the next future run.
CREATE FUNCTION public.jarvis_set_schedule_active(
  p_user uuid,
  p_id uuid,
  p_active boolean,
  p_next_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.jarvis_schedules
     SET active = p_active,
         next_at = CASE WHEN p_active AND p_next_at IS NOT NULL THEN p_next_at ELSE next_at END,
         claimed_at = NULL, claimed_occurrence = NULL
   WHERE id = p_id AND user_id = p_user;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_set_schedule_active(uuid, uuid, boolean, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_set_schedule_active(uuid, uuid, boolean, timestamptz)
  TO service_role;

-- Claim due occurrences exactly once. A claim older than ten minutes was left by a run that
-- died, and is taken again; the occurrence key on the task stops a second task.
CREATE FUNCTION public.jarvis_claim_due_schedules(p_now timestamptz, p_limit integer)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  conversation_id uuid,
  device_id uuid,
  what text,
  repeat text,
  time_zone text,
  occurrence timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.jarvis_schedules AS s
     SET claimed_at = p_now,
         claimed_occurrence = coalesce(s.claimed_occurrence, s.next_at)
   WHERE s.id IN (
     SELECT d.id FROM public.jarvis_schedules AS d
      WHERE d.active
        AND d.next_at <= p_now
        AND (d.claimed_at IS NULL OR d.claimed_at < p_now - interval '10 minutes')
      ORDER BY d.next_at
      LIMIT least(greatest(p_limit, 1), 50)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING s.id, s.user_id, s.conversation_id, s.device_id, s.what, s.repeat, s.time_zone,
            s.claimed_occurrence;
$$;
REVOKE ALL ON FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer) TO service_role;

-- Finish a claimed occurrence: record what happened and move to the next run, or end a
-- one-time schedule. Only the claim of that exact occurrence can finish it.
CREATE FUNCTION public.jarvis_finish_schedule(
  p_id uuid,
  p_occurrence timestamptz,
  p_next_at timestamptz,
  p_outcome text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.jarvis_schedules
     SET last_run_at = p_occurrence,
         last_outcome = left(p_outcome, 300),
         next_at = coalesce(p_next_at, next_at),
         active = active AND p_next_at IS NOT NULL,
         claimed_at = NULL,
         claimed_occurrence = NULL
   WHERE id = p_id AND claimed_occurrence = p_occurrence;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_finish_schedule(uuid, timestamptz, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_finish_schedule(uuid, timestamptz, timestamptz, text)
  TO service_role;

COMMIT;
