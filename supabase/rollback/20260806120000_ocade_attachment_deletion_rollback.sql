-- Rollback: attachment deletion tombstones.
--
-- WARNING. Dropping this table discards any OUTSTANDING deletions — objects
-- whose database rows are already gone and whose bytes have not yet been
-- swept. Those bytes become permanently unreachable, which is the exact defect
-- the migration exists to prevent.
--
-- Before rolling back, drain the queue and confirm it is empty:
--
--   SELECT count(*) FROM public.storage_tombstones WHERE purged_at IS NULL;
--
-- A non-zero count means rolling back destroys the only record of files a user
-- asked to have deleted. Export it first.

-- Wrapped in a transaction: a rollback that fails half-way would leave the
-- trigger firing into a table that no longer exists, and every attachment
-- delete would then error.
BEGIN;

DROP FUNCTION IF EXISTS public.attachment_deletion_status();
DROP TRIGGER IF EXISTS msg_attachments_tombstone_storage ON public.msg_attachments;
DROP FUNCTION IF EXISTS public.tombstone_deleted_attachment();
DROP TABLE IF EXISTS public.storage_tombstones;

COMMIT;
