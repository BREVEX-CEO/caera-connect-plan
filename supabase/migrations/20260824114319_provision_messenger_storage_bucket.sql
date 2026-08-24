-- The messenger object policies existed, but no bucket had ever been
-- provisioned. Keep attachments private and cap each object at 25 MiB.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('messenger', 'messenger', false, 26214400)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS messenger_read ON storage.objects;
DROP POLICY IF EXISTS messenger_insert ON storage.objects;
DROP POLICY IF EXISTS messenger_delete_own ON storage.objects;

CREATE POLICY messenger_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'messenger'
  AND CASE
    WHEN split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.msg_is_thread_member(
      split_part(name, '/', 1)::UUID,
      (SELECT auth.uid())
    )
    ELSE false
  END
);

CREATE POLICY messenger_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'messenger'
  AND owner = (SELECT auth.uid())
  AND CASE
    WHEN split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN private.msg_thread_writable(
      split_part(name, '/', 1)::UUID,
      (SELECT auth.uid())
    )
    ELSE false
  END
);

CREATE POLICY messenger_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'messenger'
  AND owner = (SELECT auth.uid())
);

COMMIT;
