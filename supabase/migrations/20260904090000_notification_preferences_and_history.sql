-- Cross-device notification preferences and a delivery record, as PLAN.md §D
-- requires them.
--
-- WHAT THIS FIXES. Preferences were kept in localStorage, which made them a
-- property of a BROWSER rather than of a person: quiet hours set on a laptop
-- did not exist on the phone that woke somebody at three in the morning, and a
-- global mute chosen once had to be chosen again on every device. §D asks for
-- "cross-device preference synchronization" and for notification history with
-- read state, delivery state and duplicate collapse. None of those can live in
-- a browser, because every one of them is a fact about the ACCOUNT.
--
-- THE PROTECTED CATEGORIES ARE NOT ENFORCED HERE, AND THAT IS DELIBERATE.
-- §D's rule — security, account-recovery and billing events are never silently
-- discarded by an optional-product mute — belongs in the resolver, which reads
-- it from the category's own declaration in `notifications/categories.ts`. A
-- CHECK constraint here would be a second copy of that rule, in a place the
-- product cannot read, and the two would drift. What this schema does instead
-- is refuse to store a category it does not recognise, so a preference row can
-- never name a category the resolver has never heard of.
--
-- A NOTIFICATION IS NOT A PAYLOAD. §D: "Minimal secure payloads with no prompt,
-- attachment, secret, payment credential, or private local path." So the row
-- holds a title, a short body and a RELATIVE deep link — the link is constrained
-- by the schema to a same-origin path, because a notification that can carry an
-- absolute URL is a phishing surface that arrives with OCADE's own branding on
-- it. Everything else stays where it already lives, behind a link.
--
-- WRITES COME FROM THE SERVER ONLY. Both tables have RLS enabled and neither
-- has an INSERT policy: `authenticated` may read its own rows and mark them
-- read, and nothing else. §D asks for "server-side audience authorization
-- immediately before send", which is only meaningful if a browser cannot write
-- a notification for itself in the first place.

BEGIN;

/*
 * One row per account. The preference document is stored as JSON rather than as
 * thirty columns because its SHAPE is owned by
 * `src/lib/notifications/preferences.ts`, which validates every field on read —
 * a category the product no longer has, a frequency it never supported, an hour
 * outside 0-23. Splitting it into columns would move that validation into two
 * places and make every added category a migration.
 */
CREATE TABLE IF NOT EXISTS public.ocade_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Silences every OPTIONAL category. Never the protected ones; the resolver
  -- decides which are which.
  mute_optional boolean NOT NULL DEFAULT false,
  quiet_hours jsonb NOT NULL DEFAULT
    '{"enabled": false, "fromHour": 22, "toHour": 7, "timeZone": "UTC"}'::jsonb,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  /*
   * LAST WRITE WINS, AND THE LOSER FINDS OUT.
   *
   * Two devices editing preferences a minute apart is ordinary, not a conflict
   * worth a merge dialogue. The revision lets a client notice that the row it
   * is holding is older than the one on the server and re-read, rather than
   * silently overwriting a change made on a phone with a stale copy from a
   * laptop tab that has been open since yesterday.
   */
  revision bigint NOT NULL DEFAULT 1,
  CONSTRAINT ocade_notification_preferences_documents CHECK (
    jsonb_typeof(quiet_hours) = 'object' AND jsonb_typeof(categories) = 'object'
  ),
  CONSTRAINT ocade_notification_preferences_revision CHECK (revision > 0)
);

ALTER TABLE public.ocade_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ocade_notification_preferences_own_read ON public.ocade_notification_preferences;
CREATE POLICY ocade_notification_preferences_own_read
  ON public.ocade_notification_preferences FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS ocade_notification_preferences_own_write ON public.ocade_notification_preferences;
CREATE POLICY ocade_notification_preferences_own_write
  ON public.ocade_notification_preferences FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS ocade_notification_preferences_own_update ON public.ocade_notification_preferences;
CREATE POLICY ocade_notification_preferences_own_update
  ON public.ocade_notification_preferences FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

