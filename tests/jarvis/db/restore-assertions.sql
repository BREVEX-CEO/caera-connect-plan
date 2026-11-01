-- Restored application data and privilege boundaries must actually work.
\set ON_ERROR_STOP on
SET client_min_messages = warning;
DO $$
BEGIN
  IF (SELECT count(*) FROM auth.users) < 2 OR
     NOT EXISTS (SELECT 1 FROM public.jarvis_tasks) OR
     NOT EXISTS (SELECT 1 FROM public.jarvis_activity) THEN
    RAISE EXCEPTION 'restored fixture data is missing';
  END IF;
  IF has_function_privilege('anon', 'public.jarvis_settle_task(uuid,uuid,jsonb,text)', 'EXECUTE') OR
     has_function_privilege('authenticated', 'public.jarvis_settle_task(uuid,uuid,jsonb,text)', 'EXECUTE') OR
     NOT has_function_privilege('service_role', 'public.jarvis_settle_task(uuid,uuid,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'restored function permissions changed';
  END IF;
  IF has_table_privilege('authenticated', 'public.jarvis_tasks', 'INSERT') OR
     has_table_privilege('authenticated', 'public.jarvis_tasks', 'UPDATE') THEN
    RAISE EXCEPTION 'restored task authority became client-writable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('jarvis_tasks', 'jarvis_activity', 'jarvis_devices')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'restored account tables lost RLS';
  END IF;
END $$;

SELECT set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
SET ROLE authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.jarvis_tasks) THEN
    RAISE EXCEPTION 'restored owner cannot read its own tasks';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jarvis_tasks WHERE user_id <> auth.uid()) OR
     EXISTS (SELECT 1 FROM public.jarvis_activity WHERE user_id <> auth.uid()) OR
     EXISTS (SELECT 1 FROM public.jarvis_devices WHERE user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'restored RLS exposed another account';
  END IF;
END $$;
RESET ROLE;
SELECT 'PASS restored app data, service-only settlement, client write denial and tenant RLS';
