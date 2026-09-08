# Backend Schema

## Purpose and Authority

This document defines OCADE's backend data contract: which domains must persist, how records relate, where bodies/files live, how authorization and pagination work, and how current physical Supabase tables map to the target product model. It complements `docs/ARCHITECTURE.md` rather than duplicating the whole architecture. `PLAN.md` owns migration order, `TRD.md` owns technical requirements, and source migrations plus generated Supabase types remain the physical schema authority.

Do not treat every logical entity named here as permission to create a new table. OCADE already has a substantial Supabase schema. Existing source/live tables must be reused, repaired or transformed through forward-only migrations when they can own the required domain. Duplicate replacement tables are forbidden merely for preferred naming.

## Current Physical Baseline

The generated `src/integrations/supabase/types.ts` on current `main` confirms a large public schema with both general/legacy tables and OCADE-specific tables. Verified current OCADE families include, among others:

- `ocade_conversations`
- `ocade_messages`
- `ocade_projects`
- `ocade_project_items`
- `ocade_outputs`
- `ocade_memory`
- `ocade_automations`
- `ocade_automation_runs`
- `ocade_automation_step_receipts`
- `ocade_commercial_usage`
- `ocade_generation_permits`
- `ocade_offline_usage_allocations`
- `ocade_offline_usage_events`
- `ocade_device_usage_keys`
- `ocade_device_usage_leases`
- `ocade_notifications`
- `ocade_notification_preferences`
- `ocade_organizations`
- `ocade_organization_invites`
- `ocade_organization_groups`
- `ocade_organization_group_members`
- `ocade_organization_policies`
- `ocade_organization_events`
- `ocade_subscriptions`
- `ocade_payment_events`
- `ocade_provider_events`
- `ocade_provider_prefs`
- `ocade_conversation_shares`
- `ocade_support_tickets`
- `ocade_support_messages`
- `ocade_support_articles`
- `ocade_support_article_revisions`
- `ocade_status_incidents`
- `ocade_status_incident_updates`
- `ocade_mfa_recovery_codes`
- `ocade_mfa_recovery_attempts`
- `devices`
- `browser_grants`
- `profiles`
- `activity_log`

The generated types also expose OCADE RPCs for permit acquisition/finalization/release, offline usage allocation/reconciliation, automation claim/heartbeat/receipt/cancel/pause/resume/recovery, organization administration, notification recording, conversation sharing, status/support operations and MFA/session management. These existing authorities must be inspected before any new table or RPC is added.

## Persistence Boundaries

### PostgreSQL

Supabase PostgreSQL is the canonical persistent authority for structured ordinary user/account data, including identities/profile metadata, conversations/messages, projects/relationships, tasks/automations/runs/events/approvals/receipts, artifact metadata/versions/provenance, memory, organization state, settings/preferences, notifications, usage/permits/offline leases, support/status records and billing/entitlement state.

### Supabase Storage

Private Supabase Storage is the canonical body/object authority for uploaded customer files and durable artifact bodies that should not live as large inline database payloads. Database rows store ownership, scope, object path/key, content type, byte size, integrity hash, lifecycle/provenance and relationships as needed.

Storage paths must be derived or validated server-side from authenticated account/organization context. Client-provided object paths, owners or quota totals are never authorization.

### Browser storage

Ordinary persistent content must not be stored in IndexedDB, localStorage, Cache Storage, browser/PC vaults or OPFS as a competing authority. OPFS is reserved for Offline Intelligence model binaries, verified chunks and model-owned metadata. Temporary unsynchronized local-inference turns may exist only in open-tab RAM. Incognito is RAM-only.

## Core Identity Model

Supabase Auth user ID is the immutable account identity. `profiles` or its reconciled successor stores display/profile metadata but does not replace Auth identity.

Every user-scoped record must derive ownership from trusted authenticated context. Every organization-scoped record must derive organization membership/role from server/RLS policy rather than accepting an arbitrary client-provided `user_id`, `organization_id`, owner or role as proof.

