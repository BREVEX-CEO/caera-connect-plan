-- JARVIS task authority (plan.md P02/P03): the server-only lifecycle the new engine uses.
--
-- ONE TASK SYSTEM. Reuses `jarvis_tasks` (task, fixed outcome checks, controller, checkpoint),
-- `jarvis_activity` (the action queue and customer-safe events) and `jarvis_devices` (P-256
-- identity). Every guard the earlier migrations installed stays in force: completion is the
-- server's, matches its checked action count, cannot revive a stopped task, and no action
-- can be queued for a task that is not running or by a stale controller.
--
-- THE BROWSER READS; THE SERVER WRITES. Each function below is callable only by the
-- service role, after the web server has proved the signed-in session or the device's
-- signature. The browser keeps SELECT on its own rows through row-level security.
--
-- A CONTROLLER IS A FENCE. `jarvis_tasks.controller` is the epoch for the current
-- planning turn. STOP clears it, so every planner holding the old one is refused at once.

BEGIN;

-- 1. The browser can no longer write task state directly --------------------------------

REVOKE INSERT, UPDATE ON public.jarvis_tasks FROM authenticated;

-- One action per idempotency key per task: two planners racing cannot queue it twice.
CREATE UNIQUE INDEX IF NOT EXISTS jarvis_activity_one_action_per_key
  ON public.jarvis_activity (task_id, (action ->> 'key'))
  WHERE action IS NOT NULL;

-- Task timing (plan.md M3). Durable UTC facts only: time paused on the person, and
-- the number and duration of planning model calls. Step durations come from the
-- device's own monotonic measurement in each receipt.
ALTER TABLE public.jarvis_tasks
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_wait_ms bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model_ms bigint NOT NULL DEFAULT 0;
ALTER TABLE public.jarvis_activity ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Approved external MCP servers are granted per server: `mcp` (the kind) and `mcp:<id>`.
ALTER TABLE public.jarvis_permissions DROP CONSTRAINT IF EXISTS jarvis_permissions_capability_check;
ALTER TABLE public.jarvis_permissions ADD CONSTRAINT jarvis_permissions_capability_check CHECK (
  capability IN ('master', 'memory', 'autonomous', 'browser', 'browser_real', 'files', 'screen',
                 'microphone', 'camera', 'apps', 'messaging', 'devices', 'computer_control',
                 'terminal', 'cowork', 'mcp')
  OR capability ~ '^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'
  OR (capability ~ '^app:[^[:cntrl:]]{1,80}$' AND capability !~ '[‎‏‪-‮⁦-⁩]')
  OR capability ~ '^mcp:[a-z][a-z0-9_]{1,30}$'
);

-- 2. Shared checks ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jarvis_paused()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_service_controls AS c
     WHERE c.key IN ('jarvis_execution', 'jarvis_agent') AND c.paused
  );
$$;

