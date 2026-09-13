-- Phase 10: remove the database of the products OCADE no longer is.
--
-- `PLAN.md` Phase 10: "After final core reachability is known, remove database
-- objects used only by retired products." Reachability is now known — every one
-- of the 151 modules in the tree is reached from a route, an entry or a worker —
-- so the question "does anything still call this" has an answer rather than a
-- guess.
--
-- HOW THE LIST WAS MADE, so it can be checked rather than trusted. Every table
-- in the schema was matched against every string literal in `src/` and in the
-- Edge Function; the ones below appear in neither, and each belongs to a
-- product this rebuild removed:
--
--   FICIA (8 tables)           an HR/approvals product
--   CANIA (3), MADEE (2)       a news product and a resume builder
--   compliance packs (8)       a regulatory-obligations product
--   messenger (10)             a chat-between-companies product
--   organizations (7)          team accounts
--   projects/tasks (6)         the Projects and Tasks products
--   automations (3)            scheduled agent runs
--   support desk (6)           a ticket queue
--   status page (2)            public incidents
--   plus approvals, monitors, conversation shares, browser site policy,
--   provider preferences, launch gates, feature flags, tenants, the vault
--   config, the retired subscriptions archive and OCADE memory.
--
-- WHAT STAYS, and it is the whole of the final product: identities and profiles,
-- security and sessions, conversations and messages, Library, settings,
-- notifications, usage/entitlements/offline reconciliation, billing, the hidden
-- admin authority, and the tombstone sweep.
--
-- THE ROLLBACK RECREATES NOTHING. It cannot: these tables carried data that this
-- migration deletes, and a rollback that produced empty tables with the same
-- names would be a worse lie than an honest refusal. `PLAN.md` calls for
-- reversible migrations; what is genuinely reversible here is the SCHEMA, and
-- the rollback file says exactly that and points at the migrations that define
-- each table.
--
-- CASCADE is deliberate: it takes the policies, indexes, triggers and foreign
-- keys with the table, which is the whole of what depends on it. The functions
-- below are dropped explicitly because a function is not a dependent of the
-- table it reads.

BEGIN;

