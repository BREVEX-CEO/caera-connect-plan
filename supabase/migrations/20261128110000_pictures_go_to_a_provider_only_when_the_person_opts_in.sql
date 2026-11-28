-- BYOK-07 / PRIVACY-05: sending pictures to a person's own provider is opt-in. A new connection
-- starts with pictures kept on the computer; connections that already chose keep their choice.
BEGIN;
ALTER TABLE public.byok_connections ALTER COLUMN send_images SET DEFAULT false;
COMMIT;
