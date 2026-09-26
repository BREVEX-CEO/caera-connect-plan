-- Remove the JARVIS surface's tables and discriminator.
--
-- JARVIS conversations are deleted first, because once the discriminator is
-- gone they would silently appear in Chat. The ledger functions are left in
-- their surface-aware form: with no JARVIS permits they behave exactly as
-- before, and narrowing them again needs a forward migration with a reason.
BEGIN;

DROP FUNCTION IF EXISTS public.jarvis_purge_expired_activity(uuid);
DROP TABLE IF EXISTS public.jarvis_memories;
DROP TABLE IF EXISTS public.jarvis_activity;
DROP TABLE IF EXISTS public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_task_frame_is_temporary();
DROP TABLE IF EXISTS public.jarvis_permissions;
DROP TABLE IF EXISTS public.jarvis_devices;

DELETE FROM public.ocade_conversations WHERE surface = 'jarvis';
DROP TRIGGER IF EXISTS ocade_conversations_surface_fixed ON public.ocade_conversations;
DROP FUNCTION IF EXISTS public.ocade_conversation_surface_is_fixed();
DROP INDEX IF EXISTS public.ocade_conversations_user_surface_idx;
ALTER TABLE public.ocade_conversations DROP CONSTRAINT IF EXISTS ocade_conversations_surface_check;
ALTER TABLE public.ocade_conversations DROP COLUMN IF EXISTS surface;

DELETE FROM public.ocade_generation_permits WHERE surface = 'jarvis';
DELETE FROM public.ocade_commercial_usage WHERE window_kind LIKE 'jarvis_%';
ALTER TABLE public.ocade_generation_permits DROP CONSTRAINT IF EXISTS ocade_generation_permits_surface_check;
ALTER TABLE public.ocade_generation_permits
  ADD CONSTRAINT ocade_generation_permits_surface_check CHECK (surface = 'chat');
ALTER TABLE public.ocade_commercial_usage DROP CONSTRAINT IF EXISTS ocade_commercial_usage_window_kind_check;
ALTER TABLE public.ocade_commercial_usage
  ADD CONSTRAINT ocade_commercial_usage_window_kind_check CHECK (window_kind IN ('session', 'week'));

COMMIT;
