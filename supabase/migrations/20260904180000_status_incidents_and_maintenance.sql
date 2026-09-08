/*
 * INCIDENTS AND MAINTENANCE, PUBLISHED — PLAN.md §K, and §G's incident controls.
 *
 * §K asks for incident creation and updates, a timestamped incident history,
 * maintenance scheduling, and administrator incident controls. The status page
 * has, until now, carried a sentence saying it publishes none of that: "OCADE
 * does not publish an incident history yet. An empty list is not a claim that
 * there have been no incidents." That sentence was true and it is the thing
 * this migration retires.
 *
 * ONE TABLE FOR BOTH KINDS. A planned maintenance window and an unplanned
 * outage differ in one respect a reader cares about — whether it was expected —
 * and in nothing else: both name components, both run from a time to a time,
 * both accumulate updates, both belong on the same page in the same order. Two
 * tables would mean two readers, two feeds and two chances for one of them to
 * be forgotten when the page is changed.
 *
 * THE HISTORY IS APPEND-ONLY. `ocade_status_incident_updates` has no update or
 * delete path at all — not for an administrator, not for the service role
 * through any function here. An incident history that can be edited after the
 * fact is a record of what somebody currently wishes had been said, and the
 * whole value of publishing one is that it cannot become that.
 *
 * PUBLIC READ, BY DESIGN. Every other table in this schema is private. This one
 * is the exception, and deliberately: a status page nobody can read without an
 * account is not a status page. `anon` gets SELECT, so the fields are chosen on
 * the assumption that everything in them is public — there is no user id, no
 * account reference and no free-text field that a person's own data could
 * reach. The ADMINISTRATOR who acted is recorded, because §G asks who moved an
 * incident, and it is exposed to nobody: the column is readable only by
 * administrators, through a policy on a view of the same rows.
 *
 * NO INVENTED HISTORY. `PLAN.md` §K is explicit — "Do not invent historical
 * uptime or incidents. Begin measurements from the first verified observation."
 * Nothing here seeds a row.
 */

CREATE TABLE IF NOT EXISTS public.ocade_status_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /*
   * Which components this is about, by the catalogue's own ids.
   *
   * Not a foreign key, because the catalogue lives in source: it is the list
   * the probes are written against, and moving it into a table would put the
   * definition of "what OCADE is made of" somewhere a deployment could edit
   * without the probes changing with it. An id no longer in the catalogue is
   * dropped by the reader rather than shown as a name nobody recognises.
   */
  component_ids text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL CHECK (kind IN ('incident', 'maintenance')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  /*
   * How badly this affects somebody trying to use OCADE. Kept apart from the
   * lifecycle state below: an incident can be "monitoring" and still an outage,
   * and collapsing the two would make the page say "resolved" about something
   * that is still down.
   */
  impact text NOT NULL CHECK (impact IN ('degraded', 'outage', 'maintenance')),
  /*
   * Where it is in its life. The order is the one a reader expects to see it
   * move through, and `resolved` is terminal.
   */
  state text NOT NULL DEFAULT 'investigating'
    CHECK (state IN ('scheduled', 'investigating', 'identified', 'monitoring', 'resolved')),
  started_at timestamptz NOT NULL DEFAULT now(),
  /* Set for maintenance, which is announced before it happens. */
  scheduled_end timestamptz,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_status_incidents_resolution CHECK (
    (state = 'resolved') = (resolved_at IS NOT NULL)
  ),
  CONSTRAINT ocade_status_incidents_window CHECK (
    scheduled_end IS NULL OR scheduled_end > started_at
  ),
  CONSTRAINT ocade_status_incidents_resolved_after_start CHECK (
    resolved_at IS NULL OR resolved_at >= started_at
  )
);

CREATE INDEX IF NOT EXISTS ocade_status_incidents_time_idx
  ON public.ocade_status_incidents (started_at DESC);

/*
 * Every update ever posted, in order.
 *
 * `state` is repeated on each update rather than only on the incident, because
 * "what did we know at ten past three" is the question a history is read to
 * answer, and an incident row only ever holds the latest answer.
 */
CREATE TABLE IF NOT EXISTS public.ocade_status_incident_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL
    REFERENCES public.ocade_status_incidents(id) ON DELETE CASCADE,
  state text NOT NULL
    CHECK (state IN ('scheduled', 'investigating', 'identified', 'monitoring', 'resolved')),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ocade_status_incident_updates_incident_idx
  ON public.ocade_status_incident_updates (incident_id, created_at);

ALTER TABLE public.ocade_status_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_status_incident_updates ENABLE ROW LEVEL SECURITY;

