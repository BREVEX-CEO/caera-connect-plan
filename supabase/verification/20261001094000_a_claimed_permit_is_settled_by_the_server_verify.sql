-- A claimed permit is released only by the boundary, and only for no output.
DO $$
DECLARE
  v_def text := pg_get_functiondef('public.ocade_release_generation_permit(uuid,text,text)'::regprocedure);
BEGIN
  IF v_def !~ 'transport_claimed_at IS NOT NULL' OR v_def !~ 'transport_ended_without_output' THEN
    RAISE EXCEPTION 'a claimed permit can still be released by the browser';
  END IF;
  IF has_function_privilege('authenticated', 'public.ocade_release_generation_permit(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ocade_release_generation_permit(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'release is callable outside the server';
  END IF;
END
$$;
