-- Cover every foreign key, because every one of them is a delete path.
--
-- Postgres does not index a foreign key for you. It indexes the PARENT side, so
-- the child side is a sequential scan — and the scan does not happen when the
-- child is read, it happens when the PARENT ROW IS DELETED. Postgres must prove
-- no child references it, and with no index that proof reads the whole child
-- table, holding a row lock the entire time.
--
-- That is not a hypothetical here. Twenty of these twenty-two columns reference
-- `auth.users`, `public.devices` or a lease, and OCADE deletes exactly those:
-- delete-all removes an account, and revoking a device removes its rows. Both
-- are things a person does while waiting for an answer, and both would get
-- slower for every account in the system rather than for their own data.
--
-- `ocade_task_comments.parent_id` is the same shape one level down: deleting a
-- comment cascades to its replies, and without this index finding them scans
-- every comment in the table.
--
-- ALL TWENTY-TWO ARE ADDED. An index is worth its write cost when it turns a
-- table scan under lock into a lookup, and none of these columns is a hot write
-- path — they are authorship and ownership fields, written once.
--
-- NOTHING IS DROPPED HERE. The live advisor also lists eighty-two "unused"
-- indexes, but usage counters on a database with no production traffic measure
-- the absence of traffic, not the absence of need. Dropping an index on that
-- evidence would be removing the thing that keeps the first real query fast.

BEGIN;

CREATE INDEX IF NOT EXISTS ocade_device_usage_leases_device_idx
  ON public.ocade_device_usage_leases (device_id);
CREATE INDEX IF NOT EXISTS ocade_offline_usage_allocations_device_idx
  ON public.ocade_offline_usage_allocations (device_id);
CREATE INDEX IF NOT EXISTS ocade_offline_usage_allocations_lease_idx
  ON public.ocade_offline_usage_allocations (lease_id);
CREATE INDEX IF NOT EXISTS ocade_offline_usage_events_device_idx
  ON public.ocade_offline_usage_events (device_id);
CREATE INDEX IF NOT EXISTS ocade_offline_usage_events_user_idx
  ON public.ocade_offline_usage_events (user_id);

CREATE INDEX IF NOT EXISTS ocade_organization_events_actor_idx
  ON public.ocade_organization_events (actor_id);
CREATE INDEX IF NOT EXISTS ocade_organization_events_subject_idx
  ON public.ocade_organization_events (subject_id);
CREATE INDEX IF NOT EXISTS ocade_organization_group_members_member_idx
  ON public.ocade_organization_group_members (member_id);
CREATE INDEX IF NOT EXISTS ocade_organization_invites_accepted_by_idx
  ON public.ocade_organization_invites (accepted_by);
CREATE INDEX IF NOT EXISTS ocade_organization_invites_invited_by_idx
  ON public.ocade_organization_invites (invited_by);
CREATE INDEX IF NOT EXISTS ocade_organization_invites_revoked_by_idx
  ON public.ocade_organization_invites (revoked_by);
CREATE INDEX IF NOT EXISTS ocade_organization_members_invited_by_idx
  ON public.ocade_organization_members (invited_by);
CREATE INDEX IF NOT EXISTS ocade_organization_policies_updated_by_idx
  ON public.ocade_organization_policies (updated_by);
CREATE INDEX IF NOT EXISTS ocade_organizations_created_by_idx
  ON public.ocade_organizations (created_by);

CREATE INDEX IF NOT EXISTS ocade_project_files_user_idx
  ON public.ocade_project_files (user_id);
CREATE INDEX IF NOT EXISTS ocade_project_folders_user_idx
  ON public.ocade_project_folders (user_id);

CREATE INDEX IF NOT EXISTS ocade_status_incident_updates_created_by_idx
  ON public.ocade_status_incident_updates (created_by);
CREATE INDEX IF NOT EXISTS ocade_status_incidents_created_by_idx
  ON public.ocade_status_incidents (created_by);
CREATE INDEX IF NOT EXISTS ocade_support_article_revisions_created_by_idx
  ON public.ocade_support_article_revisions (created_by);
CREATE INDEX IF NOT EXISTS ocade_support_articles_updated_by_idx
  ON public.ocade_support_articles (updated_by);

CREATE INDEX IF NOT EXISTS ocade_task_comments_parent_idx
  ON public.ocade_task_comments (parent_id);
CREATE INDEX IF NOT EXISTS ocade_task_comments_user_idx
  ON public.ocade_task_comments (user_id);

COMMIT;
