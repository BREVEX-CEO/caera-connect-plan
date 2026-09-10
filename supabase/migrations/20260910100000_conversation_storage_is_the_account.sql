-- Sharing no longer asks which device a conversation lives on.
--
-- `ocade_conversations.privacy_mode` was the per-conversation storage mode:
-- `device_only` meant the messages were on one machine and deliberately not in
-- the account. `PLAN.md` Phase 2 removed that idea. Every conversation a signed
-- in person can reach is in the account, an incognito conversation has no row at
-- all, and there is nothing left for the column to distinguish.
--
-- IT WAS NOT MERELY UNUSED. `ocade_share_conversation` still refused on it, with
-- a message naming a mode the product no longer has:
--
--   "This conversation is stored only on your device, so there is nothing here
--    to share. Switch its storage to Private Sync first."
--
-- Nothing sets the column any more, so the default carried every row past the
-- check and the refusal was unreachable. That is the dangerous shape: a rule
-- that reads as enforced, is not, and would start refusing real conversations
-- the moment anything wrote the old value back. The gate goes, and the column
-- goes with it so nothing can.
--
-- THE EMPTY-CONVERSATION REFUSAL STAYS. It was the honest half of the same
-- check: a share built from no messages publishes a title and nothing else.

BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_share_conversation(
  p_conversation_id uuid,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  conversation record;
  snapshot jsonb;
  total integer;
  result text;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to share a conversation.'
      USING ERRCODE = 'PT403', DETAIL = 'authentication_required';
  END IF;

  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'A share cannot expire in the past.'
      USING ERRCODE = 'PT422', DETAIL = 'expiry_in_past';
  END IF;

  SELECT id, title, user_id
    INTO conversation
    FROM public.ocade_conversations
   WHERE id = p_conversation_id;

  /*
   * ONE MESSAGE FOR "NOT YOURS" AND "DOES NOT EXIST".
   *
   * Telling the caller which of the two it was would let anybody test whether a
   * given conversation id exists on the platform.
   */
  IF conversation.id IS NULL OR conversation.user_id <> actor THEN
    RAISE EXCEPTION 'That conversation is not available to share.'
      USING ERRCODE = 'PT403', DETAIL = 'not_found_or_forbidden';
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'role', m.role,
          'content', m.content,
          'created_at', m.created_at,
          /*
           * The COUNT, not the attachments. A reader is entitled to know a
           * document was read; they are not entitled to its name.
           */
          'attachment_count', COALESCE(jsonb_array_length(m.attachments), 0)
        )
        ORDER BY m.created_at
      ),
      '[]'::jsonb
    ),
    COUNT(*)
  INTO snapshot, total
  FROM public.ocade_messages m
  WHERE m.conversation_id = p_conversation_id;

  IF total = 0 THEN
    RAISE EXCEPTION 'There is nothing in this conversation to share yet.'
      USING ERRCODE = 'PT409', DETAIL = 'conversation_empty';
  END IF;

  UPDATE public.ocade_conversation_shares
     SET title = conversation.title,
         messages = snapshot,
         message_count = total,
         snapshot_at = now(),
         expires_at = p_expires_at
   WHERE conversation_id = p_conversation_id
     AND revoked_at IS NULL
  RETURNING token INTO result;

  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  INSERT INTO public.ocade_conversation_shares
    (conversation_id, owner_id, title, messages, message_count, expires_at)
  VALUES
    (p_conversation_id, actor, conversation.title, snapshot, total, p_expires_at)
  RETURNING token INTO result;

  RETURN result;
END;
$$;

ALTER TABLE public.ocade_conversations DROP COLUMN IF EXISTS privacy_mode;

COMMIT;
