BEGIN;
ALTER TABLE public.byok_connections ALTER COLUMN send_images SET DEFAULT true;
COMMIT;
