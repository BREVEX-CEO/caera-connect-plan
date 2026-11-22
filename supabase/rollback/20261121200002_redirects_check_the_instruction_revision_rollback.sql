BEGIN;
DROP FUNCTION public.jarvis_claim_with_instruction(uuid);
DROP FUNCTION public.jarvis_redirect_task(uuid, uuid, uuid, text, smallint, uuid, uuid, uuid);
DROP FUNCTION public.jarvis_instruction_revision(uuid);
CREATE OR REPLACE FUNCTION public.jarvis_task_instructions(p_task uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(i ORDER BY i ->> 'at'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('text', a.result ->> 'text', 'lane', a.result -> 'lane',
                              'from', a.result ->> 'from', 'at', a.created_at) AS i
      FROM public.jarvis_activity AS a
     WHERE a.task_id = p_task AND a.status = 'note' AND a.result ->> 'kind' = 'instruction'
     ORDER BY a.created_at DESC LIMIT 10) AS latest;
$$;
COMMIT;
