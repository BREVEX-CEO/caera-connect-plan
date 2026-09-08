/*
 * SHARING A CONVERSATION — PLAN.md §8 ("share") and §7's Share/export control.
 *
 * The one capability in §8 that hands a person's own words to somebody who is
 * not signed in. Everything below is shaped by that.
 *
 * A SNAPSHOT, NOT A WINDOW. The share stores the transcript as it was WHEN IT
 * WAS SHARED. A live view onto the conversation would keep publishing whatever
 * was said next — somebody shares an exchange, carries on privately in the same
 * thread, and every later message is on the public link without a further
 * decision. That is not a subtle failure mode; it is the obvious one, and it is
 * the reason a snapshot costs a `jsonb` column. Re-sharing takes a new snapshot,
 * and the interface says so before it does.
 *
 * NO ATTACHMENTS. The snapshot carries role, text and time. It does not carry
 * attachment names, and it carries no file. "Share this conversation" is not
 * consent to publish the documents that were read during it, and a file name
 * alone can disclose more than the conversation does.
 *
 * ONLY A SYNCHRONISED CONVERSATION CAN BE SHARED. A Browser-Only or PC Vault
 * conversation's messages are on the person's own machine and deliberately not
 * here, so a share built from `ocade_messages` would be an EMPTY transcript
 * published under the conversation's title — a silent wrong answer. It is
 * refused with a reason instead. An incognito conversation has no row at all
 * and so cannot reach this function.
 *
 * THE TABLE IS NOT PUBLICLY READABLE. Public access is one SECURITY DEFINER
 * reader that takes the token and returns the four fields a reader needs. The
 * table itself is owner-only, so the link cannot be used to enumerate shares,
 * and `owner_id` — a real account identifier — never leaves the database.
 *
 * REVOCATION IS REAL AND IS NOT THE ONLY ONE. `revoked_at` stops the reader,
 * an optional `expires_at` stops it on its own, and the foreign key means
 * deleting the conversation — including through delete-all — takes the share
 * with it. A share that outlived the conversation it copied would be the exact
 * thing somebody clearing their history was trying to prevent.
 */

CREATE TABLE IF NOT EXISTS public.ocade_conversation_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /*
   * The unguessable half of the URL, and the ONLY credential a reader presents.
   *
   * 24 random bytes as hex. Long enough that guessing is not a strategy, and
   * hex rather than base64 because it survives every URL, shell, chat client
   * and QR encoder a link gets pasted into without a single escaping question.
   */
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  conversation_id uuid NOT NULL
    REFERENCES public.ocade_conversations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /* Snapshot fields. Deliberately copies rather than references. */
  title text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_count integer NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  /*
   * When the snapshot was taken, which is not the same as when the share was
   * created once re-sharing exists. The reader is shown this one, because it is
   * the honest answer to "how current is what I am reading".
   */
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

/*
 * AT MOST ONE LIVE LINK PER CONVERSATION.
 *
 * Not a storage saving. Somebody who has shared a conversation twice has two
 * links out in the world and one control to revoke; the second link is the one
 * they forget. One live share per conversation makes "stop sharing this" a
 * complete sentence.
 */
