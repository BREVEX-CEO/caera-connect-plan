-- SEC-04: fair per-person limits on the server actions that start work or reach outside OCADE
-- (starting, replaying and instructing JARVIS tasks, saving watches, skills and chat apps,
-- beginning large uploads). A fixed window per person and action, counted atomically in one
-- statement, so concurrent requests cannot overbook it; old windows are removed as they pass.
-- Model use keeps its own allowances; this bounds misuse of everything around it.
BEGIN;

CREATE TABLE public.ocade_rate_windows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (user_id, action, window_start),
  CONSTRAINT ocade_rate_windows_action_check CHECK (action ~ '^[a-z_]{1,40}$')
);
ALTER TABLE public.ocade_rate_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_rate_windows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_rate_windows TO service_role;
CREATE POLICY ocade_rate_windows_service ON public.ocade_rate_windows FOR ALL TO service_role USING (true);

CREATE FUNCTION public.ocade_rate_admit(p_user uuid, p_action text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_start timestamptz := to_timestamp(floor(extract(epoch FROM statement_timestamp()) / p_window_seconds) * p_window_seconds);
  v_count integer;
BEGIN
  IF p_limit < 1 OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'invalid_rate' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ocade_rate_windows AS w (user_id, action, window_start, count)
  VALUES (p_user, p_action, v_start, 1)
  ON CONFLICT (user_id, action, window_start) DO UPDATE SET count = w.count + 1
  RETURNING count INTO v_count;
  DELETE FROM public.ocade_rate_windows
   WHERE user_id = p_user AND action = p_action AND window_start < v_start - interval '1 day';
  RETURN v_count <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_rate_admit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_rate_admit(uuid, text, integer, integer) TO service_role;

COMMIT;
