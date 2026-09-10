-- Reverses 20260910100000_conversation_storage_is_the_account.sql.
--
-- Restores the storage-mode column and the share-time gate exactly as
-- 20260905090000_conversation_share_links.sql left them. Existing rows take the
-- default, which is the value that gate lets through, so no conversation that
-- was shareable becomes unshareable on the way back.

BEGIN;

ALTER TABLE public.ocade_conversations
  ADD COLUMN IF NOT EXISTS privacy_mode text NOT NULL DEFAULT 'private_sync';

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

  SELECT id, title, privacy_mode, user_id
    INTO conversation
    FROM public.ocade_conversations
   WHERE id = p_conversation_id;

  IF conversation.id IS NULL OR conversation.user_id <> actor THEN
    RAISE EXCEPTION 'That conversation is not available to share.'
      USING ERRCODE = 'PT403', DETAIL = 'not_found_or_forbidden';
  END IF;

  IF conversation.privacy_mode IS DISTINCT FROM 'private_sync' THEN
    RAISE EXCEPTION 'This conversation is stored only on your device, so there is nothing here to share. Switch its storage to Private Sync first.'
      USING ERRCODE = 'PT409', DETAIL = 'conversation_not_synchronised';
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'role', m.role,
          'content', m.content,
          'created_at', m.created_at,
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

COMMIT;
