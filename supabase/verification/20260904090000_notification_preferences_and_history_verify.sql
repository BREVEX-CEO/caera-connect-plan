-- Verification for 20260904090000_notification_preferences_and_history.
--
-- Each block RAISES on failure, so a run that prints nothing and returns
-- successfully is the pass. Checks the properties the migration exists to
-- guarantee rather than that the objects were created — a table with RLS
-- disabled would satisfy "it exists" and fail the only thing that matters.

DO $$
BEGIN
  IF to_regclass('public.ocade_notification_preferences') IS NULL THEN
    RAISE EXCEPTION 'ocade_notification_preferences is missing';
  END IF;
  IF to_regclass('public.ocade_notifications') IS NULL THEN
    RAISE EXCEPTION 'ocade_notifications is missing';
  END IF;
END $$;

-- Row-level security is ON for both.
DO $$
DECLARE
  unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO unprotected
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('ocade_notification_preferences', 'ocade_notifications')
     AND c.relrowsecurity = false;
  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'row-level security is off for: %', unprotected;
  END IF;
END $$;

-- No browser may write a notification for itself, and none may rewrite one.
DO $$
DECLARE
  writable integer;
BEGIN
  SELECT count(*) INTO writable
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'ocade_notifications'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  IF writable > 0 THEN
    RAISE EXCEPTION 'ocade_notifications has % write policy(ies); it must be server-written only', writable;
  END IF;
END $$;

-- A deep link may only be a same-origin path.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.ocade_notifications
      (user_id, category, title, idempotency_key, deep_link)
    VALUES
      ('00000000-0000-0000-0000-000000000000', 'security', 'x', 'verify-absolute',
       'https://elsewhere.example/x');
    RAISE EXCEPTION 'an absolute deep link was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'the deep-link check did not run before the foreign key';
  END;
END $$;

-- An unknown category is refused, so a preference can never name one the
-- product has never heard of.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.ocade_notifications
      (user_id, category, title, idempotency_key)
    VALUES
      ('00000000-0000-0000-0000-000000000000', 'marketing', 'x', 'verify-category');
    RAISE EXCEPTION 'an unknown category was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'the category check did not run before the foreign key';
  END;
END $$;

-- Duplicate collapse is a constraint, not a lookup.
DO $$
DECLARE
  constraint_count integer;
BEGIN
  SELECT count(*) INTO constraint_count
    FROM pg_constraint
   WHERE conrelid = 'public.ocade_notifications'::regclass
     AND conname = 'ocade_notifications_idempotency'
     AND contype = 'u';
  IF constraint_count <> 1 THEN
    RAISE EXCEPTION 'the (user_id, idempotency_key) unique constraint is missing';
  END IF;
END $$;

-- The recorder is the server's alone.
DO $$
BEGIN
  IF has_function_privilege(
       'authenticated',
       'public.ocade_record_notification(uuid, text, text, text, text, text, jsonb)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'authenticated can record notifications';
  END IF;
END $$;