-- ---------------------------------------------------------------------------
-- Functions belonging to the retired products
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS private.ficia_has_permission(_tenant uuid, _uid uuid, _perm text) CASCADE;
DROP FUNCTION IF EXISTS private.is_tenant_owner_or_manager(_tenant uuid, _uid uuid) CASCADE;
DROP FUNCTION IF EXISTS private.msg_is_thread_admin(_thread_id uuid, _user_id uuid) CASCADE;
DROP FUNCTION IF EXISTS private.msg_is_thread_member(_thread_id uuid, _user_id uuid) CASCADE;
DROP FUNCTION IF EXISTS private.msg_thread_writable(_thread_id uuid, _user_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_company_with_owner(_uid uuid, _payload jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.enforce_controlled_rollout_stage() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_ga_launch_gate() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_pack_ga_gate() CASCADE;
DROP FUNCTION IF EXISTS public.ficia_sync_membership() CASCADE;
DROP FUNCTION IF EXISTS public.find_conflicting_legal_id(_country text, _registration text, _gstin text, _pan text) CASCADE;
DROP FUNCTION IF EXISTS public.find_similar_company_names(_country text, _name text) CASCADE;
DROP FUNCTION IF EXISTS public.has_tenant_role(_tenant_id uuid, _user_id uuid, _role tenant_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_tenant_member(_tenant_id uuid, _user_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.msg_add_creator_as_admin() CASCADE;
DROP FUNCTION IF EXISTS public.msg_apply_scope() CASCADE;
DROP FUNCTION IF EXISTS public.msg_bump_last_message() CASCADE;
DROP FUNCTION IF EXISTS public.msg_record_edit() CASCADE;
DROP FUNCTION IF EXISTS public.ocade_accept_organization_invite(p_token_hash text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_admin_seat_overview() CASCADE;
DROP FUNCTION IF EXISTS public.ocade_append_automation_receipt(p_run_id uuid, p_claim_token uuid, p_step_index integer, p_phase text, p_operation_id text, p_action_kind text, p_status text, p_execution_ok boolean, p_verified boolean, p_detail text, p_started_at timestamp with time zone, p_finished_at timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_cancel_all_automation_runs() CASCADE;
DROP FUNCTION IF EXISTS public.ocade_claim_automation_run(p_run_id uuid, p_worker_id text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_close_support_case(grant_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_complete_automation_run(p_run_id uuid, p_claim_token uuid, p_status text, p_error text, p_finished_at timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_create_organization(p_name text, p_slug text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_create_organization_group(p_organization_id uuid, p_name text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_create_support_ticket(p_subject text, p_category text, p_body text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_decide_approval(_id uuid, _status text, _device_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_decide_automation_run(p_run_id uuid, p_decision text, p_device_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_delete_organization(p_organization_id uuid, p_typed_name text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_delete_organization_group(p_group_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_enqueue_automation_run(p_automation_id uuid, p_status text, p_dry_run boolean, p_plan jsonb, p_execution_steps jsonb, p_highest_risk text, p_blocked_reason text, p_deadline_at timestamp with time zone, p_next_run_at timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_expire_automation_approval(p_run_id uuid, p_claim_token uuid, p_reason text, p_requested_at timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_expire_due_approvals() CASCADE;
DROP FUNCTION IF EXISTS public.ocade_heartbeat_automation_run(p_run_id uuid, p_claim_token uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_invite_to_organization(p_organization_id uuid, p_email text, p_role text, p_token_hash text, p_expires_at timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_open_status_incident(p_kind text, p_title text, p_impact text, p_component_ids text[], p_body text, p_started_at timestamp with time zone, p_scheduled_end timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_open_support_case(target_ticket uuid, case_reason text, minutes integer) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_org_active_owners(p_organization_id uuid, p_excluding uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_org_role(p_organization_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_organization_keeps_an_owner() CASCADE;
DROP FUNCTION IF EXISTS public.ocade_organizations_blocking_deletion(p_user_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_post_status_incident_update(p_incident_id uuid, p_state text, p_body text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_read_shared_conversation(p_token text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_read_support_case(target_ticket uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_record_organization_event(p_organization_id uuid, p_event text, p_subject_id uuid, p_detail jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_recover_stale_automation_runs(p_stale_before timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_remove_organization_member(p_member_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_rename_organization(p_organization_id uuid, p_name text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_request_automation_cancel(p_run_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_request_automation_pause(p_run_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_requeue_automation_run(p_run_id uuid, p_claim_token uuid, p_attempt integer, p_next_attempt_at timestamp with time zone, p_error text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_resend_organization_invite(p_invite_id uuid, p_token_hash text, p_expires_at timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_resume_automation_run(p_run_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_revoke_conversation_share(p_conversation_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_revoke_organization_invite(p_invite_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_save_support_article(p_slug text, p_title text, p_summary text, p_category text, p_body text[], p_keywords text[], p_status text, p_note text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_set_organization_group_membership(p_group_id uuid, p_member_id uuid, p_present boolean) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_set_organization_member_role(p_member_id uuid, p_role text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_set_organization_member_state(p_member_id uuid, p_state text) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_set_organization_policy(p_organization_id uuid, p_withheld_capabilities text[], p_withheld_tool_domains text[]) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_share_conversation(p_conversation_id uuid, p_expires_at timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_support_grant_active(target_ticket uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_support_touch_ticket() CASCADE;
DROP FUNCTION IF EXISTS public.ocade_suspend_automation_run(p_run_id uuid, p_claim_token uuid, p_reason text, p_paused_at timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_transfer_organization_ownership(p_organization_id uuid, p_to_user_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_resume_version_number() CASCADE;
DROP FUNCTION IF EXISTS public.tombstone_deleted_attachment() CASCADE;

-- ---------------------------------------------------------------------------
-- And their tables
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public.access_requests CASCADE;
DROP TABLE IF EXISTS public.cania_alert_prefs CASCADE;
DROP TABLE IF EXISTS public.cania_saved_topics CASCADE;
DROP TABLE IF EXISTS public.cania_settings CASCADE;
DROP TABLE IF EXISTS public.company_obligations CASCADE;
DROP TABLE IF EXISTS public.compliance_events CASCADE;
DROP TABLE IF EXISTS public.country_pack_versions CASCADE;
DROP TABLE IF EXISTS public.country_packs CASCADE;
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.ficia_approval_decisions CASCADE;
DROP TABLE IF EXISTS public.ficia_approval_policies CASCADE;
DROP TABLE IF EXISTS public.ficia_approval_requests CASCADE;
DROP TABLE IF EXISTS public.ficia_custom_roles CASCADE;
DROP TABLE IF EXISTS public.ficia_departments CASCADE;
DROP TABLE IF EXISTS public.ficia_employments CASCADE;
DROP TABLE IF EXISTS public.ficia_locations CASCADE;
DROP TABLE IF EXISTS public.ficia_role_grants CASCADE;
DROP TABLE IF EXISTS public.ficia_teams CASCADE;
DROP TABLE IF EXISTS public.historical_test_cases CASCADE;
DROP TABLE IF EXISTS public.launch_gate_history CASCADE;
DROP TABLE IF EXISTS public.launch_gate_items CASCADE;
DROP TABLE IF EXISTS public.madee_resume_projects CASCADE;
DROP TABLE IF EXISTS public.madee_resume_versions CASCADE;
DROP TABLE IF EXISTS public.msg_attachments CASCADE;
DROP TABLE IF EXISTS public.msg_cross_company_grants CASCADE;
DROP TABLE IF EXISTS public.msg_message_edits CASCADE;
DROP TABLE IF EXISTS public.msg_message_links CASCADE;
DROP TABLE IF EXISTS public.msg_messages CASCADE;
DROP TABLE IF EXISTS public.msg_pins CASCADE;
DROP TABLE IF EXISTS public.msg_reactions CASCADE;
DROP TABLE IF EXISTS public.msg_read_receipts CASCADE;
DROP TABLE IF EXISTS public.msg_thread_members CASCADE;
DROP TABLE IF EXISTS public.msg_threads CASCADE;
DROP TABLE IF EXISTS public.ocade_approvals CASCADE;
DROP TABLE IF EXISTS public.ocade_automation_runs CASCADE;
DROP TABLE IF EXISTS public.ocade_automation_step_receipts CASCADE;
DROP TABLE IF EXISTS public.ocade_automations CASCADE;
DROP TABLE IF EXISTS public.ocade_browser_site_policy CASCADE;
DROP TABLE IF EXISTS public.ocade_conversation_shares CASCADE;
DROP TABLE IF EXISTS public.ocade_memory CASCADE;
DROP TABLE IF EXISTS public.ocade_monitors CASCADE;
DROP TABLE IF EXISTS public.ocade_organization_events CASCADE;
DROP TABLE IF EXISTS public.ocade_organization_group_members CASCADE;
DROP TABLE IF EXISTS public.ocade_organization_groups CASCADE;
DROP TABLE IF EXISTS public.ocade_organization_invites CASCADE;
DROP TABLE IF EXISTS public.ocade_organization_members CASCADE;
DROP TABLE IF EXISTS public.ocade_organization_policies CASCADE;
DROP TABLE IF EXISTS public.ocade_organizations CASCADE;
DROP TABLE IF EXISTS public.ocade_project_files CASCADE;
DROP TABLE IF EXISTS public.ocade_project_folders CASCADE;
DROP TABLE IF EXISTS public.ocade_project_items CASCADE;
DROP TABLE IF EXISTS public.ocade_projects CASCADE;
DROP TABLE IF EXISTS public.ocade_provider_events CASCADE;
DROP TABLE IF EXISTS public.ocade_provider_prefs CASCADE;
DROP TABLE IF EXISTS public.ocade_retired_subscriptions CASCADE;
DROP TABLE IF EXISTS public.ocade_status_incident_updates CASCADE;
DROP TABLE IF EXISTS public.ocade_status_incidents CASCADE;
DROP TABLE IF EXISTS public.ocade_support_access_events CASCADE;
DROP TABLE IF EXISTS public.ocade_support_article_revisions CASCADE;
DROP TABLE IF EXISTS public.ocade_support_articles CASCADE;
DROP TABLE IF EXISTS public.ocade_support_grants CASCADE;
DROP TABLE IF EXISTS public.ocade_support_messages CASCADE;
DROP TABLE IF EXISTS public.ocade_support_tickets CASCADE;
DROP TABLE IF EXISTS public.ocade_task_comments CASCADE;
DROP TABLE IF EXISTS public.ocade_tasks CASCADE;
DROP TABLE IF EXISTS public.pack_reviews CASCADE;
DROP TABLE IF EXISTS public.rule_sources CASCADE;
DROP TABLE IF EXISTS public.tenant_members CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.vault_config CASCADE;
/*
 * The messenger bucket belonged to the messenger tables above.
 *
 * THIS CANNOT DELETE IT, AND SAYING SO IS THE POINT. Supabase refuses direct
 * deletion from `storage.objects` and `storage.buckets` — `storage
 * .protect_delete()` raises 42501, "Use the Storage API instead" — so the two
 * DELETE statements that stood here could never have run. Removing a bucket is
 * a Storage API call or one action in the dashboard, not SQL.
 *
 * What SQL can do is take away every way to reach it, and that is done here:
 * with no policy, no role can read, write or list the bucket. It held no
 * objects when this was applied, so nothing is stranded — an empty bucket with
 * no policies is inert, and deleting the shell itself is tidying rather than
 * cleanup.
 */
DROP POLICY IF EXISTS messenger_read ON storage.objects;
DROP POLICY IF EXISTS messenger_insert ON storage.objects;
DROP POLICY IF EXISTS messenger_delete_own ON storage.objects;

UPDATE storage.buckets SET public = false WHERE id = 'messenger';

-- One straggler the table sweep cannot reach: a wrapper whose body names a
-- dropped table but which nothing dropped, because it depends on the FUNCTION
-- that is gone rather than on the table.
DROP FUNCTION IF EXISTS public.ocade_my_organizations_blocking_deletion() CASCADE;

-- ---------------------------------------------------------------------------
-- What the cascade took that the product still needs
-- ---------------------------------------------------------------------------

/*
 * THE CONVERSATIONS POLICY WENT WITH `ocade_projects`, AND THAT IS A LOCKOUT.
 *
 * `own_conversations` was rewritten in August to also check that a
 * conversation's `project_id` belonged to the caller — so the policy DEPENDED
 * on the projects table, and dropping that table dropped the policy with it.
 * Row-level security stays enabled, so the result is a table with RLS on and no
 * policy: nobody can read their own conversations at all.
 *
 * Caught by `conversation-trash-schema.test.ts`, which reads as an ordinary
 * signed-in account and got an empty list back.
 *
 * The replacement is the rule without the product: a conversation is the
 * account's, and that is the whole of it.
 */
ALTER TABLE public.ocade_conversations DROP COLUMN IF EXISTS project_id;

DROP POLICY IF EXISTS own_conversations ON public.ocade_conversations;
CREATE POLICY own_conversations ON public.ocade_conversations FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Two columns pointing at a table that is gone. The foreign keys went with the
-- cascade; these are what was left, and nothing in the product has ever read
-- them.
ALTER TABLE public.activity_log DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.compliance_audit_log DROP COLUMN IF EXISTS tenant_id;

COMMIT;