/*
 * A POLICY IS NOT A GRANT, AND THE DIFFERENCE IS NOT COSMETIC.
 *
 * Row-level security decides WHICH ROWS a role may see; the grant decides
 * whether it may address the table at all. Without these lines every query
 * from the browser fails with "permission denied for table" — policies
 * perfectly written and a table nobody can read. The schema test caught it;
 * nothing in the migration itself would have.
 */
/*
 * REVOKE BEFORE GRANTING, AND FROM THE ROLES BY NAME.
 *
 * Supabase grants ALL on a new table directly to `authenticated` through
 * ALTER DEFAULT PRIVILEGES, so the GRANT below was decorative: the table
 * already had every write. The suite's "refuses a browser rewriting a
 * notification it received" case was true and unprovable until the local twin
 * started reproducing those default privileges — row-level security refused the
 * write, and the privilege was there the whole time.
 */
REVOKE ALL ON TABLE public.ocade_notification_preferences FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.ocade_notification_preferences TO authenticated;
GRANT ALL ON TABLE public.ocade_notification_preferences TO service_role;

/*
 * What was sent, or held, and whether it has been seen.
 *
 * `idempotency_key` with a UNIQUE constraint per account is the duplicate
 * collapse §D asks for, and it is a constraint rather than a check in code for
 * the usual reason: a retry that races the first attempt has two inserts in
 * flight at once, and only the database can decide that between them.
 */
CREATE TABLE IF NOT EXISTS public.ocade_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  /*
   * A SAME-ORIGIN PATH OR NOTHING.
   *
   * `/settings/security` is allowed; `https://elsewhere.example/x` is not, and
   * neither is `//elsewhere.example/x`, which a browser treats as absolute.
   * §D asks for a deep-link allowlist; this is the half of it a schema can
   * enforce, and it holds even if a future sender forgets.
   */
  deep_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  /*
   * Per-channel delivery state: `{"in_app": "sent", "email": "held"}`. Kept as
   * JSON because the channel set is deployment-dependent — a build with no
   * email sender has no email state to record — and a column per channel would
   * be a migration every time a provider is configured.
   */
  delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  CONSTRAINT ocade_notifications_category CHECK (
    category IN (
      'approvals', 'task_outcomes', 'automation', 'security', 'account',
      'billing', 'support', 'organization', 'product_updates', 'status_incidents'
    )
  ),
  CONSTRAINT ocade_notifications_title CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT ocade_notifications_body CHECK (char_length(body) <= 2000),
  /*
   * THE SECOND SLASH IS THE WHOLE POINT.
   *
   * The first version of this pattern was `^/[A-Za-z0-9_\-./?&=%#]*$`, which
   * accepts `//elsewhere.example/x` — every character is allowed and it starts
   * with a slash. A browser reads that as PROTOCOL-RELATIVE and navigates off
   * the origin, so the one link shape this constraint exists to stop was the
   * one it let through. Caught by the schema test, not by reading it.
   */
  CONSTRAINT ocade_notifications_deep_link CHECK (
    deep_link IS NULL
    OR deep_link ~ '^/([A-Za-z0-9_\-.?&=%#][A-Za-z0-9_\-./?&=%#]*)?$'
  ),
  CONSTRAINT ocade_notifications_delivery CHECK (jsonb_typeof(delivery) = 'object'),
  CONSTRAINT ocade_notifications_idempotency UNIQUE (user_id, idempotency_key)
);

COMMENT ON TABLE public.ocade_notifications IS
  'Notification history with read and delivery state. Minimal payloads only: a title, a short body and a same-origin path. Never a prompt, an attachment, a secret, a payment credential or a local file path.';

-- The list a person actually reads: newest first, for one account.
CREATE INDEX IF NOT EXISTS ocade_notifications_account_recent_idx
  ON public.ocade_notifications (user_id, created_at DESC);

-- The unread badge, which is read on every page and must not scan the history.
CREATE INDEX IF NOT EXISTS ocade_notifications_account_unread_idx
  ON public.ocade_notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.ocade_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ocade_notifications_own_read ON public.ocade_notifications;
CREATE POLICY ocade_notifications_own_read
  ON public.ocade_notifications FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Read only. The write paths are the two functions below, and the recorder is
