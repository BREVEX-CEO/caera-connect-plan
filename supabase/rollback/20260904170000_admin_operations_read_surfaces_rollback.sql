-- Rollback for 20260904170000_admin_operations_read_surfaces.
--
-- After this, an operator sees only their own usage and only the organizations
-- they belong to, and the notification delivery aggregate is gone. The
-- /admin/operations screen then reports empty rather than wrong: every read it
-- makes is refused by row-level security, which is the correct failure.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_admin_notification_delivery(timestamptz);
DROP POLICY IF EXISTS "admin_usage_read" ON public.ocade_commercial_usage;
DROP POLICY IF EXISTS ocade_organization_events_admin_platform_read
  ON public.ocade_organization_events;
DROP POLICY IF EXISTS ocade_organizations_admin_platform_read ON public.ocade_organizations;

COMMIT;
