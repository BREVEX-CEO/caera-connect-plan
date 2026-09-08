/*
 * HIGH-RISK ORGANIZATION ACTIONS MUST BE PROVED, NOT MERELY PERMITTED.
 *
 * THE DEFECT THIS CLOSES. OCADE already had an assurance authority — pure,
 * exhaustively tested, and enforced by `requireAssurance(HIGH_RISK)` on the
 * server functions that delete an account, revoke sessions and change a second
 * factor. The organization mutations do not go through a server function. They
 * are RPCs the browser calls directly, so the middleware never ran, and
 * `PLAN.md` §B names ownership and organization deletion as high-risk
 * explicitly. An unlocked laptop, ten seconds, and a workspace was gone.
 *
 * WHY THE RULE MOVES INTO THE DATABASE RATHER THAN INTO A NEW SERVER FUNCTION.
 * Wrapping the RPCs in server functions would put the check in front of the
 * door while leaving the door open: `authenticated` holds EXECUTE on these
 * functions and PostgREST exposes them to anybody with a token. The grant is
 * the real boundary, so the rule belongs where the grant is. This is the same
 * argument `admin/route-gate.ts` already makes about rendering: a check the
 * caller can skip is not a check.
 *
 * THE RULE IS THE ONE ALREADY WRITTEN, NOT A SECOND ONE. `assurance.ts`
 * decides three things, and every one of them is reproduced here rather than
 * reinterpreted:
 *
 *   1. AAL2 is required FOR ENROLLED ACCOUNTS. Demanding it from an account
 *      with no second factor is not strictness, it is a permanent refusal with
 *      no way out, and the way out that gets invented later is always weaker.
 *   2. Recency is required from EVERYONE. Assurance says how strongly somebody
 *      authenticated; it says nothing about when. A session that answered a
 *      code this morning is fully assured and not recent.
 *   3. An unknown proof time is NOT recent. It fails closed.
 *
 * The window is ten minutes in both places. `organization-assurance.test.ts`
 * asserts the two constants agree, because a security window that drifts
 * between two languages is a window nobody is enforcing.
 *
 * WHAT THE CALLER GETS BACK. `PT403` is PostgREST's convention for "answer 403
 * with this message", so a refusal arrives as a refusal rather than as a
 * server error, and DETAIL carries a stable machine token — `factor_required`
 * or `reauthentication_required` — so the screen can offer the right next step
 * instead of an apology. The two are genuinely different doors: sending
 * somebody to re-enter a password when what they need is the code from their
 * authenticator is a loop that never ends.
 */

/**
 * How long a proof of identity counts as recent.
 *
 * Ten minutes, matching `RECENT_PROOF_MS`. A function rather than a literal
 * repeated in four bodies, so there is one place to read it and one place a
 * test can compare against the TypeScript constant.
 */
CREATE OR REPLACE FUNCTION public.ocade_recent_proof_window()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$ SELECT interval '10 minutes' $$;

/**
 * Does this account hold a VERIFIED second factor?
 *
 * SECURITY DEFINER because `auth.mfa_factors` is not the caller's to read, and
 * the question is about the caller's own account only — `auth.uid()` is the
 * whole of the WHERE clause, so a definer here cannot answer about anybody
 * else.
 */
CREATE OR REPLACE FUNCTION public.ocade_session_has_verified_factor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
     WHERE user_id = auth.uid()
       AND status = 'verified'
  )
$$;

/**
 * When this session last proved anything.
 *
 * Read from the token's authentication-methods list rather than from when the
 * session was created: signing in again and answering a factor challenge both
 * append an entry, and both are genuine fresh proof, while a token refresh
 * appends nothing and is not.
 *
 * Supabase reports these timestamps in SECONDS. Reading them as milliseconds
 * would place every proof in 1970 and make nothing ever recent — which fails
 * in the safe direction, but fails always.
 *
 * NULL when the list is absent or carries no usable timestamp. The caller
 * treats NULL as "not recent"; there is no reading of "OCADE cannot tell when
 * you last proved this" that means "just now".
 */
CREATE OR REPLACE FUNCTION public.ocade_session_last_proof_at()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT max(to_timestamp((entry ->> 'timestamp')::double precision))
    FROM jsonb_array_elements(
           CASE jsonb_typeof(auth.jwt() -> 'amr')
             WHEN 'array' THEN auth.jwt() -> 'amr'
             ELSE '[]'::jsonb
           END
         ) AS entry
   WHERE jsonb_typeof(entry -> 'timestamp') = 'number'
$$;

/**
 * Refuse unless this session is strongly and recently authenticated.
 *
 * `p_action` completes the sentence "… before %", so it reads as the thing the
 * person was doing — "deleting this organization" — rather than as a
 * permission name.
 *
 * ORDER MATTERS, for the same reason it does in `assurance.ts`: the factor
 * check comes first, because telling somebody to re-authenticate when what
 * they need is a factor challenge sends them round a loop — signing in again
 * produces another aal1 session.
 */