-- A device-specific decision overrides the account-wide one; no decision means no.
-- The master switch must be on as well.
CREATE OR REPLACE FUNCTION public.jarvis_allowed(p_user uuid, p_device uuid, p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT bool_and(coalesce((
    SELECT p.allowed FROM public.jarvis_permissions AS p
     WHERE p.user_id = p_user AND p.capability = wanted
       AND (p.device_id = p_device OR p.device_id IS NULL)
     ORDER BY p.device_id NULLS LAST
     LIMIT 1
  ), false))
  FROM unnest(ARRAY['master', p_capability]) AS wanted;
$$;

-- An action's own capability, plus the exact app or website it targets.
CREATE OR REPLACE FUNCTION public.jarvis_action_allowed(p_user uuid, p_device uuid, p_action jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT public.jarvis_allowed(p_user, p_device, p_action ->> 'capability')
     AND (p_action -> 'target' ->> 'app' IS NULL
          OR public.jarvis_allowed(p_user, p_device, 'app:' || (p_action -> 'target' ->> 'app')))
     AND (p_action -> 'target' ->> 'site' IS NULL
          OR public.jarvis_allowed(p_user, p_device, 'site:' || (p_action -> 'target' ->> 'site')))
     AND (p_action -> 'target' ->> 'mcp' IS NULL
          OR public.jarvis_allowed(p_user, p_device, 'mcp:' || (p_action -> 'target' ->> 'mcp')));
$$;

-- Everything a person has turned on for one device (and account-wide), for planning and display.
CREATE OR REPLACE FUNCTION public.jarvis_grants(p_user uuid, p_device uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(DISTINCT p.capability), '[]'::jsonb)
    FROM public.jarvis_permissions AS p
   WHERE p.user_id = p_user AND (p.device_id = p_device OR p.device_id IS NULL)
     AND public.jarvis_allowed(p_user, p_device, p.capability);
$$;

-- 3. Device enrollment, approval and revocation -------------------------------------------

-- The code a device shows and its owner types: the first 16 hex digits of its key's hash.
CREATE OR REPLACE FUNCTION public.jarvis_device_code(p_public_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT upper(left(encode(extensions.digest(p_public_key, 'sha256'), 'hex'), 16));
$$;

CREATE OR REPLACE FUNCTION public.jarvis_enroll_device(
  p_public_key text, p_name text, p_platform text, p_software_version text, p_source text
)
RETURNS TABLE (device_id uuid, code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_id uuid;
  v_expires timestamptz := statement_timestamp() + interval '10 minutes';
BEGIN
  DELETE FROM public.jarvis_devices AS d
   WHERE d.user_id IS NULL AND d.enrollment_expires_at < statement_timestamp();
  IF (SELECT count(*) FROM public.jarvis_devices AS d
       WHERE d.user_id IS NULL AND d.enrollment_source = p_source) >= 5 THEN
    RAISE EXCEPTION 'too_many_enrollments' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.jarvis_devices (
    user_id, name, platform, kind, public_key, software_version,
    enrollment_expires_at, enrollment_source
  ) VALUES (
    NULL, p_name, p_platform, 'agent', p_public_key, p_software_version, v_expires, p_source
  ) RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, public.jarvis_device_code(p_public_key), v_expires;
END;
$$;

-- The signed-in owner types the device's code. A code is one-use and expires.
CREATE OR REPLACE FUNCTION public.jarvis_approve_device(p_user uuid, p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.jarvis_devices AS d
     SET user_id = p_user, enrollment_expires_at = NULL, last_seen_at = statement_timestamp()
   WHERE d.id = (
     SELECT p.id FROM public.jarvis_devices AS p
      WHERE p.user_id IS NULL
        AND p.enrollment_expires_at > statement_timestamp()
        AND public.jarvis_device_code(p.public_key) = upper(btrim(p_code))
      ORDER BY p.created_at
      LIMIT 1
      FOR UPDATE)
  RETURNING d.id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'unknown_code' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_id;
END;
$$;

-- A signed request is accepted once: its timestamp must exceed the last one seen.
CREATE OR REPLACE FUNCTION public.jarvis_device_seen(p_device uuid, p_timestamp_ms bigint)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH seen AS (
    UPDATE public.jarvis_devices AS d
       SET last_request_ms = p_timestamp_ms, last_seen_at = statement_timestamp()
     WHERE d.id = p_device AND d.revoked_at IS NULL AND d.last_request_ms < p_timestamp_ms
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM seen);
$$;

-- The key that verifies an approved, unrevoked device's signatures.
CREATE OR REPLACE FUNCTION public.jarvis_device_key(p_device uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT d.public_key FROM public.jarvis_devices AS d
   WHERE d.id = p_device AND d.user_id IS NOT NULL AND d.revoked_at IS NULL;
$$;

-- JARVIS's answer lands in the task's own conversation once, whoever is watching.
CREATE OR REPLACE FUNCTION public.jarvis_tell(p_task uuid, p_text text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  INSERT INTO public.ocade_messages (conversation_id, user_id, role, content, client_key)
  SELECT t.conversation_id, t.user_id, 'assistant', p_text, 'jarvis:' || t.id || ':' || t.status
    FROM public.jarvis_tasks AS t WHERE t.id = p_task
  ON CONFLICT (user_id, client_key) DO NOTHING;
$$;

-- 4. Task lifecycle -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jarvis_open_task(
  p_user uuid, p_conversation uuid, p_device uuid, p_title text, p_outcome jsonb, p_plan jsonb
)
RETURNS TABLE (task_id uuid, status text, controller uuid, reused boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_open record;
BEGIN
  IF public.jarvis_paused() THEN
    RAISE EXCEPTION 'jarvis_paused' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ocade_conversations AS c
                  WHERE c.id = p_conversation AND c.user_id = p_user AND c.surface = 'jarvis') THEN
    RAISE EXCEPTION 'conversation_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jarvis_devices AS d
                  WHERE d.id = p_device AND d.user_id = p_user AND d.revoked_at IS NULL
                    AND d.kind = 'agent') THEN
    RAISE EXCEPTION 'device_unavailable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.jarvis_allowed(p_user, p_device, 'files') THEN
    RAISE EXCEPTION 'permission_required' USING ERRCODE = '42501';
  END IF;

  -- A repeated Send returns the task it already opened; a different one waits its turn.
  SELECT t.id, t.status, t.controller, t.title, t.conversation_id INTO v_open
    FROM public.jarvis_tasks AS t
   WHERE (t.conversation_id = p_conversation OR t.device_id = p_device)
     AND t.status IN ('running', 'waiting', 'taken_over')
   LIMIT 1;
  IF FOUND THEN
    IF v_open.conversation_id = p_conversation AND v_open.title = btrim(p_title) THEN
      RETURN QUERY SELECT v_open.id, v_open.status, v_open.controller, true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'busy' USING ERRCODE = '55P03';
  END IF;

  RETURN QUERY
  INSERT INTO public.jarvis_tasks AS t (
    user_id, conversation_id, device_id, title, plan, outcome, status, controller, checkpoint
  ) VALUES (
    p_user, p_conversation, p_device, btrim(p_title), p_plan, p_outcome, 'running',
    gen_random_uuid(), jsonb_build_object('phase', 'planning')
  ) RETURNING t.id, t.status, t.controller, false;
END;
$$;

-- Queue the planner's next actions under its controller. Each action carries `key`,
-- `capability`, `risk` and `operation`; the web server validated the full shape.
CREATE OR REPLACE FUNCTION public.jarvis_queue_actions(p_task uuid, p_controller uuid, p_actions jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_item jsonb;
  v_queued integer := 0;
BEGIN
  IF public.jarvis_paused() THEN
    RAISE EXCEPTION 'jarvis_paused' USING ERRCODE = '42501';
  END IF;
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t WHERE t.id = p_task FOR UPDATE;
  IF NOT FOUND OR v_task.status <> 'running' OR v_task.controller IS DISTINCT FROM p_controller THEN
    RAISE EXCEPTION 'stale_controller' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_actions) <> 'array' OR jsonb_array_length(p_actions) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid_actions' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_actions) LOOP
    -- Reads and reversible writes run; an external effect waits for the person; nothing else.
    IF v_item -> 'action' ->> 'risk' NOT IN ('read', 'reversible_write', 'external_effect') THEN
      RAISE EXCEPTION 'risk_not_supported' USING ERRCODE = '42501';
    END IF;
    IF NOT public.jarvis_action_allowed(v_task.user_id, v_task.device_id, v_item -> 'action') THEN
      RAISE EXCEPTION 'permission_required' USING ERRCODE = '42501';
    END IF;
    -- clock_timestamp: actions queued together keep their order (dispatch sorts by it).
    INSERT INTO public.jarvis_activity (user_id, task_id, device_id, summary, action, status, controller, created_at)
    VALUES (v_task.user_id, p_task, v_task.device_id, v_item ->> 'summary', v_item -> 'action',
            CASE WHEN v_item -> 'action' ->> 'risk' = 'external_effect' THEN 'needs_confirmation' ELSE 'queued' END,
            p_controller, clock_timestamp())
    ON CONFLICT (task_id, (action ->> 'key')) WHERE action IS NOT NULL DO NOTHING;
    IF FOUND THEN
      v_queued := v_queued + 1;
    END IF;
  END LOOP;
  UPDATE public.jarvis_tasks AS t SET updated_at = statement_timestamp() WHERE t.id = p_task;
  RETURN v_queued;
END;
$$;

-- The device asks for work. It receives the action it already holds (a restart claims
-- the same action again, never a second one), else the oldest queued action, else the
-- task's state so it can observe STOP.
CREATE OR REPLACE FUNCTION public.jarvis_claim_action(p_device uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_device record;
  v_task record;
  v_action record;
BEGIN
  SELECT d.* INTO v_device FROM public.jarvis_devices AS d
   WHERE d.id = p_device AND d.user_id IS NOT NULL AND d.revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'device_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT t.id, t.status, t.controller INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.device_id = p_device AND t.user_id = v_device.user_id
     AND t.status IN ('running', 'waiting', 'taken_over')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('task', NULL, 'action', NULL);
  END IF;
  IF v_task.status <> 'running' OR public.jarvis_paused() THEN
    RETURN jsonb_build_object('task', jsonb_build_object('id', v_task.id, 'status', v_task.status),
                              'action', NULL);
  END IF;

  SELECT a.id, a.action INTO v_action FROM public.jarvis_activity AS a
   WHERE a.task_id = v_task.id AND a.status = 'claimed'
   ORDER BY a.created_at LIMIT 1;
  IF NOT FOUND THEN
    SELECT a.id, a.action INTO v_action FROM public.jarvis_activity AS a
     WHERE a.task_id = v_task.id AND a.status = 'queued' AND a.controller = v_task.controller
     ORDER BY a.created_at, a.id LIMIT 1
     FOR UPDATE SKIP LOCKED;
    IF FOUND THEN
      -- Permission is rechecked at the moment of dispatch, not only when queued.
      IF NOT public.jarvis_action_allowed(v_device.user_id, p_device, v_action.action) THEN
        UPDATE public.jarvis_activity AS a
           SET status = 'blocked', completed_at = statement_timestamp(),
               result = jsonb_build_object('status', 'not_applied', 'errorCode', 'permission_revoked')
         WHERE a.id = v_action.id;
        UPDATE public.jarvis_tasks AS t
           SET status = 'blocked', blocker = 'A permission this task needs was turned off.',
               controller = NULL, finished_at = statement_timestamp(), updated_at = statement_timestamp()
         WHERE t.id = v_task.id;
        RETURN jsonb_build_object('task', jsonb_build_object('id', v_task.id, 'status', 'blocked'),
                                  'action', NULL);
      END IF;
      UPDATE public.jarvis_activity AS a SET status = 'claimed' WHERE a.id = v_action.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'task', jsonb_build_object('id', v_task.id, 'status', v_task.status),
    'action', CASE WHEN v_action.id IS NULL THEN NULL
                   ELSE jsonb_build_object('id', v_action.id, 'intent', v_action.action) END
  );
END;
$$;

-- The device reports what it observed. A receipt for an action STOP already cancelled is
-- still recorded: the effect may have happened, and the record must say so.
CREATE OR REPLACE FUNCTION public.jarvis_submit_receipt(p_device uuid, p_activity uuid, p_receipt jsonb)
RETURNS TABLE (outcome text, task_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_row record;
  v_status text;
BEGIN
  SELECT a.* INTO v_row FROM public.jarvis_activity AS a
   WHERE a.id = p_activity AND a.device_id = p_device
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_action' USING ERRCODE = 'P0002';
  END IF;
  v_status := CASE p_receipt ->> 'status'
    WHEN 'observed' THEN 'done'
    WHEN 'not_applied' THEN 'failed'
    WHEN 'unknown' THEN 'blocked'
  END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'invalid_receipt' USING ERRCODE = '22023';
  END IF;

  IF v_row.status = 'claimed' THEN
    UPDATE public.jarvis_activity AS a
       SET status = v_status, result = p_receipt, completed_at = statement_timestamp()
     WHERE a.id = p_activity;
    IF v_status = 'blocked' THEN
      -- An effect that may have happened is reconciled before anything else is tried.
      UPDATE public.jarvis_tasks AS t
         SET status = 'waiting', blocker = 'OCADE is checking whether a step took effect.',
             paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
       WHERE t.id = v_row.task_id AND t.status = 'running';
    ELSE
      UPDATE public.jarvis_tasks AS t SET updated_at = statement_timestamp() WHERE t.id = v_row.task_id;
    END IF;
    RETURN QUERY SELECT 'accepted'::text, v_row.task_id;
    RETURN;
  END IF;
  IF v_row.status = 'cancelled' AND v_row.result = '{"status": "unknown"}'::jsonb THEN
    UPDATE public.jarvis_activity AS a SET result = p_receipt WHERE a.id = p_activity;
    RETURN QUERY SELECT 'recorded_after_stop'::text, v_row.task_id;
    RETURN;
  END IF;
  IF v_row.result IS NOT DISTINCT FROM p_receipt THEN
    RETURN QUERY SELECT 'duplicate'::text, v_row.task_id;
    RETURN;
  END IF;
  RAISE EXCEPTION 'receipt_conflict' USING ERRCODE = '23505';
END;
$$;

-- STOP: fence the planner, cancel what has not started, account for what had.
CREATE OR REPLACE FUNCTION public.jarvis_stop_task(p_user uuid, p_task uuid)
RETURNS TABLE (status text, cancelled integer, in_flight integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_cancelled integer;
  v_in_flight integer;
BEGIN
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t
   WHERE t.id = p_task AND t.user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_task.status NOT IN ('running', 'waiting', 'taken_over') THEN
    RETURN QUERY SELECT v_task.status, 0, 0;
    RETURN;
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET status = 'stopped', controller = NULL, finished_at = statement_timestamp(),
         user_wait_ms = t.user_wait_ms
           + coalesce((extract(epoch FROM statement_timestamp() - t.paused_at) * 1000)::bigint, 0),
         paused_at = NULL,
         updated_at = statement_timestamp(),
         checkpoint = coalesce(t.checkpoint, '{}'::jsonb) || jsonb_build_object('phase', 'stopped')
   WHERE t.id = p_task;
  SELECT count(*) INTO v_in_flight FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.status = 'claimed';
  UPDATE public.jarvis_activity AS a
     SET status = 'cancelled', completed_at = statement_timestamp()
   WHERE a.task_id = p_task AND a.status IN ('queued', 'claimed', 'needs_confirmation');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  PERFORM public.jarvis_tell(p_task, CASE WHEN v_in_flight > 0
    THEN 'Stopped. A step that was already running on your computer may have finished; nothing new will start.'
    ELSE 'Stopped. Nothing more will run.' END);
  RETURN QUERY SELECT 'stopped'::text, v_cancelled - v_in_flight, v_in_flight;
END;
$$;

-- Settlement. Completion needs the independent verifier's pass on every fixed check;
-- anything less leaves the task blocked with what was and was not proved.
CREATE OR REPLACE FUNCTION public.jarvis_settle_task(
  p_task uuid, p_controller uuid, p_verification jsonb, p_summary text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task record;
  v_expected text[];
  v_passed text[];
  v_actions integer;
BEGIN
  SELECT t.* INTO v_task FROM public.jarvis_tasks AS t WHERE t.id = p_task FOR UPDATE;
  IF NOT FOUND OR v_task.status <> 'running' OR v_task.controller IS DISTINCT FROM p_controller THEN
    RAISE EXCEPTION 'stale_controller' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jarvis_activity AS a
              WHERE a.task_id = p_task AND a.status IN ('queued', 'claimed', 'needs_confirmation')) THEN
    RAISE EXCEPTION 'actions_open' USING ERRCODE = '55000';
  END IF;

  SELECT coalesce(array_agg(c ->> 'id' ORDER BY c ->> 'id'), '{}') INTO v_expected
    FROM jsonb_array_elements(coalesce(v_task.outcome, '[]'::jsonb)) AS c;
  SELECT coalesce(array_agg(DISTINCT p ORDER BY p), '{}') INTO v_passed
    FROM jsonb_array_elements_text(coalesce(p_verification -> 'passed', '[]'::jsonb)) AS p;
  SELECT count(*) INTO v_actions FROM public.jarvis_activity AS a
   WHERE a.task_id = p_task AND a.status <> 'note';

  IF cardinality(v_expected) > 0
     AND v_expected <@ v_passed
     AND jsonb_array_length(coalesce(p_verification -> 'failed', '[]'::jsonb)) = 0
     AND jsonb_array_length(coalesce(p_verification -> 'unverified', '[]'::jsonb)) = 0 THEN
    UPDATE public.jarvis_tasks AS t
       SET verified_actions = v_actions, status = 'completed', result = left(p_summary, 8000),
           controller = NULL, finished_at = statement_timestamp(), updated_at = statement_timestamp(),
           checkpoint = jsonb_build_object('phase', 'completed', 'verification', p_verification)
     WHERE t.id = p_task;
    PERFORM public.jarvis_tell(p_task, left(p_summary, 8000));
    RETURN 'completed';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET status = 'blocked', blocker = left(coalesce(p_summary, 'The result did not pass its checks.'), 300),
         controller = NULL, finished_at = statement_timestamp(), updated_at = statement_timestamp(),
         checkpoint = jsonb_build_object('phase', 'partial', 'verification', p_verification)
   WHERE t.id = p_task;
  PERFORM public.jarvis_tell(p_task, coalesce(p_summary, 'The result did not pass its checks.'));
  RETURN 'blocked';
END;
$$;

-- Everything the planner reads for one decision, in one consistent snapshot.
CREATE OR REPLACE FUNCTION public.jarvis_task_state(p_task uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'id', t.id, 'userId', t.user_id, 'status', t.status, 'controller', t.controller,
    'title', t.title, 'outcome', t.outcome, 'blocker', t.blocker, 'result', t.result,
    'checkpoint', t.checkpoint, 'conversationId', t.conversation_id,
    'deviceName', (SELECT d.name FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'apps', (SELECT d.installed_apps FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'mcp', (SELECT coalesce(d.capabilities -> 'mcp', '[]'::jsonb) FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'engines', (SELECT d.capabilities -> 'engines' FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'grants', public.jarvis_grants(t.user_id, t.device_id),
    'timing', jsonb_build_object(
      'acceptedAt', t.created_at, 'finishedAt', t.finished_at, 'now', statement_timestamp(),
      'pausedMs', t.user_wait_ms
        + coalesce((extract(epoch FROM coalesce(t.finished_at, statement_timestamp()) - t.paused_at) * 1000)::bigint, 0),
      'modelCalls', t.model_calls, 'modelMs', t.model_ms),
    'steps', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'summary', a.summary, 'intent', a.action,
                                          'status', a.status, 'receipt', a.result,
                                          'createdAt', a.created_at, 'completedAt', a.completed_at,
                                          'confirmedAt', a.confirmed_at)
                       ORDER BY a.created_at, a.id)
        FROM public.jarvis_activity AS a WHERE a.task_id = t.id AND a.action IS NOT NULL), '[]'::jsonb))
  FROM public.jarvis_tasks AS t WHERE t.id = p_task;
$$;

-- The planner cannot answer (outage, quota, no consent): the task waits, keeping its checkpoint.
CREATE OR REPLACE FUNCTION public.jarvis_task_wait(p_task uuid, p_controller uuid, p_reason text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  UPDATE public.jarvis_tasks AS t
     SET status = 'waiting', blocker = left(p_reason, 300), paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.status = 'running' AND t.controller = p_controller;
$$;

-- The person approves one action that has an effect outside the computer.
CREATE OR REPLACE FUNCTION public.jarvis_confirm_action(p_user uuid, p_activity uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH confirmed AS (
    UPDATE public.jarvis_activity AS a SET status = 'queued', confirmed = true, confirmed_at = statement_timestamp()
     WHERE a.id = p_activity AND a.user_id = p_user AND a.status = 'needs_confirmation'
       AND EXISTS (SELECT 1 FROM public.jarvis_tasks AS t
                    WHERE t.id = a.task_id AND t.status = 'running' AND t.controller = a.controller)
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM confirmed);
$$;

-- Take Over: the person has the computer. Nothing queued runs; a running step is
-- cancelled like STOP; the task stays open to resume.
CREATE OR REPLACE FUNCTION public.jarvis_take_over(p_user uuid, p_task uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.jarvis_tasks AS t
     SET status = 'taken_over', controller = NULL, paused_at = coalesce(t.paused_at, statement_timestamp()), updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.user_id = p_user AND t.status IN ('running', 'waiting');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.jarvis_activity AS a
     SET status = 'cancelled', completed_at = statement_timestamp()
   WHERE a.task_id = p_task AND a.status IN ('queued', 'claimed', 'needs_confirmation');
  RETURN 'taken_over';
END;
$$;

-- Resume after Take Over or after the person checked an uncertain step: a new
-- controller, so every decision made before is stale.
CREATE OR REPLACE FUNCTION public.jarvis_resume_task(p_user uuid, p_task uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_controller uuid := gen_random_uuid();
BEGIN
  IF public.jarvis_paused() THEN
    RAISE EXCEPTION 'jarvis_paused' USING ERRCODE = '42501';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET status = 'running', controller = v_controller, blocker = NULL,
         user_wait_ms = t.user_wait_ms
           + coalesce((extract(epoch FROM statement_timestamp() - t.paused_at) * 1000)::bigint, 0),
         paused_at = NULL, updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.user_id = p_user AND t.status IN ('taken_over', 'waiting')
     AND EXISTS (SELECT 1 FROM public.jarvis_devices AS d
                  WHERE d.id = t.device_id AND d.user_id = p_user AND d.revoked_at IS NULL);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_controller;
END;
$$;

-- The apps a device found installed, for the person's Allowed Apps choice and the planner.
CREATE OR REPLACE FUNCTION public.jarvis_device_inventory(p_device uuid, p_apps jsonb, p_mcp jsonb, p_engines jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  UPDATE public.jarvis_devices AS d
     SET installed_apps = p_apps,
         capabilities = d.capabilities || jsonb_build_object('mcp', p_mcp, 'engines', p_engines)
   WHERE d.id = p_device AND d.user_id IS NOT NULL AND d.revoked_at IS NULL;
$$;

-- One planning model call finished (or failed): counted against the task, never inferred.
CREATE OR REPLACE FUNCTION public.jarvis_note_model(p_task uuid, p_ms integer)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  UPDATE public.jarvis_tasks AS t
     SET model_calls = t.model_calls + 1, model_ms = t.model_ms + greatest(p_ms, 0)
   WHERE t.id = p_task;
$$;

-- Revoking a device stops its open task first, so nothing more is dispatched to it.
CREATE OR REPLACE FUNCTION public.jarvis_revoke_device(p_user uuid, p_device uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_task uuid;
BEGIN
  FOR v_task IN SELECT t.id FROM public.jarvis_tasks AS t
                 WHERE t.device_id = p_device AND t.user_id = p_user
                   AND t.status IN ('running', 'waiting', 'taken_over') LOOP
    PERFORM public.jarvis_stop_task(p_user, v_task);
  END LOOP;
  UPDATE public.jarvis_devices AS d SET revoked_at = statement_timestamp()
   WHERE d.id = p_device AND d.user_id = p_user AND d.revoked_at IS NULL;
  RETURN FOUND;
END;
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.jarvis_paused()',
    'public.jarvis_allowed(uuid, uuid, text)',
    'public.jarvis_action_allowed(uuid, uuid, jsonb)',
    'public.jarvis_tell(uuid, text)',
    'public.jarvis_grants(uuid, uuid)',
    'public.jarvis_task_wait(uuid, uuid, text)',
    'public.jarvis_confirm_action(uuid, uuid)',
    'public.jarvis_take_over(uuid, uuid)',
    'public.jarvis_resume_task(uuid, uuid)',
    'public.jarvis_device_inventory(uuid, jsonb, jsonb, jsonb)',
    'public.jarvis_device_code(text)',
    'public.jarvis_enroll_device(text, text, text, text, text)',
    'public.jarvis_approve_device(uuid, text)',
    'public.jarvis_device_seen(uuid, bigint)',
    'public.jarvis_device_key(uuid)',
    'public.jarvis_task_state(uuid)',
    'public.jarvis_open_task(uuid, uuid, uuid, text, jsonb, jsonb)',
    'public.jarvis_queue_actions(uuid, uuid, jsonb)',
    'public.jarvis_claim_action(uuid)',
    'public.jarvis_submit_receipt(uuid, uuid, jsonb)',
    'public.jarvis_stop_task(uuid, uuid)',
    'public.jarvis_settle_task(uuid, uuid, jsonb, text)',
    'public.jarvis_revoke_device(uuid, uuid)',
    'public.jarvis_note_model(uuid, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;

COMMIT;
