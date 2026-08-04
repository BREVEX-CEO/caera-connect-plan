-- Rollback for 20260721152140 (messenger storage bucket policies on storage.objects).
-- Idempotent. Not applied automatically here.
BEGIN;
DROP POLICY IF EXISTS messenger_delete_own ON storage.objects;
DROP POLICY IF EXISTS messenger_insert ON storage.objects;
DROP POLICY IF EXISTS messenger_read ON storage.objects;
COMMIT;
