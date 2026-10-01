-- Every browser address belongs to a live session and goes with it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ocade_push_subscriptions'::regclass AND contype = 'f'
       AND confrelid = 'auth.sessions'::regclass AND confdeltype = 'c'
  ) THEN
    RAISE EXCEPTION 'push addresses do not end with their session';
  END IF;
  IF pg_get_functiondef('public.ocade_push_subscribe(text,text,text)'::regprocedure) !~ 'session_id' THEN
    RAISE EXCEPTION 'subscribe does not record the session';
  END IF;
END
$$;
