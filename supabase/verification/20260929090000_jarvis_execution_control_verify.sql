-- Prove the emergency stop exists, starts off, and no browser can touch it directly.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ocade_service_controls
                  WHERE key = 'jarvis_execution' AND paused = false) THEN
    RAISE EXCEPTION 'the JARVIS execution control is missing or starts paused';
  END IF;
  IF has_table_privilege('authenticated', 'public.ocade_service_controls', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ocade_service_controls', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ocade_service_control_events', 'INSERT')
     OR has_table_privilege('anon', 'public.ocade_service_controls', 'SELECT') THEN
    RAISE EXCEPTION 'a browser can read or write service controls directly';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_set_service_control(text, boolean, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anyone signed out can change a service control';
  END IF;
END
$$;
