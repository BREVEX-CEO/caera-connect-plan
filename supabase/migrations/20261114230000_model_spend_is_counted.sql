-- Plan v8 10.5: the input and output tokens the planner's provider reported, summed over the
-- tasks one account (or, with no account, every account) started since a moment. The server
-- compares them with the owner's daily and monthly spending ceilings before each model call.
-- Counts only; no task content. Service role only.
BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_model_tokens(p_user uuid, p_since timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'input', coalesce(sum(t.provider_input_tokens), 0),
    'output', coalesce(sum(t.provider_output_tokens), 0))
    FROM public.jarvis_tasks AS t
   WHERE t.created_at >= p_since
     AND (p_user IS NULL OR t.user_id = p_user);
$$;
REVOKE ALL ON FUNCTION public.jarvis_model_tokens(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_model_tokens(uuid, timestamptz) TO service_role;

COMMIT;
