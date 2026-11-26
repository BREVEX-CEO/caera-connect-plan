BEGIN;
DROP FUNCTION IF EXISTS public.ocade_rename_conversation_checked(uuid, integer, text);
DROP TRIGGER IF EXISTS ocade_conversations_title_revision ON public.ocade_conversations;
DROP FUNCTION IF EXISTS public.ocade_conversation_title_revision();
ALTER TABLE public.ocade_conversations DROP COLUMN IF EXISTS title_revision;
COMMIT;