CREATE UNIQUE INDEX IF NOT EXISTS ocade_conversation_shares_one_live_idx
  ON public.ocade_conversation_shares (conversation_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS ocade_conversation_shares_owner_idx
  ON public.ocade_conversation_shares (owner_id, created_at DESC);

ALTER TABLE public.ocade_conversation_shares ENABLE ROW LEVEL SECURITY;

/*
 * The owner can see their own shares, and nobody else can see anything.
 *
 * `(SELECT auth.uid())` rather than a bare call: a bare `auth.uid()` is
 * re-evaluated once per row, which turns listing a long history into a
 * per-row function call.
 */
DROP POLICY IF EXISTS ocade_conversation_shares_owner_read
  ON public.ocade_conversation_shares;
CREATE POLICY ocade_conversation_shares_owner_read
  ON public.ocade_conversation_shares FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

/*
 * NO INSERT, UPDATE OR DELETE POLICY, deliberately.
 *
 * Every write goes through the two functions below, which decide the snapshot,
 * the token and the ownership check. A direct INSERT policy would let a client
 * choose what the "snapshot" contained, which is the whole thing this table
 * exists to control.
 *
 * Supabase's default privileges grant ALL on a new table directly to
 * `authenticated`, and a grant made directly to a role is NOT removed by
 * revoking from PUBLIC. Without the revoke below, a signed-in visitor holds the
 * table privilege and is stopped only by the missing policy — one defence where
 * there should be two.
 */
REVOKE ALL ON TABLE public.ocade_conversation_shares FROM anon, authenticated;
GRANT SELECT ON TABLE public.ocade_conversation_shares TO authenticated;

/**
 * Share a conversation, or refresh the snapshot of one already shared.
 *
 * Returns the token. The same conversation keeps the same token across a
 * refresh: a link somebody has already sent should not quietly stop working
 * because its owner updated what it shows.
 */
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

  IF conversation.privacy_mode IS DISTINCT FROM 'private_sync' THEN
    /*
     * The messages of a Browser-Only or PC Vault conversation are on the
     * person's own machine. Building a share from this table would publish an
     * empty transcript under a real title and tell nobody.
     */
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

/**
 * Stop sharing a conversation.
 *
 * Returns the number of links that stopped working, so the interface can say
 * "it was already not shared" rather than claiming to have revoked something.
 */
CREATE OR REPLACE FUNCTION public.ocade_revoke_conversation_share(
  p_conversation_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  revoked integer;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to stop sharing a conversation.'
      USING ERRCODE = 'PT403', DETAIL = 'authentication_required';
  END IF;

  /*
   * Scoped by `owner_id` inside a SECURITY DEFINER function, which runs as the
   * table's owner and therefore bypasses the policy above. The predicate IS the
   * access control here; without it this function would revoke anybody's share.
   */
  WITH stopped AS (
    UPDATE public.ocade_conversation_shares
       SET revoked_at = now()
     WHERE conversation_id = p_conversation_id
       AND owner_id = actor
       AND revoked_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO revoked FROM stopped;

  RETURN COALESCE(revoked, 0);
END;
$$;

/**
 * Read a shared conversation by its link.
 *
 * The ONLY public entry point, and it returns four fields: the title, the
 * snapshot, when the snapshot was taken, and how many messages it holds. No
 * owner, no conversation id, no share id — a reader who has the link learns
 * what was shared and nothing about who shared it.
 *
 * A revoked, expired or unknown token all return NOTHING, and identically. A
 * distinguishable "revoked" answer would confirm that a link had once been real,
 * which is information the holder of a dead link is not owed.
 */
CREATE OR REPLACE FUNCTION public.ocade_read_shared_conversation(p_token text)
RETURNS TABLE (
  title text,
  messages jsonb,
  message_count integer,
  snapshot_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.title, s.messages, s.message_count, s.snapshot_at
    FROM public.ocade_conversation_shares s
   WHERE s.token = p_token
     AND s.revoked_at IS NULL
     AND (s.expires_at IS NULL OR s.expires_at > now());
$$;

/*
 * EXECUTE is granted deliberately and narrowly.
 *
 * Supabase grants EXECUTE on new functions to PUBLIC, so each is revoked first
 * and then granted to exactly the roles that should hold it. Only the reader is
 * public; sharing and revoking need an account, and both check ownership
 * regardless.
 */
REVOKE ALL ON FUNCTION public.ocade_share_conversation(uuid, timestamptz)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_revoke_conversation_share(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_read_shared_conversation(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ocade_share_conversation(uuid, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_revoke_conversation_share(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_read_shared_conversation(text)
  TO anon, authenticated;
