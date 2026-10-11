-- Undo: app rules are ASCII again. Rows naming apps in other scripts must be removed first.
BEGIN;
ALTER TABLE public.jarvis_permissions DROP CONSTRAINT IF EXISTS jarvis_permissions_capability_check;
ALTER TABLE public.jarvis_permissions ADD CONSTRAINT jarvis_permissions_capability_check CHECK (
  capability IN ('master', 'memory', 'autonomous', 'browser', 'browser_real', 'files',
    'screen', 'microphone', 'camera', 'apps', 'messaging', 'devices', 'computer_control',
    'terminal', 'cowork')
  OR capability ~ '^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'
  OR capability ~ '^app:[a-z0-9_ .+&()''-]{1,80}$'
);
COMMIT;
