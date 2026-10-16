-- Undo 20261016100000: queueing checks only that the task is not completed (20261016090000).
BEGIN;
CREATE OR REPLACE FUNCTION public.jarvis_no_action_after_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.status NOT IN ('queued', 'claimed', 'needs_confirmation') OR NEW.task_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT t.status INTO v_status FROM public.jarvis_tasks AS t WHERE t.id = NEW.task_id FOR SHARE;
  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'That task is completed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_no_action_after_completion() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.jarvis_activity DROP COLUMN IF EXISTS controller;
COMMIT;
