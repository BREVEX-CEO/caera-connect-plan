-- Removes the Library table, its bucket policies and its sweep, and puts the
-- retired Artifacts table back.
--
-- ROLLING THIS BACK LOSES THE LIBRARY. Every row here is an index entry for an
-- object in the `library` bucket; dropping the table tombstones nothing,
-- because the trigger goes with it, so the objects are left in the bucket for
-- an operator to remove deliberately. That is the safer direction: bytes a
-- person kept are not deleted by a schema rollback.
--
-- `ocade_outputs` is recreated in the shape it had, empty. It belonged to a
-- product that no longer exists and nothing in the application reads it; it is
-- here so this migration is genuinely reversible rather than nominally so.

BEGIN;

DROP POLICY IF EXISTS ocade_library_objects_delete_own ON storage.objects;
DROP POLICY IF EXISTS ocade_library_objects_insert_own ON storage.objects;
DROP POLICY IF EXISTS ocade_library_objects_select_own ON storage.objects;

DROP FUNCTION IF EXISTS public.ocade_delete_all_library_items();
DROP TRIGGER IF EXISTS ocade_library_items_tombstone_storage ON public.ocade_library_items;
DROP FUNCTION IF EXISTS public.tombstone_deleted_library_item();
DROP TABLE IF EXISTS public.ocade_library_items;

/*
 * THE BUCKET IS NOT DELETED HERE, AND IT CANNOT BE.
 *
 * `DELETE FROM storage.buckets` stood here and could never have run: Supabase
 * refuses direct deletion from the storage tables — `storage.protect_delete()`
 * raises 42501, "Use the Storage API instead" — so a rollback that claimed to
 * remove the bucket would have failed at this line and left everything above
 * it rolled back too.
 *
 * Removing a bucket is a Storage API call or one action in the dashboard. What
 * this file can do, and does above, is take away every policy that reaches it:
 * with none, no role can read, write or list it. The objects stay where they
 * are, which is the safer direction — bytes a person kept are not deleted by a
 * schema rollback.
 */

CREATE TABLE IF NOT EXISTS public.ocade_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  conversation_id UUID,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  mime TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  lineage_id UUID NOT NULL DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  parent_output_id UUID,
  content_sha256 TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  produced_by TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  evidence TEXT,
  context JSONB
);

ALTER TABLE public.ocade_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ocade_outputs_owner ON public.ocade_outputs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
