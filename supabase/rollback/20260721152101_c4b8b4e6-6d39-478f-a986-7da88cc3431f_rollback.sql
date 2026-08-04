-- Rollback for 20260721152101 (Messenger: threads, members, cross-company grants,
-- messages, edits, attachments, reactions, pins, read receipts, links).
-- Idempotent, reverse FK order. Not applied automatically here.
BEGIN;
DROP TABLE IF EXISTS public.msg_message_links CASCADE;
DROP TABLE IF EXISTS public.msg_read_receipts CASCADE;
DROP TABLE IF EXISTS public.msg_pins CASCADE;
DROP TABLE IF EXISTS public.msg_reactions CASCADE;
DROP TABLE IF EXISTS public.msg_attachments CASCADE;
DROP TABLE IF EXISTS public.msg_message_edits CASCADE;
DROP TABLE IF EXISTS public.msg_messages CASCADE;
DROP TABLE IF EXISTS public.msg_cross_company_grants CASCADE;
DROP TABLE IF EXISTS public.msg_thread_members CASCADE;
DROP TABLE IF EXISTS public.msg_threads CASCADE;
DROP FUNCTION IF EXISTS public.msg_apply_scope() CASCADE;
DROP FUNCTION IF EXISTS public.msg_record_edit() CASCADE;
DROP FUNCTION IF EXISTS public.msg_bump_last_message() CASCADE;
DROP FUNCTION IF EXISTS public.msg_add_creator_as_admin() CASCADE;
DROP FUNCTION IF EXISTS public.msg_thread_writable(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.msg_is_thread_admin(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.msg_is_thread_member(uuid, uuid) CASCADE;
DROP TYPE IF EXISTS public.msg_link_kind;
DROP TYPE IF EXISTS public.msg_grant_status;
DROP TYPE IF EXISTS public.msg_scope_badge;
DROP TYPE IF EXISTS public.msg_message_kind;
DROP TYPE IF EXISTS public.msg_member_role;
DROP TYPE IF EXISTS public.msg_thread_kind;
COMMIT;
