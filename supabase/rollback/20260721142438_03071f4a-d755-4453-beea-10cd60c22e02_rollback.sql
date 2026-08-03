-- Rollback for 20260721142438 (OCADE conversations + messages).
-- Idempotent, reverse order. Not applied automatically here.
BEGIN;
-- Dropping the tables CASCADE removes their policies, triggers and indexes
-- (own_messages / own_conversations, ocade_conversations_touch, ocade_messages_conv_idx).
DROP TABLE IF EXISTS public.ocade_messages CASCADE;      -- child (FK -> conversations)
DROP TABLE IF EXISTS public.ocade_conversations CASCADE; -- parent
COMMIT;
