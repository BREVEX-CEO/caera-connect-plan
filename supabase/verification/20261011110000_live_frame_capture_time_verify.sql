DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                  AND table_name = 'jarvis_tasks' AND column_name = 'live_frame_at') THEN
    RAISE EXCEPTION 'jarvis_tasks.live_frame_at is missing';
  END IF;
END
$$;
