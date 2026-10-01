-- Undo: a console session is the console's whatever factors it added (20261001090000).
BEGIN;
CREATE OR REPLACE FUNCTION private.ocade_caller_in_console()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(auth.jwt() ->> 'session_id', '') = ''
      OR EXISTS (SELECT 1 FROM public.ocade_console_sessions AS c
                  WHERE c.session_id = (auth.jwt() ->> 'session_id')::uuid
                    AND c.user_id = auth.uid());
$$;
COMMIT;
