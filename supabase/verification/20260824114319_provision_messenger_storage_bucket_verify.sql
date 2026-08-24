-- Assert that the messenger bucket is private, capped at 25 MiB, and protected
-- by the three intended authenticated object policies.
DO $$
DECLARE
  bucket_ok BOOLEAN;
  policy_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'messenger'
      AND name = 'messenger'
      AND public = false
      AND file_size_limit = 26214400
  ) INTO bucket_ok;

  SELECT count(*)
  INTO policy_count
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN ('messenger_read', 'messenger_insert', 'messenger_delete_own')
    AND roles = ARRAY['authenticated']::name[];

  IF NOT bucket_ok OR policy_count <> 3 THEN
    RAISE EXCEPTION 'Messenger storage bucket verification failed.';
  END IF;
END;
$$;
