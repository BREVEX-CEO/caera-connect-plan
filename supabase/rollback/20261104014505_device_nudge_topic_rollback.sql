-- Rollback of 20261104014505_device_nudge_topic.sql: restores what it replaced and removes what it added.
-- Data in removed columns is lost; nothing else changes.
BEGIN;

DROP TRIGGER IF EXISTS jarvis_step_queued_nudges_device ON public.jarvis_activity;
DROP TRIGGER IF EXISTS jarvis_task_state_nudges_device ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_device_topic(uuid);

DROP FUNCTION IF EXISTS public.jarvis_nudge_device();

ALTER TABLE public.jarvis_devices DROP COLUMN IF EXISTS nudge_topic;

COMMIT;
