-- An idle companion learns that work is waiting within about a second instead of at its next
-- poll (plan W2, D8). The database sends a CONTENT-FREE Realtime broadcast to a random
-- per-device topic whenever a step is queued for the device or its task changes state. The
-- broadcast carries no data and grants nothing: the companion answers it only by making its
-- usual signed claim, so a forged, replayed or lost nudge changes nothing but timing.
-- No applied migration is edited.
BEGIN;

-- 122 random bits; known only to the server, the device it was handed to and the owner.
ALTER TABLE public.jarvis_devices ADD COLUMN IF NOT EXISTS nudge_topic text
  NOT NULL DEFAULT ('jarvis-' || replace(gen_random_uuid()::text, '-', ''));

-- Handed to the signed companion with its inventory acknowledgement.
CREATE OR REPLACE FUNCTION public.jarvis_device_topic(p_device uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT d.nudge_topic FROM public.jarvis_devices AS d
   WHERE d.id = p_device AND d.user_id IS NOT NULL AND d.revoked_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.jarvis_device_topic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_device_topic(uuid) TO service_role;

-- Never lets a Realtime outage fail the change that triggered it: polling still finds the work.
CREATE OR REPLACE FUNCTION public.jarvis_nudge_device()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_task uuid := (to_jsonb(NEW) ->> CASE TG_TABLE_NAME WHEN 'jarvis_tasks' THEN 'id' ELSE 'task_id' END)::uuid;
  v_topic text;
BEGIN
  SELECT d.nudge_topic INTO v_topic
    FROM public.jarvis_tasks AS t JOIN public.jarvis_devices AS d ON d.id = t.device_id
   WHERE t.id = v_task AND d.revoked_at IS NULL;
  IF v_topic IS NOT NULL THEN
    BEGIN
      PERFORM realtime.send('{}'::jsonb, 'nudge', v_topic, false);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_nudge_device() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS jarvis_step_queued_nudges_device ON public.jarvis_activity;
CREATE TRIGGER jarvis_step_queued_nudges_device
  AFTER INSERT OR UPDATE OF status ON public.jarvis_activity
  FOR EACH ROW WHEN (NEW.status = 'queued')
  EXECUTE FUNCTION public.jarvis_nudge_device();

-- Running again, stopped, taken over, paused: the device rechecks at once (faster STOP too).
-- Completion follows the device's last receipt, so it has nothing to tell an idle device.
DROP TRIGGER IF EXISTS jarvis_task_state_nudges_device ON public.jarvis_tasks;
CREATE TRIGGER jarvis_task_state_nudges_device
  AFTER UPDATE OF status ON public.jarvis_tasks
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'completed')
  EXECUTE FUNCTION public.jarvis_nudge_device();

COMMIT;
