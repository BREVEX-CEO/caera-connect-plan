-- Verification for 20260905090000_conversation_share_links.

DO $$
BEGIN
  IF to_regclass('public.ocade_conversation_shares') IS NULL THEN
    RAISE EXCEPTION 'the conversation-share table is missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
           WHERE oid = 'public.ocade_conversation_shares'::regclass) THEN
    RAISE EXCEPTION 'row-level security is off on the conversation-share table';
  END IF;
END $$;

-- A SIGNED-OUT VISITOR MUST NOT REACH THE TABLE.
-- The link is read through one SECURITY DEFINER function that returns four
-- fields. Table access would let a token holder — or anybody — enumerate every
-- share on the platform and read `owner_id`, a real account identifier.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.ocade_conversation_shares', 'SELECT') THEN
    RAISE EXCEPTION 'a signed-out visitor can read the share table directly';
  END IF;
  IF has_table_privilege('authenticated', 'public.ocade_conversation_shares', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ocade_conversation_shares', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ocade_conversation_shares', 'DELETE') THEN
    RAISE EXCEPTION 'a signed-in visitor holds a write privilege on the share table';
  END IF;
END $$;

-- EVERY POLICY ON THIS TABLE IS A READ POLICY, AND IT IS THE OWNER'S OWN ROWS.
-- Asserting "there is no UPDATE policy" would miss a FOR ALL policy entirely,
-- so the shape is asserted instead: `polcmd = 'r'` is SELECT.
DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(polname || ' (' || polcmd::text || ')', ', ') INTO offending
    FROM pg_policy
   WHERE polrelid = 'public.ocade_conversation_shares'::regclass
     AND polcmd <> 'r';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'the share table has a non-SELECT policy: %', offending;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid = 'public.ocade_conversation_shares'::regclass
       AND polcmd = 'r'
       AND pg_get_expr(polqual, polrelid) LIKE '%owner_id%'
  ) THEN
    RAISE EXCEPTION 'the share read policy is not scoped to the owner';
  END IF;
END $$;

-- ONE LIVE LINK PER CONVERSATION. Two live links mean two things to revoke and
-- one control to do it with; the second is the one that gets forgotten.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'ocade_conversation_shares'
       AND indexname = 'ocade_conversation_shares_one_live_idx'
  ) THEN
    RAISE EXCEPTION 'nothing stops a conversation having two live share links';
  END IF;
END $$;

-- THE SNAPSHOT IS TAKEN BY THE FUNCTION, NOT SUPPLIED BY THE CALLER, and the
-- reader is the only public entry point.
DO $$
BEGIN
  IF NOT has_function_privilege('anon',
       'public.ocade_read_shared_conversation(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'a signed-out visitor cannot open a share link';
  END IF;
  IF has_function_privilege('anon',
       'public.ocade_share_conversation(uuid, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'a signed-out visitor can create a share';
  END IF;
  IF has_function_privilege('anon',
       'public.ocade_revoke_conversation_share(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'a signed-out visitor can revoke somebody''s share';
  END IF;
END $$;

-- A DEVICE-ONLY CONVERSATION IS REFUSED RATHER THAN SHARED EMPTY.
DO $$
DECLARE
  body text;
BEGIN
  SELECT prosrc INTO body FROM pg_proc
   WHERE oid = 'public.ocade_share_conversation(uuid, timestamptz)'::regprocedure;
  IF body NOT LIKE '%private_sync%' THEN
    RAISE EXCEPTION 'sharing does not check that the conversation is synchronised';
  END IF;
  IF body NOT LIKE '%user_id <> actor%' THEN
    RAISE EXCEPTION 'sharing does not check that the caller owns the conversation';
  END IF;
END $$;

-- REVOKING IS SCOPED TO THE CALLER. A SECURITY DEFINER function bypasses the
-- policy above, so the predicate inside it IS the access control.
DO $$
DECLARE
  body text;
BEGIN
  SELECT prosrc INTO body FROM pg_proc
   WHERE oid = 'public.ocade_revoke_conversation_share(uuid)'::regprocedure;
  IF body NOT LIKE '%owner_id = actor%' THEN
    RAISE EXCEPTION 'revoking a share is not scoped to the caller''s own shares';
  END IF;
END $$;
