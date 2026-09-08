-- Rollback for 20260905090000_conversation_share_links.
--
-- THIS BREAKS EVERY SHARE LINK, IMMEDIATELY AND WITHOUT NOTICE. Anybody holding
-- one gets nothing, and the snapshots that backed them are destroyed with the
-- table — there is no other copy, because a share is a copy of the transcript
-- taken at the moment it was shared and the conversation has moved on since.
--
-- Nothing else is affected. Conversations, messages and every other §8 control
-- are untouched: the share table only ever holds copies, and the Share control
-- reports the capability as unavailable when the function is missing rather
-- than failing in the interface.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_read_shared_conversation(text);
DROP FUNCTION IF EXISTS public.ocade_revoke_conversation_share(uuid);
DROP FUNCTION IF EXISTS public.ocade_share_conversation(uuid, timestamptz);
DROP TABLE IF EXISTS public.ocade_conversation_shares;

COMMIT;
