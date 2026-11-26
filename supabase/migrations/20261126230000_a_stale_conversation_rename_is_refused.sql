BEGIN;

/**
 * OFFLINE-03: a rename made from an out-of-date copy of the conversation must not silently
 * replace a title another device saved meanwhile.
 *
 * `title_revision` counts how many times the title changed. Any writer that changes the title
 * (this function, an older client's plain update, an upsert) bumps it, so the next stale rename
 * is refused with serialization_failure and changes nothing; the screen then shows the newer
 * title instead of discarding it. Pin, archive and model are single idempotent choices and keep
 * last-writer-wins.
 */
ALTER TABLE public.ocade_conversations
  ADD COLUMN IF NOT EXISTS title_revision integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.ocade_conversation_title_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title AND NEW.title_revision = OLD.title_revision THEN
    NEW.title_revision := OLD.title_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_conversation_title_revision() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ocade_conversations_title_revision ON public.ocade_conversations;
CREATE TRIGGER ocade_conversations_title_revision
  BEFORE UPDATE OF title ON public.ocade_conversations
  FOR EACH ROW EXECUTE FUNCTION public.ocade_conversation_title_revision();

CREATE OR REPLACE FUNCTION public.ocade_rename_conversation_checked(
  p_id uuid,
  p_expected_revision integer,
  p_title text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_revision integer;
  next_revision integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'A conversation belongs to an account.';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) = 0 OR length(p_title) > 200 THEN
    RAISE EXCEPTION 'invalid_title' USING ERRCODE = '22023';
  END IF;

  SELECT title_revision INTO current_revision
    FROM public.ocade_conversations
   WHERE id = p_id AND user_id = auth.uid()
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF current_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'title_changed_elsewhere' USING ERRCODE = '40001';
  END IF;

  UPDATE public.ocade_conversations
     SET title = p_title
   WHERE id = p_id AND user_id = auth.uid()
  RETURNING title_revision INTO next_revision;
  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_rename_conversation_checked(uuid, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_rename_conversation_checked(uuid, integer, text)
  TO authenticated;

COMMIT;