/*
 * READABLE BY EVERYONE, INCLUDING SIGNED-OUT VISITORS.
 *
 * This is the only public-read table in the schema, and the reason it is safe
 * is structural rather than careful: there is no user id, no account reference
 * and no field a person's own data could reach. Everything in these two tables
 * was written by an administrator for publication.
 *
 * `created_by` is the one exception, and it is not exposed: the reader below
 * selects it only for administrators, and the public JSON never carries it.
 */
DROP POLICY IF EXISTS ocade_status_incidents_public_read ON public.ocade_status_incidents;
CREATE POLICY ocade_status_incidents_public_read
  ON public.ocade_status_incidents FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS ocade_status_incident_updates_public_read
  ON public.ocade_status_incident_updates;
CREATE POLICY ocade_status_incident_updates_public_read
  ON public.ocade_status_incident_updates FOR SELECT TO anon, authenticated
  USING (true);

/*
 * Supabase's default privileges grant ALL on a new table directly to
 * `authenticated`, and a grant made directly to a role is not removed by
 * revoking from PUBLIC. Without these lines any signed-in visitor could post
 * an incident — and there is no INSERT policy, so the write would be refused,
 * but a public status page must not depend on exactly one of the two.
 */
REVOKE ALL ON TABLE public.ocade_status_incidents FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_status_incident_updates FROM anon, authenticated;
GRANT SELECT ON TABLE public.ocade_status_incidents TO anon, authenticated;
GRANT SELECT ON TABLE public.ocade_status_incident_updates TO anon, authenticated;

/**
 * Open an incident, or schedule maintenance.
 *
 * The first update is written in the same transaction as the incident, because
 * an incident with no updates is a headline with no information — and the
 * window in which one exists is a window in which the status page shows exactly
 * that.
 */
CREATE OR REPLACE FUNCTION public.ocade_open_status_incident(
  p_kind text,
  p_title text,
  p_impact text,
  p_component_ids text[],
  p_body text,
  p_started_at timestamptz DEFAULT NULL,
  p_scheduled_end timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  opening_state text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an administrator may publish an incident.';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('publishing to the status page');

  -- Maintenance is announced before it happens; an incident is reported once it
  -- is already being looked at. Starting either in the other's state would put
  -- a sentence on the public page that is not true yet.
  opening_state := CASE WHEN p_kind = 'maintenance' THEN 'scheduled' ELSE 'investigating' END;

  INSERT INTO public.ocade_status_incidents (
    component_ids, kind, title, impact, state, started_at, scheduled_end, created_by
  )
  VALUES (
    COALESCE(p_component_ids, '{}'),
    p_kind,
    btrim(p_title),
    p_impact,
    opening_state,
    COALESCE(p_started_at, now()),
    p_scheduled_end,
    auth.uid()
  )
  RETURNING id INTO new_id;

  INSERT INTO public.ocade_status_incident_updates (incident_id, state, body, created_by)
  VALUES (new_id, opening_state, btrim(p_body), auth.uid());

  RETURN new_id;
END;
$$;

/**
 * Post an update, and move the incident to the state that update describes.
 *
 * ONE FUNCTION FOR BOTH, because they are one act. A separate "change state"
 * call would let an incident move from investigating to resolved with nothing
 * published about why, which is the failure a status page exists to prevent.
 *
 * Resolving stamps `resolved_at` here rather than trusting a caller's clock:
 * the time an incident ended is a fact about the server, and a browser that
 * sent its own would put the end before the beginning on a machine with a
 * skewed clock.
 */
CREATE OR REPLACE FUNCTION public.ocade_post_status_incident_update(
  p_incident_id uuid,
  p_state text,
  p_body text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.ocade_status_incidents;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an administrator may update an incident.';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('updating the status page');

  SELECT * INTO target FROM public.ocade_status_incidents
   WHERE id = p_incident_id FOR UPDATE;
  IF target.id IS NULL THEN
    RAISE EXCEPTION 'That incident does not exist.';
  END IF;
  IF target.state = 'resolved' THEN
    -- Reopening would rewrite what the page said had ended. A new incident is
    -- the honest way to report that something came back.
    RAISE EXCEPTION 'That incident is resolved. Open a new one if it has recurred.';
  END IF;

  INSERT INTO public.ocade_status_incident_updates (incident_id, state, body, created_by)
  VALUES (p_incident_id, p_state, btrim(p_body), auth.uid());

  UPDATE public.ocade_status_incidents
     SET state = p_state,
         resolved_at = CASE WHEN p_state = 'resolved' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_incident_id;

  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_open_status_incident(
  text, text, text, text[], text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ocade_post_status_incident_update(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_open_status_incident(
  text, text, text, text[], text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_post_status_incident_update(uuid, text, text)
  TO authenticated;
