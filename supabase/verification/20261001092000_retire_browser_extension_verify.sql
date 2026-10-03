-- No extension device can exist, and phones have their own stop.
DO $$
BEGIN
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'jarvis_devices_kind_check'))
     LIKE '%extension%' THEN
    RAISE EXCEPTION 'extension devices are still accepted';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jarvis_devices WHERE kind = 'extension') THEN
    RAISE EXCEPTION 'an extension device remains';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ocade_service_controls WHERE key = 'jarvis_android')
     OR EXISTS (SELECT 1 FROM public.ocade_service_controls WHERE key = 'jarvis_extension') THEN
    RAISE EXCEPTION 'the stops are not jarvis_execution, jarvis_agent and jarvis_android';
  END IF;
END
$$;
