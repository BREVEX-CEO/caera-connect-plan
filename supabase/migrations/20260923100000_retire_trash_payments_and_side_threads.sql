-- Retire schema the current product no longer has.
--
-- Applied together with the web release that stops reading it. Every object
-- below was checked empty or uncalled on the live project before this was
-- written (2026-09-23): zero subscription, invoice, payment-event and webhook
-- rows; zero trashed conversations; zero messages with an anchor, citation,
-- reaction or token-usage value; no trigger, policy or caller for the helper
-- functions.
--
-- F09: Delete is permanent after confirmation, so the Trash column and its
-- purge functions go.
-- F28: paid checkout is closed and tier comes from audited grants only, so the
-- old provider tables and webhook function go.
-- Side conversations, citations and reactions were retired with their UI.

BEGIN;

DO $$
DECLARE
  _fn REGPROCEDURE;
BEGIN
  FOR _fn IN
    SELECT p.oid::regprocedure
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'ocade_purge_expired_conversation_trash',
         'ocade_conversation_trash_days',
         'apply_payment_webhook_event',
         'has_active_subscription',
         'enforce_controlled_rollout_evidence',
         'enforce_resume_attestation',
         'attachment_deletion_status',
         'ocade_admin_notification_delivery'
       )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', _fn);
  END LOOP;
END $$;

ALTER TABLE public.ocade_conversations DROP COLUMN IF EXISTS deleted_at;

-- Invoices reference payment events, so they go first.
DROP TABLE IF EXISTS public.ocade_invoices;
DROP TABLE IF EXISTS public.ocade_payment_events;
DROP TABLE IF EXISTS public.payment_webhook_events;
DROP TABLE IF EXISTS public.subscriptions;

-- The transcript truncation filtered side threads; with none left it is the
-- plain owner-scoped delete. Replaced first so it never names a dropped column.
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
     AND created_at >= p_from;

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

ALTER TABLE public.ocade_messages DROP COLUMN IF EXISTS anchor_message_id;
ALTER TABLE public.ocade_messages DROP COLUMN IF EXISTS citations;
ALTER TABLE public.ocade_messages DROP COLUMN IF EXISTS reaction;
ALTER TABLE public.ocade_messages DROP COLUMN IF EXISTS token_usage;

COMMIT;
