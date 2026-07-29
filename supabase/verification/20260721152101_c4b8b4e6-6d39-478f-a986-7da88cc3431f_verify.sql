-- Verification for 20260721152101 (Messenger schema).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['msg_threads','msg_thread_members','msg_cross_company_grants',
    'msg_messages','msg_message_edits','msg_attachments','msg_reactions','msg_pins',
    'msg_read_receipts','msg_message_links'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'missing table %', t; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname=t) THEN RAISE EXCEPTION 'RLS off on %', t; END IF;
  END LOOP;
  PERFORM 1 FROM pg_type WHERE typname='msg_thread_kind'; IF NOT FOUND THEN RAISE EXCEPTION 'missing enum msg_thread_kind'; END IF;
  PERFORM 1 FROM pg_proc WHERE proname='msg_is_thread_member'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function msg_is_thread_member'; END IF;
  RAISE NOTICE 'verify 20260721152101 OK';
END $$;
