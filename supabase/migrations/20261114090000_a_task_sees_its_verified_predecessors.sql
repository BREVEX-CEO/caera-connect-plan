-- Experience (C9, after UFO's experience memory and OpenAdapt's recorded demonstrations,
-- re-implemented): the routes of this person's recent tasks on the same computer that passed
-- their independent checks. The planner shows the model the one most like the new outcome as
-- a guide; nothing is replayed, and every step is still proposed, admitted and verified as
-- usual. Only operation names and their app or site travel: no arguments, no observations.
BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_experience(p_task uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'route', e.route) ORDER BY e.finished_at DESC),
                  '[]'::jsonb)
    FROM (
      SELECT p.title, p.finished_at,
             (SELECT coalesce(jsonb_agg(r.step ORDER BY r.created_at, r.id), '[]'::jsonb)
                FROM (SELECT a.created_at, a.id,
                             (a.action ->> 'operation')
                               || coalesce(' ' || coalesce(a.action -> 'target' ->> 'app', a.action -> 'target' ->> 'site'), '')
                               AS step
                        FROM public.jarvis_activity AS a
                       WHERE a.task_id = p.id AND a.status = 'done' AND a.action ? 'operation'
                       ORDER BY a.created_at, a.id
                       LIMIT 30) AS r) AS route
        FROM public.jarvis_tasks AS t
        JOIN public.jarvis_tasks AS p
          ON p.user_id = t.user_id AND p.device_id = t.device_id AND p.id <> t.id AND p.status = 'completed'
       WHERE t.id = p_task
       ORDER BY p.finished_at DESC
       LIMIT 40) AS e;
$$;

REVOKE ALL ON FUNCTION public.jarvis_experience(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_experience(uuid) TO service_role;

COMMIT;
