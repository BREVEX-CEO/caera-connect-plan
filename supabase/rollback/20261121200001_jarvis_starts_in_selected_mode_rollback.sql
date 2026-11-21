BEGIN;

DROP FUNCTION public.jarvis_open_task_with_mode(uuid, uuid, uuid, text, jsonb, jsonb, text, uuid);

CREATE OR REPLACE FUNCTION public.jarvis_set_task_mode(p_user uuid, p_task uuid, p_mode text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  IF p_mode NOT IN ('live', 'background', 'rehearsal') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = '22023';
  END IF;
  UPDATE public.jarvis_tasks AS t SET mode = p_mode, updated_at = statement_timestamp()
   WHERE t.id = p_task AND t.user_id = p_user AND t.status IN ('running', 'waiting', 'taken_over');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_open' USING ERRCODE = 'P0002';
  END IF;
  RETURN p_mode;
END;
$$;

COMMIT;
