CREATE POLICY "Users can clear own old activity"
  ON public.activity_log
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND created_at < (now() - interval '30 days'));