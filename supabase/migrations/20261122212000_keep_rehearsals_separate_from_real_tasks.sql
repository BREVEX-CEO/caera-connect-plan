BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_open_task_with_mode(
  p_user uuid, p_conversation uuid, p_device uuid, p_title text, p_outcome jsonb, p_plan jsonb,
  p_mode text, p_session uuid DEFAULT NULL
)
RETURNS TABLE (task_id uuid, status text, controller uuid, reused boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_open record;
  v_mode text;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('live', 'background', 'rehearsal') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO STRICT v_open FROM public.jarvis_open_task(
    p_user, p_conversation, p_device, p_title, p_outcome, p_plan, p_session
  );
  IF v_open.reused THEN
    SELECT t.mode INTO v_mode FROM public.jarvis_tasks AS t WHERE t.id = v_open.task_id FOR UPDATE;
    IF v_mode IS DISTINCT FROM p_mode THEN
      RAISE EXCEPTION 'busy' USING ERRCODE = '55P03';
    END IF;
  ELSIF p_mode <> 'live' THEN
    UPDATE public.jarvis_tasks AS t SET mode = p_mode WHERE t.id = v_open.task_id;
  END IF;
  RETURN QUERY SELECT v_open.task_id, v_open.status, v_open.controller, v_open.reused;
END;
$$;

CREATE OR REPLACE FUNCTION public.jarvis_set_task_mode(p_user uuid, p_task uuid, p_mode text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_mode text;
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('live', 'background', 'rehearsal') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = '22023';
  END IF;
  SELECT t.mode INTO v_mode FROM public.jarvis_tasks AS t
   WHERE t.id = p_task AND t.user_id = p_user AND t.status IN ('running', 'waiting', 'taken_over')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_open' USING ERRCODE = 'P0002';
  END IF;
  -- Rehearsal has different action rules. An existing task must never acquire
  -- another mode's already admitted actions or promote its rehearsal receipts.
  IF v_mode <> p_mode AND 'rehearsal' IN (v_mode, p_mode) THEN
    RAISE EXCEPTION 'rehearsal_mode_fixed' USING ERRCODE = '55000';
  END IF;
  -- Claim and queue take the same task lock. A change to Background cannot
  -- promise to leave the controls alone while an existing Live step can still run.
  IF p_mode = 'background' AND v_mode <> p_mode AND EXISTS (
    SELECT 1 FROM public.jarvis_activity AS a
     WHERE a.task_id = p_task AND a.status IN ('queued', 'claimed', 'needs_confirmation')
       AND a.action ->> 'operation' IN ('ui.send_keys', 'ui.click_point', 'apps.launch')
  ) THEN
    RAISE EXCEPTION 'live_mode_in_use' USING ERRCODE = '55000';
  END IF;
  UPDATE public.jarvis_tasks AS t SET mode = p_mode, updated_at = statement_timestamp()
   WHERE t.id = p_task;
  RETURN p_mode;
END;
$$;

-- Verifier checks have their own nested targets. Keep this fence at activity
-- admission so an ordinary read classification cannot authorize live verification.
CREATE FUNCTION public.jarvis_guard_rehearsal_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.jarvis_tasks AS t WHERE t.id = NEW.task_id AND t.mode = 'rehearsal'
  ) AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.action #> '{arguments,checks}') AS c(check_value)
     WHERE coalesce(c.check_value ->> 'kind', '') NOT IN (
       'file_exists', 'file_contains', 'file_parses', 'workbook_cell_equals', 'media_duration',
       'media_quality', 'image_size', 'scene_render', 'script_runnable', 'workbook_formula',
       'document_headings', 'changes_within', 'workbook_range_equals', 'image_changed_within'
     )
  ) THEN
    RAISE EXCEPTION 'rehearsal_only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_guard_rehearsal_verification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER jarvis_rehearsal_verification
  BEFORE INSERT OR UPDATE OF action ON public.jarvis_activity
  FOR EACH ROW WHEN (NEW.action ->> 'operation' = 'verify.checks')
  EXECUTE FUNCTION public.jarvis_guard_rehearsal_verification();

COMMIT;
