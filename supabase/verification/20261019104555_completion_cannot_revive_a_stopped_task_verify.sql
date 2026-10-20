-- The completion guard must run before every task status update, including service writes.
-- This catalogue check complements the transition/STOP/charge and rollback regressions.
DO $$
DECLARE
  v_guard regprocedure := to_regprocedure('public.jarvis_completion_requires_running()');
BEGIN
  IF v_guard IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_trigger AS t
    JOIN pg_attribute AS a ON a.attrelid = t.tgrelid AND a.attname = 'status'
    WHERE t.tgrelid = 'public.jarvis_tasks'::regclass
      AND t.tgname = 'jarvis_completion_requires_running'
      AND t.tgfoid = v_guard AND NOT t.tgisinternal
      AND t.tgenabled IN ('O', 'A') AND t.tgtype = 19
      AND t.tgattr::text = a.attnum::text AND t.tgqual IS NULL
  ) THEN
    RAISE EXCEPTION 'The task completion transition guard is missing, disabled or misbound';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc AS p WHERE p.oid = v_guard
      AND NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
  ) OR has_function_privilege('anon', v_guard, 'EXECUTE')
    OR has_function_privilege('authenticated', v_guard, 'EXECUTE') THEN
    RAISE EXCEPTION 'The completion guard has unsafe execution privileges or search path';
  END IF;
END
$$;