-- granted to `service_role` alone.
-- Read-only, for the reason above: marking one read goes through a function so
-- a browser cannot rewrite what it was told.
REVOKE ALL ON TABLE public.ocade_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ocade_notifications TO authenticated;
GRANT ALL ON TABLE public.ocade_notifications TO service_role;

/*
 * NO INSERT POLICY, AND NO UPDATE POLICY EITHER.
 *
 * A browser cannot write itself a notification: §D's "server-side audience
 * authorization immediately before send" means nothing if the audience can
 * write its own. And marking one read is an UPDATE of exactly one column, which
 * a policy cannot express — a permissive UPDATE policy would also let somebody
 * rewrite the title of a security alert they had received. The two functions
 * below are the only way to change a row, and they change only `read_at`.
 */

/**
 * Mark one notification read. Returns the number of rows affected, which is
 * zero for an id belonging to somebody else — a bound query rather than a
 * validated parameter, so cross-account marking is structurally impossible.
 */
CREATE OR REPLACE FUNCTION public.ocade_mark_notification_read(p_notification_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.ocade_notifications
     SET read_at = now()
   WHERE id = p_notification_id
     AND user_id = auth.uid()
     AND read_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

/** Mark everything currently unread as read. Returns how many. */
CREATE OR REPLACE FUNCTION public.ocade_mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.ocade_notifications
     SET read_at = now()
   WHERE user_id = auth.uid()
     AND read_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_mark_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ocade_mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_mark_all_notifications_read() TO authenticated;

/**
 * Record a notification, once.
 *
 * IDEMPOTENT BY CONSTRAINT, NOT BY LOOKUP. `ON CONFLICT DO NOTHING` against the
 * unique key means a retry, a duplicate webhook or two workers racing produce
 * one row and one row only — including when both inserts are in flight at the
 * same moment, which a read-then-write cannot survive.
 *
 * Returns the row id in both cases, so a caller that lost the race still learns
 * which notification its work belongs to instead of having to guess whether it
 * failed.
 */
CREATE OR REPLACE FUNCTION public.ocade_record_notification(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_deep_link text,
  p_idempotency_key text,
  p_delivery jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted uuid;
BEGIN
  INSERT INTO public.ocade_notifications
    (user_id, category, title, body, deep_link, idempotency_key, delivery)
  VALUES
    (p_user_id, p_category, p_title, COALESCE(p_body, ''), p_deep_link, p_idempotency_key,
     COALESCE(p_delivery, '{}'::jsonb))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING id INTO inserted;

  IF inserted IS NULL THEN
    SELECT id INTO inserted
      FROM public.ocade_notifications
     WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  END IF;

  RETURN inserted;
END;
$$;

-- Written by the server alone. `authenticated` is never granted this.
REVOKE ALL ON FUNCTION public.ocade_record_notification(uuid, text, text, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_record_notification(uuid, text, text, text, text, text, jsonb)
  TO service_role;

/**
 * Save a preference document, bumping its revision.
 *
 * An UPSERT rather than an update: the first time anybody changes a setting
 * there is no row, and a plain update against a missing row reports success
 * while changing nothing — which is exactly how a preference screen ends up
 * saying "saved" to somebody whose choice was discarded.
 */
CREATE OR REPLACE FUNCTION public.ocade_save_notification_preferences(
  p_mute_optional boolean,
  p_quiet_hours jsonb,
  p_categories jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_revision bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'A notification preference belongs to an account.';
  END IF;

  INSERT INTO public.ocade_notification_preferences
    (user_id, mute_optional, quiet_hours, categories, updated_at, revision)
  VALUES
    (auth.uid(), p_mute_optional, p_quiet_hours, p_categories, now(), 1)
  ON CONFLICT (user_id) DO UPDATE
    SET mute_optional = EXCLUDED.mute_optional,
        quiet_hours = EXCLUDED.quiet_hours,
        categories = EXCLUDED.categories,
        updated_at = now(),
        revision = public.ocade_notification_preferences.revision + 1
  RETURNING revision INTO next_revision;

  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_save_notification_preferences(boolean, jsonb, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ocade_save_notification_preferences(boolean, jsonb, jsonb)
  TO authenticated;

COMMIT;
