-- One holder per planning turn, and its own number for every provider attempt
-- (plan.md §19.4, benchmark round 4: `duplicate_completed` and 38 HTTP 409 `permit_refused`).
--
-- Before: the billing permit's idempotency key (`jarvis-plan:<task>:<controller>:<steps>`) was
-- also the only thing that stopped two requests planning the same turn. A permit is settled
-- once, so it could not do both jobs:
--   * a device poll that arrived while the turn's corrective second ask was still in flight
--     met the first, already settled permit (`duplicate_completed`) and parked the task;
--   * a service instance that died after claiming the permit left it claimed for 30 minutes,
--     so every later request for that turn was refused (409) and nothing was scheduled.
--
-- Now the task row holds a short lease for whoever is asking the model, and a counter that
-- gives every holder a new number. The permit key is built from that number, so no provider
-- attempt ever reuses a permit. A second request for a held turn does nothing; a holder that
-- died is replaced when its lease runs out. What the turn may admit is still decided by the
-- existing fences (controller, step key, milestone cursor): the lease only saves model calls.
-- No applied migration is edited.
BEGIN;

ALTER TABLE public.jarvis_tasks
  ADD COLUMN planner_turn integer NOT NULL DEFAULT 0,
  ADD COLUMN planner_turn_until timestamptz;

COMMENT ON COLUMN public.jarvis_tasks.planner_turn IS
  'Number of the newest planning-turn holder; part of every model permit key.';
COMMENT ON COLUMN public.jarvis_tasks.planner_turn_until IS
  'Until when that holder may still be asking the model; NULL when nobody is.';

-- Take the turn (NULL when another request holds it, or the task is not this controller's to
-- plan), or keep it for one more model call when `p_held` is the number this caller was given.
CREATE FUNCTION public.jarvis_planner_turn(p_task uuid, p_controller uuid, p_seconds integer,
                                           p_held integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_turn integer;
BEGIN
  IF p_seconds IS NULL OR p_seconds NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'invalid_planner_turn' USING ERRCODE = '22023';
  END IF;
  UPDATE public.jarvis_tasks AS t
     SET planner_turn = CASE WHEN t.planner_turn = p_held THEN t.planner_turn
                             ELSE t.planner_turn + 1 END,
         planner_turn_until = statement_timestamp() + make_interval(secs => p_seconds)
   WHERE t.id = p_task AND t.status = 'running' AND t.controller = p_controller
     AND (t.planner_turn_until IS NULL OR t.planner_turn_until <= statement_timestamp()
          OR t.planner_turn = p_held)
  RETURNING t.planner_turn INTO v_turn;
  RETURN v_turn;
END;
$$;

-- The holder is done. An answered turn is progress, so the busy planner's bounded automatic
-- retries (20261106140005) count consecutive unanswered turns, not every one in the task's life.
CREATE FUNCTION public.jarvis_planner_turn_end(p_task uuid, p_turn integer, p_answered boolean)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  UPDATE public.jarvis_tasks AS t
     SET planner_turn_until = NULL,
         planner_auto_retries = CASE WHEN p_answered THEN 0 ELSE t.planner_auto_retries END
   WHERE t.id = p_task AND t.planner_turn = p_turn;
$$;

-- A new controller (resume) never waits for a lease taken under the one it replaced.
CREATE FUNCTION public.jarvis_planner_turn_follows_controller()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.controller IS DISTINCT FROM OLD.controller THEN
    NEW.planner_turn_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER jarvis_planner_turn_follows_controller
  BEFORE UPDATE ON public.jarvis_tasks
  FOR EACH ROW EXECUTE FUNCTION public.jarvis_planner_turn_follows_controller();

REVOKE ALL ON FUNCTION public.jarvis_planner_turn(uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_planner_turn_end(uuid, integer, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_planner_turn_follows_controller()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_planner_turn(uuid, uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_planner_turn_end(uuid, integer, boolean) TO service_role;

COMMIT;
