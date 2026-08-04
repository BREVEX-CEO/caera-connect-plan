-- ROLLBACK for 20260722090000_ocade_projects_outputs_memory.sql
--
-- Destructive: drops the OCADE projects/outputs/memory tables and the columns
-- added to existing tables. Run only if you intend to remove that migration.
-- Existing conversations/messages are NOT deleted — only the project link.

BEGIN;

-- Reverse the additive columns first so table drops don't trip FKs.
ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS ocade_memory_enabled;

DROP POLICY IF EXISTS "own_messages" ON public.ocade_messages;
CREATE POLICY "own_messages" ON public.ocade_messages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restore the pre-migration conversation policy before removing the project
-- column referenced by the parent-ownership check.
DROP POLICY IF EXISTS "own_conversations" ON public.ocade_conversations;
CREATE POLICY "own_conversations" ON public.ocade_conversations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP INDEX IF EXISTS public.ocade_conversations_project_idx;
ALTER TABLE public.ocade_conversations
  DROP COLUMN IF EXISTS project_id;

DROP TRIGGER IF EXISTS ocade_memory_touch ON public.ocade_memory;
DROP TABLE IF EXISTS public.ocade_memory;

DROP TABLE IF EXISTS public.ocade_outputs;

DROP TABLE IF EXISTS public.ocade_project_items;

DROP TRIGGER IF EXISTS ocade_projects_touch ON public.ocade_projects;
DROP TABLE IF EXISTS public.ocade_projects;

COMMIT;