Email is a lookup/address attribute, not a durable mutation identity. Platform Admin support flows may search by email but must resolve to immutable Auth user ID before any entitlement, account or support-access mutation.

## Conversation Domain

### Current physical authorities

`ocade_conversations` is the conversation header authority and already relates to `ocade_projects`. `ocade_messages` references `ocade_conversations`. `ocade_conversation_shares` references conversations and provides share lifecycle data.

### Required logical fields

A conversation requires stable ID, owner, optional organization/project scope, title, created/updated timestamps, archived/trash/deletion state, model/intelligence metadata where appropriate, lineage/branch metadata and retention/share state. Do not add a duplicate conversation table merely because one field is missing; extend/reconcile the canonical table through migration.

Messages require stable ID, conversation ID, role/type, content or body reference, timestamps, attachment metadata, branch/parent lineage where required, normalized tool/citation/provenance data and generation identifiers needed for idempotency/receipts.

### Relationships

```text
Auth user
  └─ ocade_conversations
       ├─ ocade_messages
       ├─ ocade_conversation_shares
       ├─ optional project relationship
       └─ generated outputs/artifacts/task relationships
```

Conversation deletion must not delete Offline Intelligence OPFS model data. Share revocation/expiry must not change underlying conversation ownership.

## Projects and Relationships

`ocade_projects` is the project authority. `ocade_project_items` is the preferred existing relationship mechanism when it can represent typed relationships without duplicating records.

A Project should link conversations, files, tasks, artifacts, Code sessions/repositories, memory and activity rather than copy their bodies into project-specific duplicate tables. Relationship rows require project ID, target type/kind, target ID, timestamps/order metadata where needed and server-enforced authorization.

Project archive/delete behavior must distinguish deleting the project container/relationships from deleting independently owned underlying records.

## Tasks, Automations and Receipts

The target task model must converge existing task/automation families into one canonical runtime/state authority rather than create separate Chat/Cowork/Code task tables.

Verified physical authorities include `ocade_automations`, `ocade_automation_runs` and `ocade_automation_step_receipts`, with RPCs for enqueue, claim, heartbeat, approval decisions, receipt append, pause, resume, cancellation, stale-run recovery and retry/requeue behavior.

A canonical run needs:

- stable run/task ID and owner/scope;
- task definition/source and optional schedule;
- state/status with validated transitions;
- idempotency/dedupe key;
- attempt/claim/lease/heartbeat data;
- executor/capability requirements;
- approval request/decision/expiry data;
- pause/cancel/stop/takeover state;
- current step and error/recovery metadata;
- immutable/append-oriented step receipts;
- created/started/completed/updated timestamps.

A side-effect receipt records what was attempted, executor/tool, step index/attempt, precondition context, result, verified postcondition, timestamps and safe diagnostics. Issuing an action is never sufficient for a verified-success receipt.

## Artifacts and Outputs

`ocade_outputs` is an existing durable output authority and already relates to conversations/projects/parent outputs. During implementation, determine whether it can directly own the final Artifact concept or must be extended with version/provenance metadata. Do not create `artifacts_v2` or a second output store unless a proven incompatible boundary requires it.

The logical Artifact model needs stable artifact/output ID, owner/scope, title/type, optional project/conversation/task/run relationships, body location or inline content where appropriately small, content hash/integrity, parent/version lineage, provenance, created/updated timestamps, share/export state and deletion/restore state.

Large durable bodies belong in private Storage with database metadata and integrity hashes.

## Memory

`ocade_memory` is the existing memory authority. It must support account/project scope, content/value, source/provenance, timestamps and optional expiry/retention metadata. Memory access is authorization-filtered and disabled for Incognito. Do not persist Incognito-derived memory.

If semantic/vector search is introduced, it must preserve the same row ownership/RLS boundaries. Search indexes cannot become an alternate source of truth.

## Devices and Browser Grants

`devices` stores registered device identity/state. `browser_grants` relates approved browser installation/device context and revocation/last-seen information. Device/browser rows must not become account-content stores.

