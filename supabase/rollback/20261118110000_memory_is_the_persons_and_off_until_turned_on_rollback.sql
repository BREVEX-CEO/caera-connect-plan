-- Rollback of 20261118110000: memory on/off and its server-only read are removed.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_memories_for_turn(uuid);
DROP FUNCTION IF EXISTS public.ocade_set_memory_enabled(boolean);
ALTER TABLE public.jarvis_memories DROP COLUMN IF EXISTS source;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS memory_enabled;
COMMIT;
