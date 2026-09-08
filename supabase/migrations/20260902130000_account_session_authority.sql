-- Real authenticated sessions, as PLAN.md §C requires them.
--
-- WHAT THIS FIXES. OCADE's Security page listed approved DEVICES — rows in
-- `ocade_devices` that the product writes when a browser registers itself. That
-- is a useful list and it is not the list §C asks for. A device row survives a
-- sign-out; a session is the thing that can actually read the account right
-- now. Someone checking "who is signed in to my account?" after losing a laptop
-- needs the second list, and was being shown the first.
--
-- WHY THIS IS SQL AND NOT AN ADMIN API CALL. `auth.sessions` lives outside the
-- `public` schema, so PostgREST cannot reach it and the service-role client
-- cannot select from it. The admin `signOut` endpoint takes a JWT — the token
-- of the session being ended — so it can only ever end the session whose token
-- is in hand. Neither can list another session or revoke a named one, which is
-- exactly what "revoke this other session" means.
--
-- OWNERSHIP IS IN THE WHERE CLAUSE, NOT IN A CHECK ABOVE IT. Every function
-- takes the account id and constrains on `user_id = p_user_id`, so a session id
-- belonging to somebody else matches no row and revokes nothing. A caller that
-- passed a stranger's session id gets zero rows affected rather than a
-- successful cross-account revocation — the difference between a bound query
-- and a validated parameter is that the bound query cannot be forgotten.
--
-- DELETING A SESSION ROW IS A REAL REVOCATION. `auth.refresh_tokens` and
-- `auth.mfa_amr_claims` both reference it ON DELETE CASCADE, so the refresh
-- token dies with it and the session cannot be renewed. The access token it
-- already issued remains valid until it expires, which is why PLAN.md §C also
-- asks for a bounded JWT lifetime — revocation is not instantaneous and the
-- product must not imply that it is.

BEGIN;

/*
 * Every session on this account.
 *
 * Returns no token, no refresh token and no HMAC key — nothing here can be
 * replayed. `ip` is rendered as text rather than `inet` so a caller cannot
 * accidentally serialise a Postgres type, and it is the only piece of location
 * information offered: a coarse address the person can recognise as "mine or
 * not", never a resolved place.
 */
CREATE OR REPLACE FUNCTION public.ocade_list_account_sessions(p_user_id UUID)
RETURNS TABLE (
  session_id uuid,
  created_at timestamptz,
  last_seen_at timestamptz,
  expires_at timestamptz,
  assurance text,
  user_agent text,
  ip_address text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    s.id,
    s.created_at,
    -- `refreshed_at` is the most recent proof the session is still in use; it
    -- is `timestamp` rather than `timestamptz` in this schema, and reading it
    -- as local time would report a session as hours stale or hours in the
    -- future depending on the server's zone.
    COALESCE(s.refreshed_at AT TIME ZONE 'UTC', s.updated_at, s.created_at),
    s.not_after,
    s.aal::text,
    s.user_agent,
    host(s.ip)
  FROM auth.sessions s
  WHERE s.user_id = p_user_id
  ORDER BY COALESCE(s.refreshed_at AT TIME ZONE 'UTC', s.updated_at, s.created_at) DESC;
$$;

/*
 * Revoke ONE named session belonging to this account.
 *
 * Returns how many rows went, so a caller can tell "revoked" from "there was
 * nothing there" — and never reports success for a session it did not own.
 */
CREATE OR REPLACE FUNCTION public.ocade_revoke_account_session(
  p_user_id UUID,
  p_session_id UUID
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_removed integer;
BEGIN
  DELETE FROM auth.sessions
    WHERE id = p_session_id
      AND user_id = p_user_id;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RETURN v_removed;
END;
$$;

/*
 * Revoke every session EXCEPT one.
 *
 * The "sign out everywhere else" case, and the reason it takes the session to
 * keep rather than a list to remove: a person doing this has just been told
 * something is wrong, and the safe operation is "keep only where I am now",
 * which cannot miss a session that appeared between reading the list and
 * pressing the button.
 *
 * A NULL keeps nothing, which makes this the "revoke all" case too — one
 * statement rather than two that could drift.
 */
CREATE OR REPLACE FUNCTION public.ocade_revoke_other_account_sessions(
  p_user_id UUID,
  -- DEFAULT NULL so "keep nothing" is expressed by OMITTING the argument
  -- rather than by passing a null the generated types would have to be cast
  -- around. Revoking everything is the same statement with nothing kept.
  p_keep_session_id UUID DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_removed integer;
BEGIN
  DELETE FROM auth.sessions
    WHERE user_id = p_user_id
      AND (p_keep_session_id IS NULL OR id <> p_keep_session_id);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RETURN v_removed;
END;
$$;

/*
 * Does this session id genuinely belong to this account, and is it still live?
 *
 * PLAN.md §C: "Verify `session_id` against `auth.sessions` for highly sensitive
 * server operations." A JWT stays valid until it expires even after its session
 * is revoked, so a signed token is NOT proof that the session behind it still
 * exists. For anything irreversible, the row is what to trust.
 */
CREATE OR REPLACE FUNCTION public.ocade_session_is_live(
  p_user_id UUID,
  p_session_id UUID
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.sessions s
    WHERE s.id = p_session_id
      AND s.user_id = p_user_id
      AND (s.not_after IS NULL OR s.not_after > now())
  );
$$;

REVOKE ALL ON FUNCTION public.ocade_list_account_sessions(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_list_account_sessions(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.ocade_revoke_account_session(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_revoke_account_session(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.ocade_revoke_other_account_sessions(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_revoke_other_account_sessions(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.ocade_session_is_live(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_session_is_live(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.ocade_list_account_sessions(UUID) IS
  'Real authenticated sessions for one account, from auth.sessions. Distinct from ocade_devices, which records approved devices and outlives a sign-out. Returns no token or refresh material.';

COMMIT;
