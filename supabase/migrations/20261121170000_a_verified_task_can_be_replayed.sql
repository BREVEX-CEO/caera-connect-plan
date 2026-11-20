-- DETERMINISTIC REPLAY (plan 14C ELITE-02 / VERIFY-05): a task JARVIS finished with every check
-- passed can be run again from the website. The new task carries the same fixed outcome checks
-- and a replay list of the file, document and media steps that worked; JARVIS queues those
-- steps one by one WITHOUT asking the model, each still permission-checked at queueing and
-- dispatch and revalidated on the computer, then the independent verifier checks the result.
-- At the first step that does not apply as recorded, replay stops and the planner continues
-- normally. The replay list is server-written only (this function) and bounded.
BEGIN;

CREATE FUNCTION public.jarvis_set_replay(p_task uuid, p_controller uuid, p_replay jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  IF jsonb_typeof(p_replay) <> 'array' OR jsonb_array_length(p_replay) NOT BETWEEN 1 AND 30
     OR pg_column_size(p_replay) > 60000
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_replay) AS r
                 WHERE jsonb_typeof(r) <> 'object' OR coalesce(r ->> 'operation', '') !~
                   '^(fs\.(list|read_text|write_text|manage)|office\.(inspect_workbook|write_document|write_workbook|write_presentation)|media\.(inspect|trim|preview|analyze|render_timeline)|image\.edit|scene\.render|system\.inspect)$'
                    OR jsonb_typeof(r -> 'arguments') <> 'object') THEN
    RAISE EXCEPTION 'invalid_replay' USING ERRCODE = '22023';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET checkpoint = coalesce(t.checkpoint, '{}'::jsonb) || jsonb_build_object('replay', p_replay),
         updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.status = 'running' AND t.controller = p_controller
     AND NOT EXISTS (SELECT 1 FROM public.jarvis_activity AS a WHERE a.task_id = t.id AND a.action IS NOT NULL);
  RETURN FOUND;
END;
$$;
-- The computer a task ran on, for running it again there.
CREATE FUNCTION public.jarvis_task_device(p_task uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT t.device_id FROM public.jarvis_tasks AS t WHERE t.id = p_task;
$$;
REVOKE ALL ON FUNCTION public.jarvis_task_device(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_task_device(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.jarvis_set_replay(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_set_replay(uuid, uuid, jsonb) TO service_role;

COMMIT;
