-- Plan 14E.1 / REPO-58 / REPO-68: personal memory that the person controls. Memory is off until
-- the person turns it on; only what they asked OCADE to remember is kept (source 'stated': nothing
-- is inferred from chats, files or screens), each with when it was made; they view, add and forget
-- items, or forget everything, and turning memory off stops its use at once. OCADE's server reads
-- a person's memory only for that person's own Chat turn, through a server-only function.
BEGIN;

ALTER TABLE public.profiles ADD COLUMN memory_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.jarvis_memories
  ADD COLUMN source text NOT NULL DEFAULT 'stated' CHECK (source = 'stated');

-- The person turns memory on or off for themselves (RLS does not let them write profiles directly).
CREATE FUNCTION public.ocade_set_memory_enabled(p_enabled boolean)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.profiles SET memory_enabled = p_enabled WHERE id = (SELECT auth.uid())
  RETURNING memory_enabled;
$$;
REVOKE ALL ON FUNCTION public.ocade_set_memory_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_set_memory_enabled(boolean) TO authenticated;

-- The newest remembered items of one person, only while their memory is on, at most 4000 characters.
CREATE FUNCTION public.ocade_memories_for_turn(p_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(array_agg(m.content ORDER BY m.created_at DESC), '{}')
    FROM (SELECT m.content, m.created_at,
                 sum(length(m.content)) OVER (ORDER BY m.created_at DESC) AS running
            FROM public.jarvis_memories AS m
            JOIN public.profiles AS p ON p.id = m.user_id AND p.memory_enabled
           WHERE m.user_id = p_user_id
           ORDER BY m.created_at DESC
           LIMIT 50) AS m
   WHERE m.running <= 4000;
$$;
REVOKE ALL ON FUNCTION public.ocade_memories_for_turn(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_memories_for_turn(uuid) TO service_role;

COMMIT;