Device revocation should invalidate relevant browser/native execution grants and usage leases without deleting account data or Offline Intelligence model bytes unless the user separately removes the model on that device.

## Commercial Usage and Generation Permits

Existing physical authorities include:

- `ocade_commercial_usage`
- `ocade_generation_permits`
- `ocade_offline_usage_allocations`
- `ocade_offline_usage_events`
- `ocade_device_usage_keys`
- `ocade_device_usage_leases`

Existing RPCs already cover permit acquisition/finalization/release and offline allocation/lease/reconciliation families. These are the canonical starting point and must be completed rather than replaced by a second counter.

### Invariants

Free accounts have exactly 28 successful logical AI uses per 388-minute account window. Usage is account-wide across devices and Chat/Cowork/Code/online/local execution.

A logical generation has one durable idempotency identity. Reservation/acquisition occurs before provider/model work. Meaningful output finalizes once. Pre-output failure/cancellation releases according to policy. Retries, tools, subagents, provider-key failover and local fallback remain inside the same logical permit.

Offline usage leases are device-bound, signed, bounded and reconciled without permitting cross-device double-spend or clock rollback to create new capacity.

## Notifications

`ocade_notifications` and `ocade_notification_preferences` are the canonical current families. Notifications require user/organization scope, category, title/body, optional deep link, created/read state and delivery/operational metadata only when needed.

Preferences require category/channel configuration, quiet hours/mute state and revision/update metadata. Delivery transport state must not be conflated with the notification record itself if separate retry/provider history is required.

## Organizations

Verified current tables include `ocade_organizations`, invites, groups, group members, policies and organization events. Source migrations/types must be inspected for membership/role tables before adding anything missing.

Required logical relationships:

```text
organization
  ├─ memberships / roles
  ├─ invites
  ├─ groups
  │   └─ group membership
  ├─ policies
  ├─ seats / entitlement allocation where implemented
  └─ append-oriented organization audit/events
```

Organization data is tenant-isolated. Member/Admin/Owner policies are enforced server-side/RLS. Destructive ownership transfer/delete/remove-member operations require the canonical recent-AAL2 and role checks.

## Support, Status and Admin Audit

Current tables include `ocade_support_tickets`, `ocade_support_messages`, `ocade_support_articles`, article revisions, `ocade_status_incidents`, incident updates, `activity_log` and organization events.

Support access to customer content, if enabled, must have its own explicit authorization/audit contract: actor ID, target user/org, case/reason, scope, start/expiry/revocation and immutable access events. Do not implement support access as generic service-role database browsing.

Status incidents and updates are operational/public-service records and must not expose secrets or customer content.

## MFA and Session Security

Current schema includes `ocade_mfa_recovery_codes` and `ocade_mfa_recovery_attempts`, plus session-related RPCs. Recovery codes are stored as hashes, never plaintext. Attempt/lockout state is server-authoritative.

Session list/revocation behavior derives from authenticated identity and must not permit one user to enumerate or revoke another user's sessions.

## Billing, Subscription and Entitlement Domain

Current physical families include `ocade_subscriptions`, `ocade_payment_events` and provider/commercial event state. The final billing implementation occurs last and must reconcile all historical payment/subscription authorities before adding new schema.

### Immutable normalized billing events

Every provider event is verified server-side and normalized with provider/event identity, user/account target, catalogue version, plan/cadence, currency, amount minor units, event type, provider status, provider timestamps, received timestamp, raw-payload integrity/reference where legally/operationally appropriate and idempotency/replay state.

Duplicate/replayed/out-of-order events must be safe. Browser success URLs never create subscription/entitlement state.

### Subscription/effective entitlement

Subscription state is derived/applied through one idempotent authority from verified commercial events. Required concepts include plan, cadence, status, effective period, renewal/cancellation/expiry state and provider references.

### Refunds, disputes and chargebacks

The financial ledger must preserve full/partial refunds, disputes, chargebacks and reversals as immutable normalized events rather than rewriting history. Effective entitlement changes follow explicit policy and server reconciliation.

### Admin grants

