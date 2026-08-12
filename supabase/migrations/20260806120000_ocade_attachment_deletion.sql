-- Complete attachment deletion: never orphan a stored object.
--
-- THE DEFECT THIS FIXES.
--
-- `public.msg_attachments.storage_path` is the ONLY record of where an
-- uploaded file's bytes live in the storage bucket. That table cascades from
-- both `msg_messages` and `msg_threads`:
--
--   message_id UUID NOT NULL REFERENCES public.msg_messages(id) ON DELETE CASCADE
--   thread_id  UUID NOT NULL REFERENCES public.msg_threads(id)  ON DELETE CASCADE
--
-- So deleting a message — or a whole thread, or a user — silently discards the
-- path while the object itself stays in the bucket. The bytes become
-- unreachable garbage that nothing can ever find again: they keep costing
-- storage, they keep appearing in bucket listings, and they still contain
-- whatever the user uploaded. A person who deleted a document to make it go
-- away is told it is gone while it is not. That is a privacy failure, not a
-- housekeeping one, and cascade deletion is precisely the case where the
-- application code that would normally clean up never runs.
--
-- THE FIX. An AFTER DELETE trigger records the path in a tombstone BEFORE the
-- row disappears, so the cascade can no longer lose it. A server-side sweeper
-- deletes the object and marks the tombstone purged. Deletion therefore
-- survives every path that removes an attachment row: direct delete, message
-- cascade, thread cascade, and account deletion.
--
-- WHY A TOMBSTONE AND NOT A STORAGE TRIGGER. Postgres cannot delete an object
-- out of the storage backend from inside a transaction, and it must not try:
-- the object delete is a remote call that can fail or be slow, and a failed
-- remote call must never roll back the user's deletion of their own data. The
-- tombstone splits the durable part (we WILL delete these bytes) from the
-- best-effort part (the API call), and makes retry safe.

-- ---------------------------------------------------------------------------
-- Tombstones
-- ---------------------------------------------------------------------------

CREATE TABLE public.storage_tombstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  -- Kept so the owner can verify their own deletion completed. Not a foreign
  -- key to auth.users: an account deletion must not cascade away the very
  -- record proving that account's files still need purging.
  owner_id UUID,
  -- What produced this tombstone, for diagnosing a stuck sweep.
  source TEXT NOT NULL DEFAULT 'msg_attachments',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  -- One tombstone per object. Re-deleting the same path is a no-op rather
  -- than a duplicate row, which keeps the sweeper idempotent.
  CONSTRAINT storage_tombstones_unique_object UNIQUE (bucket, storage_path)
);

-- The sweeper's only query: outstanding work, oldest first.
CREATE INDEX storage_tombstones_pending_idx
  ON public.storage_tombstones (requested_at)
  WHERE purged_at IS NULL;

CREATE INDEX storage_tombstones_owner_idx
  ON public.storage_tombstones (owner_id);

COMMENT ON TABLE public.storage_tombstones IS
  'Objects whose database row is gone and whose bytes must still be deleted. Written by trigger so cascade deletes cannot orphan storage.';

-- ---------------------------------------------------------------------------
-- The trigger that outlives the cascade
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tombstone_deleted_attachment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- A row with no path has no bytes to chase.
  IF OLD.storage_path IS NULL OR btrim(OLD.storage_path) = '' THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.storage_tombstones (bucket, storage_path, owner_id, source)
  VALUES ('message-attachments', OLD.storage_path, OLD.uploaded_by, 'msg_attachments')
  -- Already tombstoned and possibly already purged. Do not resurrect a
  -- completed sweep by clearing purged_at.
  ON CONFLICT (bucket, storage_path) DO NOTHING;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.tombstone_deleted_attachment() IS
  'Records an attachment storage path for purging. SECURITY DEFINER because it must also run during cascades initiated by a user who cannot write the tombstone table.';

CREATE TRIGGER msg_attachments_tombstone_storage
  AFTER DELETE ON public.msg_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.tombstone_deleted_attachment();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.storage_tombstones ENABLE ROW LEVEL SECURITY;

-- Owners may CONFIRM their deletion, and nothing else. There is deliberately
-- no INSERT, UPDATE or DELETE policy: the trigger writes as definer, and only
-- the service role (which bypasses RLS) marks a tombstone purged. A client
-- that could insert here could name any path in the bucket and have the
-- sweeper delete another tenant's file — the whole table is a delete queue, so
-- write access to it is write access to everyone's storage.
CREATE POLICY "own_tombstone_read" ON public.storage_tombstones FOR SELECT
  USING (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Proof of completion, for the user's Data and Deletion screen
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.attachment_deletion_status()
RETURNS TABLE (pending BIGINT, purged BIGINT, oldest_pending TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  -- SECURITY INVOKER, so RLS applies and a caller sees only their own files.
  SELECT
    count(*) FILTER (WHERE purged_at IS NULL),
    count(*) FILTER (WHERE purged_at IS NOT NULL),
    min(requested_at) FILTER (WHERE purged_at IS NULL)
  FROM public.storage_tombstones;
$$;

COMMENT ON FUNCTION public.attachment_deletion_status() IS
  'Counts of the caller''s own outstanding and completed storage deletions, so the Data and Deletion screen can report a real number instead of claiming success.';
