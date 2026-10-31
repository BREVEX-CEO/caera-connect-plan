-- Removes the server-only JARVIS task authority functions and restores the browser's
-- earlier direct INSERT/UPDATE grant on jarvis_tasks. Existing tasks and activity stay.
BEGIN;

DROP FUNCTION IF EXISTS public.jarvis_note_model(uuid, integer);
DROP FUNCTION IF EXISTS public.jarvis_revoke_device(uuid, uuid);
DROP FUNCTION IF EXISTS public.jarvis_task_state(uuid);
DROP FUNCTION IF EXISTS public.jarvis_device_inventory(uuid, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_task_wait(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.jarvis_resume_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.jarvis_take_over(uuid, uuid);
DROP FUNCTION IF EXISTS public.jarvis_confirm_action(uuid, uuid);
DROP FUNCTION IF EXISTS public.jarvis_device_key(uuid);
DROP FUNCTION IF EXISTS public.jarvis_settle_task(uuid, uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.jarvis_stop_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.jarvis_submit_receipt(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_claim_action(uuid);
DROP FUNCTION IF EXISTS public.jarvis_queue_actions(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_open_task(uuid, uuid, uuid, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_device_seen(uuid, bigint);
DROP FUNCTION IF EXISTS public.jarvis_approve_device(uuid, text);
DROP FUNCTION IF EXISTS public.jarvis_enroll_device(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.jarvis_device_code(text);
DROP FUNCTION IF EXISTS public.jarvis_tell(uuid, text);
DROP FUNCTION IF EXISTS public.jarvis_grants(uuid, uuid);
DROP FUNCTION IF EXISTS public.jarvis_action_allowed(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.jarvis_allowed(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.jarvis_paused();
DROP INDEX IF EXISTS public.jarvis_activity_one_action_per_key;
ALTER TABLE public.jarvis_tasks DROP COLUMN IF EXISTS paused_at, DROP COLUMN IF EXISTS user_wait_ms,
  DROP COLUMN IF EXISTS model_calls, DROP COLUMN IF EXISTS model_ms;
ALTER TABLE public.jarvis_activity DROP COLUMN IF EXISTS confirmed_at;
GRANT INSERT, UPDATE ON public.jarvis_tasks TO authenticated;
UPDATE public.jarvis_devices SET capabilities = capabilities - 'mcp' - 'engines';
DELETE FROM public.jarvis_permissions WHERE capability = 'mcp' OR capability LIKE 'mcp:%';
ALTER TABLE public.jarvis_permissions DROP CONSTRAINT IF EXISTS jarvis_permissions_capability_check;
ALTER TABLE public.jarvis_permissions ADD CONSTRAINT jarvis_permissions_capability_check CHECK (
  capability IN ('master', 'memory', 'autonomous', 'browser', 'browser_real', 'files', 'screen',
                 'microphone', 'camera', 'apps', 'messaging', 'devices', 'computer_control',
                 'terminal', 'cowork')
  OR capability ~ '^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'
  OR (capability ~ '^app:[^[:cntrl:]]{1,80}$' AND capability !~ '[‎‏‪-‮⁦-⁩]')
);

COMMIT;