CREATE OR REPLACE FUNCTION public.ocade_require_recent_strong_auth(p_action text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  session_aal text := auth.jwt() ->> 'aal';
  enrolled boolean := public.ocade_session_has_verified_factor();
  proved_at timestamptz := public.ocade_session_last_proof_at();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before %.', p_action
      USING ERRCODE = 'PT403', DETAIL = 'authentication_required';
  END IF;

  IF enrolled AND COALESCE(session_aal, 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION
      'Confirm the code from your authenticator app before %. It only takes a moment and it stops somebody who finds this browser open from doing it instead.',
      p_action
      USING ERRCODE = 'PT403', DETAIL = 'factor_required';
  END IF;

  -- A proof in the future is not a proof. It means the clocks disagree, and
  -- accepting it would make a skewed clock a way past this check.
  IF proved_at IS NULL
     OR proved_at > now()
     OR now() - proved_at > public.ocade_recent_proof_window() THEN
    RAISE EXCEPTION
      'Confirm it is you before %. This is asked for anything that could lock somebody out of their work, however long you have been signed in.',
      p_action
      USING ERRCODE = 'PT403', DETAIL = 'reauthentication_required';
  END IF;
END;
$$;

/*
 * The four actions this is applied to, and why these four.
 *
 * Each one either destroys a workspace or changes somebody ELSE'S access to
 * one. Renaming an organization, creating a group and inviting somebody are
 * all reversible by the same administrator in the same screen, and putting a
 * factor challenge in front of ordinary administration is how a security
 * prompt becomes a thing people click through without reading.
 *
 * `ocade_set_organization_member_state` is deliberately NOT in the list:
 * deactivation is the reversible, cautious action an administrator reaches for
 * when they are unsure, and it is the one thing a locked-out administrator
 * still needs to be able to do quickly.
 *
 * Each body below is the existing one with a single line added. Nothing else
 * about them changes.
 */

CREATE OR REPLACE FUNCTION public.ocade_delete_organization(
  p_organization_id uuid,
  p_typed_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organizations;
BEGIN
  SELECT * INTO target FROM public.ocade_organizations WHERE id = p_organization_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN 0; END IF;
  IF NOT public.ocade_org_is_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner may delete this organization.';
  END IF;
  IF p_typed_name IS DISTINCT FROM target.name THEN
    RAISE EXCEPTION 'Type the organization name exactly to confirm.';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('deleting this organization');

  DELETE FROM public.ocade_organizations WHERE id = p_organization_id;
  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_transfer_organization_ownership(
  p_organization_id uuid,
  p_to_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient public.ocade_organization_members;
BEGIN
  IF NOT public.ocade_org_is_owner(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner may transfer ownership.';
  END IF;
  IF p_to_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You already own this organization.';
  END IF;

  SELECT * INTO recipient
    FROM public.ocade_organization_members
   WHERE organization_id = p_organization_id AND user_id = p_to_user_id
   FOR UPDATE;
  IF recipient.id IS NULL THEN
    RAISE EXCEPTION 'That person is not in this organization.';
  END IF;
  IF recipient.state <> 'active' THEN
    RAISE EXCEPTION 'A deactivated member cannot become the owner.';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('handing this organization to somebody else');

  UPDATE public.ocade_organization_members
     SET role = 'owner', updated_at = now()
   WHERE id = recipient.id;

  UPDATE public.ocade_organization_members
     SET role = 'admin', updated_at = now()
   WHERE organization_id = p_organization_id AND user_id = auth.uid();

  PERFORM public.ocade_record_organization_event(
    p_organization_id, 'ownership.transferred', p_to_user_id,
    jsonb_build_object('from', auth.uid())
  );

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_set_organization_member_role(
  p_member_id uuid,
  p_role text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_members;
  caller_role text;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_members WHERE id = p_member_id FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'That person is not in this organization.'; END IF;

  caller_role := public.ocade_org_role(target.organization_id);
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only an owner or admin may change a role.';
  END IF;
  -- Only an owner may create or unmake an owner.
  IF (p_role = 'owner' OR target.role = 'owner') AND caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner may change an owner''s role.';
  END IF;
  IF target.role = 'owner' AND p_role <> 'owner'
     AND public.ocade_org_active_owners(target.organization_id, target.id) = 0 THEN
    RAISE EXCEPTION 'This is the last owner. Make somebody else an owner first.';
  END IF;

  IF target.role = p_role THEN RETURN 0; END IF;
  -- Asked only when the role actually changes. A no-op that demanded a factor
  -- challenge would train people to answer one for nothing.
  PERFORM public.ocade_require_recent_strong_auth('changing what this person may do');

  UPDATE public.ocade_organization_members
     SET role = p_role, updated_at = now()
   WHERE id = p_member_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'member.role_changed', target.user_id,
    jsonb_build_object('from', target.role, 'to', p_role)
  );
  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_remove_organization_member(p_member_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_organization_members;
BEGIN
  SELECT * INTO target FROM public.ocade_organization_members WHERE id = p_member_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN 0; END IF;
  IF NOT public.ocade_org_can_administer(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may remove a member.';
  END IF;
  IF target.role = 'owner' AND NOT public.ocade_org_is_owner(target.organization_id) THEN
    RAISE EXCEPTION 'Only an owner may remove an owner.';
  END IF;
  IF target.role = 'owner'
     AND public.ocade_org_active_owners(target.organization_id, target.id) = 0 THEN
    RAISE EXCEPTION 'This is the last owner. Transfer ownership first.';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('removing this person from the organization');

  DELETE FROM public.ocade_organization_members WHERE id = p_member_id;

  PERFORM public.ocade_record_organization_event(
    target.organization_id, 'member.removed', target.user_id,
    jsonb_build_object('role', target.role)
  );
  RETURN 1;
END;
$$;

/*
 * The three new helpers answer only about the CALLER, and only in service of a
 * refusal. Nothing needs to call them from outside, and a SECURITY DEFINER
 * function reachable by the whole internet is the defect the schema gate exists
 * to find, so they are revoked from PUBLIC — which in Supabase includes `anon`
 * — and granted to nobody. Inside a SECURITY DEFINER body the current user is
 * the owner, so the four mutations reach them without a grant.
 */
REVOKE ALL ON FUNCTION public.ocade_recent_proof_window() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_session_has_verified_factor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_session_last_proof_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_require_recent_strong_auth(text) FROM PUBLIC, anon, authenticated;
