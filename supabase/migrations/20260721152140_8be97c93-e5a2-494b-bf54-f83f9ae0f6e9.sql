
-- Path convention: messenger/<thread_id>/<uuid>-<filename>
CREATE POLICY messenger_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'messenger'
    AND public.msg_is_thread_member(
      NULLIF(split_part(name, '/', 1), '')::uuid,
      auth.uid()
    )
  );

CREATE POLICY messenger_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'messenger'
    AND owner = auth.uid()
    AND public.msg_thread_writable(
      NULLIF(split_part(name, '/', 1), '')::uuid,
      auth.uid()
    )
  );

CREATE POLICY messenger_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'messenger'
    AND owner = auth.uid()
  );
