-- Browser notification addresses: kept, written only through the checked
-- function, read only by the server; delivery states written only by the server.
DO $$
BEGIN
  IF to_regclass('public.ocade_push_subscriptions') IS NULL THEN
    RAISE EXCEPTION 'push subscriptions are not recorded';
  END IF;
  IF has_table_privilege('authenticated', 'public.ocade_push_subscriptions', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ocade_push_subscriptions', 'INSERT') THEN
    RAISE EXCEPTION 'browsers must not read or write subscriptions directly';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.ocade_push_subscribe(text,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ocade_push_subscribe(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'subscribe must be for signed-in browsers only';
  END IF;
  IF has_function_privilege('authenticated', 'public.ocade_set_notification_delivery(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'only the server records delivery';
  END IF;
END
$$;