Manual Free/Pro/Max/custom grants are not payment events. A grant requires immutable target Auth user ID, actor Admin ID, grant type/capacity, reason, start/end, created/revoked timestamps and audit trail. Recent AAL2/role policy applies. Grant/revoke updates effective access atomically without fabricating provider transactions.

If no suitable existing grant table exists, implementation may add one through the payments/Admin-grants phase after confirming no current authority already serves the purpose.

## Search and Pagination

Search and growing collection queries are authorization-filtered before snippets/results are returned. Cursor/keyset pagination is required for growing datasets such as conversations/history, Search, Tasks/runs, Artifacts/outputs, activity/audit/event streams and notifications where scale warrants it.

Ordinary default page size is approximately 20 unless product/query evidence supports another bounded value. Small stable Admin tables may use bounded offset pagination when page-number navigation materially helps.

Cursor keys must use stable sort order, typically timestamp plus unique ID, so inserts do not create duplicates/skips across pages.

## Indexing Rules

Indexes are evidence-driven. Add indexes for real high-frequency WHERE/JOIN/ORDER BY/search patterns only after inspecting query plans. Typical candidates include owner/scope plus updated/created time, foreign-key relationship lookups, unread/status queues, pending automation claim/recovery fields, provider-event unique IDs and stable pagination keys.

Do not index every column. Every new index increases write/storage/maintenance cost. Verify before/after plans with `EXPLAIN (ANALYZE, BUFFERS)` or equivalent evidence where practical.

N+1 query loops are not acceptable. Related records are fetched with joins, `.in()` batches, server-side aggregation or another bounded set operation rather than one request per list item.

## Row Level Security

Every exposed user/organization-scoped table requires explicit RLS policy appropriate to its role. Policy tests must cover anonymous, owner, other authenticated user, organization member/Admin/Owner, platform Admin/support and private/service worker contexts where applicable.

Do not trust client-visible ownership fields for authorization. `SECURITY DEFINER` functions are allowed only when necessary, with fixed safe `search_path`, narrow privileges and explicit internal authorization checks. RLS policy truth must be tested against the actual migrated schema.

## Realtime

Supabase Realtime is selective. Use it for product states that materially benefit from cross-device/task/notification updates. Do not subscribe to whole broad tables when a scoped channel/filter or ordinary refetch is sufficient. Realtime messages never bypass RLS/authorization and are not a second persistence authority.

## Retention, Archive and Deletion

Archive/trash/retention behavior must be explicit per domain. Soft-delete/trash fields are acceptable when the product supports restore/undo; eventual permanent deletion must remove the authoritative user content and associated private Storage objects unless legal/security retention requires an exception.

Account deletion must handle ordinary account content, organization ownership constraints, sessions/grants and Storage objects according to the final policy. It must not remove browser OPFS Offline Intelligence model bytes because model lifecycle is device-local infrastructure and has its own explicit Remove control.

Billing/audit/security records may require immutable/limited retention according to legal and operational policy; do not silently delete financial or security evidence if retention is required.

## Migration and Source-Live Reconciliation

The repository already has many source migrations and current live Supabase history has previously differed. Before any production schema mutation:

1. Fetch current source migrations and live migration/schema state.
2. Compare semantic schema effects, not filenames alone.
3. Identify already-applied live-only/source-equivalent changes.
4. Never replay an old migration blindly.
5. Add forward-only corrective migrations.
6. Run local reset/migration tests where supported.
7. Regenerate `src/integrations/supabase/types.ts`.
8. Run RLS/grant/Storage/adversarial tests.
9. Recompare source/live target state before production application.

## Backend Schema Definition of Done

The backend data layer is complete only when every persistent product domain has one canonical authority, generated types match the reconciled schema, RLS/Storage policies enforce isolation, growing queries are bounded/indexed from evidence, no N+1 path remains in critical lists, offline usage/commercial events are idempotent and concurrency-safe, customer files use private Storage correctly, no ordinary user content persists in browser databases/OPFS, and source/live migrations can be reproduced and verified without replaying unsafe history.