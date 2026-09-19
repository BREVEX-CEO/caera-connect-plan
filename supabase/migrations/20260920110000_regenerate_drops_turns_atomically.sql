-- REGENERATE DELETED A TRANSCRIPT ONE ROW AT A TIME, IN PARALLEL.
--
-- Edit, Regenerate and Retry all drop the chosen question and every turn after
-- it, and the browser did that with one `deleteMessage` call per row, fired
-- together. When one of those failed after others had succeeded, the account was
-- left with a transcript missing turns from the middle — irreversibly, because a
-- deleted message is gone — and the only recovery was to re-read whatever
-- happened to remain. A person could lose answers they had not asked to replace.
--
-- ONE STATEMENT DELETES ALL OF THEM OR NONE. Nothing to compensate, nothing to
-- re-read, no ordering to get wrong.
--
-- KEYED ON A TIME RATHER THAN ON THE ANCHOR ROW'S ID, because the anchor may not
-- be in the database at all: a turn written while the account was unreachable is
-- held in the tab and carries a client-side timestamp, and later turns may have
-- been stored normally once the network returned. Deleting "from this moment on"
-- covers that case; deleting "this row and its successors" could not see it.
--
-- SECURITY INVOKER, so `own_messages` decides what this may touch. An elevated
-- version would be a second authority over somebody else's transcript.
BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_delete_messages_from(
  p_conversation_id UUID,
  p_from TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  removed INTEGER;
BEGIN
  IF p_conversation_id IS NULL OR p_from IS NULL THEN
    RAISE EXCEPTION 'a conversation and a starting time are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  DELETE FROM public.ocade_messages
   WHERE conversation_id = p_conversation_id
     AND created_at >= p_from
     -- Side conversations hang off a single message and are not part of the
     -- transcript being replaced, exactly as `listMessages` excludes them.
     AND anchor_message_id IS NULL;

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_delete_messages_from(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_delete_messages_from(UUID, TIMESTAMPTZ)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.ocade_delete_messages_from(UUID, TIMESTAMPTZ) IS
  'Deletes the caller''s own transcript turns at or after a moment, in one statement. SECURITY INVOKER: bounded by own_messages.';

COMMIT;
