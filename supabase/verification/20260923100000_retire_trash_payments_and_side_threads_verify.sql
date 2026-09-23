-- Prove the retired schema is gone and the current tables still stand.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'ocade_conversations'
                AND column_name = 'deleted_at') THEN
    RAISE EXCEPTION 'conversations still carry a trash column';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public'
                AND c.relname IN ('subscriptions', 'ocade_invoices', 'ocade_payment_events',
                                  'payment_webhook_events')) THEN
    RAISE EXCEPTION 'a retired payment table still exists';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND p.proname IN ('apply_payment_webhook_event',
                                  'ocade_purge_expired_conversation_trash',
                                  'has_active_subscription')) THEN
    RAISE EXCEPTION 'a retired function still exists';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'ocade_messages'
                AND column_name IN ('anchor_message_id', 'citations', 'reaction', 'token_usage')) THEN
    RAISE EXCEPTION 'messages still carry retired columns';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ocade_entitlement_grants') THEN
    RAISE EXCEPTION 'the entitlement grant authority is missing';
  END IF;
END $$;
