-- Rollback of 20261110090000_a_planning_turn_has_one_holder.sql: removes what it added.
-- Data in removed columns is lost; nothing else changes.
BEGIN;

DROP TRIGGER IF EXISTS jarvis_planner_turn_follows_controller ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_planner_turn_follows_controller();
DROP FUNCTION IF EXISTS public.jarvis_planner_turn_end(uuid, integer, boolean);
DROP FUNCTION IF EXISTS public.jarvis_planner_turn(uuid, uuid, integer, integer);

ALTER TABLE public.jarvis_tasks
  DROP COLUMN IF EXISTS planner_turn_until,
  DROP COLUMN IF EXISTS planner_turn;

COMMIT;
