/*
 * WHAT AN OPERATOR MAY SEE — PLAN.md §G.
 *
 * §G asks the admin panel for a usage overview, commercial-usage windows, an
 * audit log and notification delivery status, and ends with the sentence that
 * decides how this is written: "Ordinary users receive neither the route
 * content nor the underlying data."
 *
 * So the access is granted here, at the data, and not in the browser. A screen
 * that renders only for admins while the rows behind it stay reachable by
 * anybody with a token is a screen, not a boundary.
 *
 * READ, NEVER WRITE. Every policy below is `FOR SELECT`. An operator looking at
 * somebody's usage must not be able to change it — usage that an administrator
 * can edit is an allowance that can be granted by hand, which is the shape of
 * the thing `PLAN.md` insists must go through an audited entitlement instead.
 *
 * THE ONE PLACE THIS IS NOT A POLICY, and why. Notification delivery status is
 * asked for as an operational question — is delivery working? — and answering
 * it from raw rows would hand an operator every notification title and body in
 * the deployment, which is somebody's security alerts and support
 * correspondence. So that one is an aggregate function: counts by category,
 * channel and state, and nothing a person wrote or was told. An operator can
 * see that eleven emails dead-lettered yesterday without reading one of them.
 *
 * `ocade_payment_events`, `ocade_invoices` and the subscription tables are
 * DELIBERATELY ABSENT. §G asks for a billing and seat overview and for
 * payment-event state, and both are held with the payments work: the deployment
 * currently carries two subscription tables written by two different paths, and
 * an operator screen that picked one of them would be asserting an answer to
 * the question that phase exists to settle. Recorded in the execution state
 * rather than guessed at here.
 */

/*
 * `(SELECT auth.uid())` RATHER THAN `auth.uid()`, IN EVERY POLICY BELOW.
 *
 * Wrapped in a sub-select, PostgreSQL evaluates the claim ONCE for the query
 * and reuses it; bare, it is re-evaluated for every candidate row. On the
 * usage table — one row per account per window, growing forever — that is the
 * difference between a screen that opens and one that times out as the
 * deployment gets busy. `security-definer.test.ts` checks exactly this against
 * every policy in the schema, and it caught these three.
 */

/*
 * COMMERCIAL USAGE WINDOWS.
 *
 * The rows say only how much of an allowance was spent and when the window
 * turned over. There is no prompt, no output and no title in this table, which
 * is what makes it safe to show an operator at all.
 */
DROP POLICY IF EXISTS "admin_usage_read" ON public.ocade_commercial_usage;
CREATE POLICY "admin_usage_read" ON public.ocade_commercial_usage FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

/*
 * THE AUDIT LOG, ACROSS ORGANIZATIONS.
 *
 * An organization's own administrators already see its trail. §G asks for the
 * platform view: an operator investigating an incident cannot be asked to be a
 * member of the workspace it happened in.
 *
 * The organizations themselves come with it, because a log of events against
 * opaque identifiers is not a log anybody can read.
 */
DROP POLICY IF EXISTS ocade_organization_events_admin_platform_read
  ON public.ocade_organization_events;
CREATE POLICY ocade_organization_events_admin_platform_read
  ON public.ocade_organization_events FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS ocade_organizations_admin_platform_read ON public.ocade_organizations;
CREATE POLICY ocade_organizations_admin_platform_read
  ON public.ocade_organizations FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

/**
 * Notification delivery, as counts.
 *
 * SECURITY DEFINER because the rows it reads are not the caller's, and the
 * admin check is the first thing in the body rather than a policy on the table:
 * adding an admin SELECT policy to `ocade_notifications` would expose every
 * title and body in the deployment, and this question does not need one.
 *
 * `p_since` is bounded by the caller. A window is what an operator actually
 * asks about — "is email delivery working today?" — and an unbounded aggregate
 * over a growing table is a query that works until it does not.
 */
CREATE OR REPLACE FUNCTION public.ocade_admin_notification_delivery(p_since timestamptz)
RETURNS TABLE (
  category text,
  channel text,
  state text,
  occurrences bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an administrator may read notification delivery.';
  END IF;

  RETURN QUERY
  SELECT n.category,
         delivery.key AS channel,
         delivery.value #>> '{}' AS state,
         count(*) AS occurrences
    FROM public.ocade_notifications n
    CROSS JOIN LATERAL jsonb_each(n.delivery) AS delivery(key, value)
   WHERE n.created_at >= p_since
   GROUP BY n.category, delivery.key, delivery.value #>> '{}'
   ORDER BY count(*) DESC, n.category, delivery.key;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_admin_notification_delivery(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_admin_notification_delivery(timestamptz) TO authenticated;
