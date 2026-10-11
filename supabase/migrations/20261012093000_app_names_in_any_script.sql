-- An Allowed Apps rule can name an app in any script (audit C07): "app:" followed by up to
-- 80 characters that are neither control characters nor ones that change text direction.
-- OCADE's own validation keeps the stricter letters, digits, marks and punctuation rule.
BEGIN;

ALTER TABLE public.jarvis_permissions DROP CONSTRAINT IF EXISTS jarvis_permissions_capability_check;
ALTER TABLE public.jarvis_permissions ADD CONSTRAINT jarvis_permissions_capability_check CHECK (
  capability IN ('master', 'memory', 'autonomous', 'browser', 'browser_real', 'files',
    'screen', 'microphone', 'camera', 'apps', 'messaging', 'devices', 'computer_control',
    'terminal', 'cowork')
  OR capability ~ '^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$'
  OR (capability ~ '^app:[^[:cntrl:]]{1,80}$'
      AND capability !~ '[‎‏‪-‮⁦-⁩]')
);

COMMIT;
