-- Library: one table and one private bucket for everything a person keeps.
--
-- What it replaces. `ocade_outputs` was the Artifacts product's table: a
-- lineage id, a version, a parent output, a verification flag, an evidence
-- string, a produced-by field and a project id — a document-versioning system
-- for a product that no longer exists. `PLAN.md` Phase 8 asks for something
-- much smaller and much clearer: "one simple All | Images | Files experience",
-- holding "uploaded files, uploaded images and generated files/images/outputs
-- from Chat and later Cowork", with "technical provenance out of the default
-- UI".
--
-- So this is not a rename. The retired columns are gone because nothing in the
-- final product can populate or read them, and a column nobody writes is a
-- column the next person has to reason about anyway.
--
-- THE BYTES LIVE IN A PRIVATE BUCKET, AND ONLY THE OWNER REACHES THEM. The
-- database row is an index: it says what an object is called, how big it is and
-- where it sits. Storage policies are scoped by the first path segment being
-- the owner's id, which is the same shape the messenger bucket already uses and
-- the only shape Supabase storage can enforce without a join.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Two kinds, because the interface offers two filters. An image is a thing
  -- you look at; everything else is a thing you open.
  kind TEXT NOT NULL CHECK (kind IN ('image', 'file')),
  -- Where it came from. Not shown by default — it decides nothing about access
  -- and `PLAN.md` keeps provenance out of the ordinary UI — but a person asking
  -- "did I upload this or did OCADE make it?" deserves an answer.
  source TEXT NOT NULL CHECK (source IN ('upload', 'generated')),
  name TEXT NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 300),
  mime TEXT NOT NULL CHECK (length(mime) <= 200),
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  -- `<user id>/<item id>`, inside the private `library` bucket. Unique because
  -- two rows pointing at one object means deleting either orphans or destroys
  -- the other.
  storage_path TEXT NOT NULL UNIQUE CHECK (btrim(storage_path) <> ''),
  -- The conversation it came out of, when it came out of one. Set null rather
  -- than cascade: deleting a conversation must not silently delete a file the
  -- person kept.
  conversation_id UUID REFERENCES public.ocade_conversations (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ocade_library_items IS
  'Library index: uploaded and generated files and images. One row per object in the private library bucket. Never stores the bytes, a prompt or a response.';

-- The only query the product makes: this account's items, newest first,
-- optionally narrowed to one kind.
CREATE INDEX IF NOT EXISTS ocade_library_items_owner_idx
  ON public.ocade_library_items (user_id, created_at DESC);

-- Search is deliberately NOT indexed. A library is tens of items, not
-- millions; the account index above already fetches them in one page, and the
-- box filters what is on screen. A trigram index here would be machinery for a
-- query that never gets slow.

CREATE INDEX IF NOT EXISTS ocade_library_items_conversation_idx
  ON public.ocade_library_items (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.ocade_library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_library_items FORCE ROW LEVEL SECURITY;

CREATE POLICY ocade_library_items_select_own
  ON public.ocade_library_items FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY ocade_library_items_insert_own
  ON public.ocade_library_items FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Nothing in the product updates a library row today; the policy exists so
-- that when something does, it cannot hand the row to somebody else in the
-- same statement.
CREATE POLICY ocade_library_items_update_own
  ON public.ocade_library_items FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ocade_library_items_delete_own
  ON public.ocade_library_items FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- The bytes outlive the row, so the row's deletion has to chase them
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tombstone_deleted_library_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.storage_tombstones (bucket, storage_path, owner_id, source)
  VALUES ('library', OLD.storage_path, OLD.user_id, 'ocade_library_items')
  ON CONFLICT (bucket, storage_path) DO NOTHING;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.tombstone_deleted_library_item() IS
  'Records a library object for purging. SECURITY DEFINER because it must also run during the cascade from an account deletion, where the caller cannot write the tombstone table.';

-- A TRIGGER FUNCTION IS NOT AN API. It bypasses RLS by design and never asks
-- who is calling, because the row it is handed is the authorization; leaving it
-- callable would let anybody name any object as owed a deletion.
REVOKE ALL ON FUNCTION public.tombstone_deleted_library_item() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ocade_library_items_tombstone_storage ON public.ocade_library_items;
CREATE TRIGGER ocade_library_items_tombstone_storage
  AFTER DELETE ON public.ocade_library_items
  FOR EACH ROW EXECUTE FUNCTION public.tombstone_deleted_library_item();

-- ---------------------------------------------------------------------------
-- Delete everything, which Data Controls offers and an account deletion needs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ocade_delete_all_library_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_removed integer;
BEGIN
  -- SECURITY INVOKER on purpose: the caller's own RLS decides what this can
  -- reach, so it cannot become a way to empty somebody else's library. The
  -- trigger above still writes the tombstones.
  WITH deleted AS (
    DELETE FROM public.ocade_library_items
    WHERE user_id = auth.uid()
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_removed FROM deleted;
  RETURN v_removed;
END;
$$;

COMMENT ON FUNCTION public.ocade_delete_all_library_items() IS
  'Removes every library item belonging to the caller and tombstones their objects. SECURITY INVOKER: bounded by the caller own RLS.';

-- ---------------------------------------------------------------------------
-- The bucket, private, owner-scoped by path
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('library', 'library', false, 52428800)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS ocade_library_objects_select_own ON storage.objects;
CREATE POLICY ocade_library_objects_select_own
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'library' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS ocade_library_objects_insert_own ON storage.objects;
CREATE POLICY ocade_library_objects_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS ocade_library_objects_delete_own ON storage.objects;
CREATE POLICY ocade_library_objects_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'library' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ---------------------------------------------------------------------------
-- And the table this one replaces
-- ---------------------------------------------------------------------------

-- `ocade_outputs` belonged to Artifacts. Nothing in the final product reads or
-- writes it, and leaving it would leave two answers to "where does a thing a
-- person kept live". The rollback recreates it; its one test row is not
-- customer data.
DROP TABLE IF EXISTS public.ocade_outputs CASCADE;

COMMIT;
