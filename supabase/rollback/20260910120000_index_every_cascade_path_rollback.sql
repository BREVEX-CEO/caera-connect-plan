-- Reverses 20260910120000_index_every_cascade_path.sql.
--
-- Dropping these restores the sequential scan on every cascade delete, so this
-- is a correctness-preserving but slow state. It exists to make the migration
-- reversible, not because reversing it is desirable.

BEGIN;

DROP INDEX IF EXISTS public.ocade_device_usage_leases_device_idx;
DROP INDEX IF EXISTS public.ocade_offline_usage_allocations_device_idx;
DROP INDEX IF EXISTS public.ocade_offline_usage_allocations_lease_idx;
DROP INDEX IF EXISTS public.ocade_offline_usage_events_device_idx;
DROP INDEX IF EXISTS public.ocade_offline_usage_events_user_idx;
DROP INDEX IF EXISTS public.ocade_organization_events_actor_idx;
DROP INDEX IF EXISTS public.ocade_organization_events_subject_idx;
DROP INDEX IF EXISTS public.ocade_organization_group_members_member_idx;
DROP INDEX IF EXISTS public.ocade_organization_invites_accepted_by_idx;
DROP INDEX IF EXISTS public.ocade_organization_invites_invited_by_idx;
DROP INDEX IF EXISTS public.ocade_organization_invites_revoked_by_idx;
DROP INDEX IF EXISTS public.ocade_organization_members_invited_by_idx;
DROP INDEX IF EXISTS public.ocade_organization_policies_updated_by_idx;
DROP INDEX IF EXISTS public.ocade_organizations_created_by_idx;
DROP INDEX IF EXISTS public.ocade_project_files_user_idx;
DROP INDEX IF EXISTS public.ocade_project_folders_user_idx;
DROP INDEX IF EXISTS public.ocade_status_incident_updates_created_by_idx;
DROP INDEX IF EXISTS public.ocade_status_incidents_created_by_idx;
DROP INDEX IF EXISTS public.ocade_support_article_revisions_created_by_idx;
DROP INDEX IF EXISTS public.ocade_support_articles_updated_by_idx;
DROP INDEX IF EXISTS public.ocade_task_comments_parent_idx;
DROP INDEX IF EXISTS public.ocade_task_comments_user_idx;

COMMIT;
