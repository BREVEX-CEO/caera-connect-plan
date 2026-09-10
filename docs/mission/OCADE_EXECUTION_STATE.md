# OCADE Execution State

Resume pointer for Auto Continue, context compaction and usage resets. `PLAN.md` remains the
implementation authority and `docs/MEMORY.md` remains the durable session handoff; this file records
only the exact current position inside `PLAN.md` so a resumed session does not restart a finished phase.

## Branch and baseline

- Working branch: `claude/plan-implementation-n3yjkn`
- Branch point: `origin/main` at `a7a99e3` (`docs: repair OCADE authority consistency`)
- Environment note: `npm ci` on this runner does not install `@rolldown/binding-linux-x64-gnu`
  (npm optional-dependency defect npm/cli#4828). Install it with
  `npm install --no-save @rolldown/binding-linux-x64-gnu@1.2.7` before `npm run build`.
  This is a runner defect, not a repository defect: the lockfile already pins the package.

## Phase 0 — Fresh baseline and evidence repair (COMPLETE)

Repairs made:

- `README.md` regained the truthful-boundary statements the documentation rewrite dropped
  (storage modes, desktop signing/notarization, mobile store gates). Two readiness suites assert them.
- `docs/ARCHITECTURE.md`, `docs/Backend Schema.md`, `docs/DESIGN.md`, `docs/GOVERNANCE.md`,
  `docs/README.md`, `docs/TESTING.md`, `docs/TRD.md`, `docs/UI UX Brief.md` reformatted to Prettier.
- `release/checklists/OCADE_MISSION_EVIDENCE.{json,md}` regenerated against the current `PLAN.md`.

Gate result: `format:check`, `typecheck`, `lint`, `test` (515 files, 8258 passed), `test:isolation`
(shuffled), `build`, `routes:stable`, `build:stable`, `performance:budget`, `controls:check`,
`browser-safety:check`, `supabase:types-check`, `integration:check` and `mission:check` all pass.
The only ledger `MISSING` is `ADMIN-002` (billing/seat overview), which `PLAN.md` Phase 19 owns.

## Phase 1 — Architecture cleanup and one authority per subsystem (IN PROGRESS)

### Done

**Root entry routing.** `src/lib/entry/root-entry.ts` owns the three `/` rules from
`docs/APP_FLOW.md`; `src/lib/entry/entry.functions.ts` reads the landing-seen cookie during server
rendering. Proved in a real browser by `npm run audit:entry-routing`
(`scripts/e2e/entry-routing.mjs`): first visit lands, a returning signed-out visit reaches `/auth`,
a returning signed-in visit reaches `/ocade`. Measured while building it: TanStack Start does not
re-run `beforeLoad` on the client while hydrating a server-rendered document, so the session check
also runs in the landing component.

**Onboarding wizard removed.** `/onboarding` is now a redirect to `/ocade`; the profile gate is out
of `_authenticated/route.tsx` and the hop is out of `auth.callback.tsx`. `DEFAULT_NEXT` is `/ocade`,
`auth.verify.tsx` uses the shared `safeNext` instead of a second hand-rolled check, and the
`onboarding_completed` column is no longer read anywhere (the column itself is a Phase 3 schema
question). `WelcomeTour` and `OnboardingShell` are gone with it; the harness helper
`scripts/e2e/onboarding.mjs` was deleted and `sign-in-and-onboard.mjs` became `sign-in-state.mjs`.
Route QA control presses rose from 74/68 to 275/608 once the tour stopped covering the workspace.

**Chat route split.** `src/routes/_authenticated/ocade.index.tsx` went from 6,118 to ~4,500 lines.
Extracted, behaviour unchanged: `conversation-model.ts` (types, limits, mode list, pure helpers),
`IncognitoBanner.tsx`, `ShortcutsDialog.tsx`, `ChatContextualSidebar.tsx`, `ChatHomeSurface.tsx`,
`ConversationDialogs.tsx` and `ChatComposer.tsx`, all under `src/components/ocade/chat/`.

**One composer.** There were two: the shipped one inside the route, and a standalone `ChatComposer`
nothing rendered. The shipped one took the name; `ChatShell.tsx`, `ChatEmptyState.tsx`,
`ComposerMenu.tsx` and `DictateButton.tsx` were removed with the tests that asserted rules about
code no user could reach. What those genuinely owned was merged first: the drag helpers in
`composer-drop.ts` are now what the shipped composer uses, and the open-microphone ring survives a
reduced-motion preference. The composer's textarea gained a real accessible name.

### Remaining in this phase

1. `ChatSurface` is still ~3,500 lines inside the route. Splitting it means separating the send
   pipeline from the presentation, which is a deeper change than moving components. Carried into
   Phase 2's follow-through rather than blocking persistence work.

### Deliberately not done

`ComposerMenu`'s single `+` trigger is a Phase 17 interface question, not a reason to keep an
unreachable component alive. The historical route stubs (`cania`, `ficia`, `madee`, `home`,
`ocade.system`, `ocade.work`, and now `onboarding`) are the redirects `docs/APP_FLOW.md` requires.

## Phase 2 — Supabase canonical persistence (COMPLETE)

Ordinary user content now has ONE persistent authority. Nothing the product treats as content is
written to `localStorage`, `sessionStorage`, IndexedDB, Cache Storage or OPFS, and
`npm run content-storage:check` fails the build if that changes.

### What moved, and what it replaced

| Was | Is now |
| --- | --- |
| `ocade.memory.local.v1` + a cloud/local backend switch in the panel | `ocade_memory`; `src/lib/memory/portable.ts` keeps the pure export/import and context rendering |
| `ocade.artifacts.v1` + `ocade.output-activity.v1` | `ocade_outputs`, extended with `produced_by`, `verified`, `evidence`, `context`; the activity ledger is a projection of those rows |
| `ocade.chat-citations.v1` | `ocade_messages.citations` |
| `ocade.chat.reactions.v1:<user>:<conversation>` | `ocade_messages.reaction` |
| `ocade.notifications.preferences.v1` (cache) | `ocade_notification_preferences` alone |
| `caera:devices:v1` | `public.devices`, plus a new `platform` column |
| `caera:approvals:v1` | `ocade_approvals`, decided by `ocade_decide_approval` |
| `ocade:unified-tasks:v1` + the `ocade-runtime` IndexedDB store | `ocade_tasks` |
| `ocade:task-comments:v1` | `ocade_task_comments` |
| `ocade.monitors.v1` | `ocade_monitors` |
| `caera:browser:policy:v1` | `ocade_browser_site_policy`, read through a fail-closed in-memory cache |
| `caera:mobile:queue:v1` (durable outbox) | held in the tab, with the screen saying so |

### The two safety-critical ones

A **device revocation** and a **site permission** both lived in one browser, so both applied only
where they were performed. Somebody who revoked a lost phone from a laptop left it trusted
everywhere else. Both are account rows now, and signing out no longer calls `clearDevices()` or
`clearApprovals()` — those were safe while the data was local and would have destroyed the
account's own records once it was not.

An **approval decision** is one statement (`ocade_decide_approval` updates only a row that is still
pending and in date), which closes the read-then-write race two phones could hit.

### Migrations added (all applied live, all in the twin)

`20260909150000_ocade_output_provenance`, `20260909160000_ocade_message_citations_and_reactions`,
`20260909170000_devices_platform`, `20260909180000_ocade_approvals`,
`20260909190000_ocade_tasks_and_comments`, `20260909200000_ocade_monitors_and_browser_policy`.
Each has its rollback and verification; `db-twin.test.ts` applies, verifies and rolls back all 85
against real PostgreSQL.

### Copy corrected

"Browser Only", "PC Vault" and "Private Sync" described modes that no longer exist. Swept from the
legal notice, the privacy summary, support articles, the status catalogue, the capability carousel,
the connectors list, the marketing routes and the auth screen. The `privateSync` capability id is
now `accountStorage`.

## Phase 3 — Supabase security, Auth, MFA and schema reconciliation (COMPLETE)

### Source and live reconciled by effect, not by filename

Source declares 96 `CREATE TABLE` names; two (`audit_log`, `ocade_cloud_usage`) are renamed away by
later migrations to `compliance_audit_log` and `ocade_commercial_usage`. Live now holds exactly those
96 tables — `comm -3` between the two sets is empty. Ten source migrations were absent from
`supabase_migrations.schema_migrations`; three of them (consent receipts, the recent-strong-auth
helpers, organization capability policies) turned out to be **already applied by effect**, which is
why filenames were never trusted here.

Applied live this phase: `admin_operations_read_surfaces`, `status_incidents_and_maintenance`,
`support_article_publishing`, `conversation_share_links`, `commercial_generation_permits`,
`offline_usage_leases`, `claim_generation_transport`.

`supabase/config.toml` named project `ubantxggjducfmwoydim` while every other authority in the
repository — the deploy workflow, the release-source gate, `PRODUCTION_STATE.md`, the live proofs —
names `sazhgaisyhkdbrooycdv`. A wrong `project_id` there is what sends `supabase db push` at the
wrong database, so it now names the live project.

### Defects found and fixed

**The capability vocabulary disagreed with the code.**
`ocade_organization_policies.withheld_capabilities` was constrained to a list containing
`privateSync`; Phase 2 renamed that capability to `accountStorage`. An administrator withholding
account storage would have been refused by a CHECK constraint with nothing on screen explaining why.
Any stored `privateSync` is rewritten before the constraint changes, so a workspace that had
withheld it keeps withholding it.

**Sharing still gated on a removed storage mode.** `ocade_share_conversation` refused unless
`ocade_conversations.privacy_mode = 'private_sync'`, with the message "Switch its storage to Private
Sync first." Nothing set the column any more, so the default carried every row past the check and
the refusal was unreachable — a rule that reads as enforced, is not, and would start refusing real
conversations the moment anything wrote the old value back. The gate is gone and the column with it.

**`privacyMode` was still in the routing engine and in the system prompt.** `EngineContext` required
it, `resolveEngine` never read it, the chat hook defaulted it to `"private_sync"`, and
`assemble.ts` printed `Privacy mode: private_sync.` into the system message — telling the model
about a storage mode the product does not have. Removed from all three.

**Four tables ran two permissive SELECT policies for the same role.** Postgres evaluates every
permissive policy per candidate row and ORs the results, so each read also called `has_role` on rows
the first rule had already admitted. Merged to one policy per role on `ocade_commercial_usage`,
`ocade_organization_events`, `ocade_organizations` and `ocade_support_articles`. Support articles
deliberately keep two: `anon` holds no EXECUTE on `has_role`, so a merged policy would make every
signed-out read of the help centre fail with a permission error instead of returning the article.

**`own_usage_read` named the `public` role**, meaning every role including `anon`. The predicate
saved it — a signed-out reader has no `auth.uid()` — so this was a latent shape rather than a leak,
with a comparison against NULL as the only thing between an anonymous reader and everybody's usage
history. It is `TO authenticated` now.

**Twenty-two foreign keys had no covering index.** Postgres indexes the parent side, so the child
side is a sequential scan — and the scan happens when the PARENT ROW IS DELETED, under a row lock,
while Postgres proves nothing references it. Twenty of the twenty-two reference `auth.users`,
`public.devices` or a lease, and OCADE deletes exactly those: delete-all removes an account and
revoking a device removes its rows. All twenty-two are covered.

**Three grants of workspace access asked for no recent proof.** Eight organization, support and
status mutations already call `ocade_require_recent_strong_auth`; inviting an address, re-issuing its
invitation link and reactivating a suspended member did not. An unlocked laptop was enough to add an
attacker's address as an owner. Re-issuing reads harmless — the address does not change — but the old
token stops working and a new valid one starts, which is the same capability as inviting.
Reactivation is gated; **deactivation deliberately is not**, because suspending is what an
administrator reaches for when unsure and the one thing somebody locked out of their authenticator
still has to be able to do immediately. Organization **groups** stay ungated on purpose: the table is
`(id, organization_id, name, created_at)` and no policy, capability or RLS predicate reads group
membership, so adding somebody to one grants nothing.

**The generated types were stale, and the drift was real.** Regenerating caught the `privacy_mode`
reads in `ocade-projects.functions.ts` plus four RPC arguments the newer generator types as
non-nullable. Three of those parameters have `DEFAULT NULL`, so the calls now omit them; two are
required parameters where NULL is the meaningful value (an unlimited weekly allowance, a notification
with no deep link) and go through the one documented helper in `src/lib/supabase/rpc-null.ts`.

### Audited and deliberately left alone

- **Seven tables with RLS on and no policy** (`ocade_generation_permits`, the four offline-usage
  tables, the two MFA recovery tables). RLS enabled with no policy is closed; each also revokes every
  table privilege from `anon` and `authenticated`. The verification now asserts that pairing, so a
  grant added later cannot leave a policy-less table reachable.
- **Forty-seven SECURITY DEFINER functions callable by `authenticated`.** Each was read: every one
  scopes by `auth.uid()` or checks `has_role`, including the no-argument ones
  (`ocade_expire_due_approvals`, `ocade_cancel_all_automation_runs`,
  `ocade_mark_all_notifications_read`, `ocade_recover_stale_automation_runs`). This is the app's RPC
  surface, not an elevation gap.
- **`ocade_read_shared_conversation` callable by `anon`.** That is the share link, by design: it
  takes the token and returns four fields, and `owner_id` never leaves the database.
- **Eighty-two "unused" indexes.** Usage counters on a database with no production traffic measure
  the absence of traffic. Nothing dropped.
- **Support ticket and message writes.** RLS-scoped by role with one consolidated policy per action.
  Replying to a customer is day-to-day work; a fresh authenticator code before every reply would make
  the gate meaningless. The dangerous support act — publishing an article every visitor reads — is
  gated.
- **`auth_leaked_password_protection` is still disabled.** It is a Supabase Auth dashboard setting
  with no repository path and no management token in this environment. Already recorded in
  `docs/deployment/PRODUCTION_STATE.md` as a pre-launch action.

### Auth, MFA and session surfaces

Audited rather than rebuilt, because they exist: email/password sign-in and sign-up, password reset,
OTP send and verify (all five paths throttled and provider-text mapped, pinned by
`auth-surfaces.test.ts`), configured Google OAuth through `provider-availability.ts` and
`auth.callback.tsx` with `exchangeCodeForSession`, session restore and refresh
(`persistSession`/`autoRefreshToken` on in the browser client and off on both server clients),
revocation through `sessions.functions.ts`, optional MFA with recovery codes
(`src/lib/security/mfa.ts`, `recovery-codes.ts`, `TwoFactorPanel.tsx`, `/challenge`), and
`requireAssurance(HIGH_RISK)` on every server function that does something irreversible.

### Migrations added (all applied live, all in the twin)

`20260910090000_policy_capability_account_storage`,
`20260910100000_conversation_storage_is_the_account`, `20260910110000_one_read_policy_per_role`,
`20260910120000_index_every_cascade_path`,
`20260910130000_confirm_before_granting_workspace_access`. Each has its rollback and verification;
`db-twin.test.ts` applies, verifies and rolls back all 92 against real PostgreSQL.

### Found by the browser proofs, and fixed

**The preparation status panel was covering the Account menu.**
`OfflineIntelligenceProgress` sat at `fixed bottom-4 left-4 z-40` — the sidebar's own corner, at the
sidebar's own z-index — and being rendered later it painted on top. `audit:journey` failed every
sign-out attempt with this panel named as the element intercepting the click. It was not transient:
on a device that fails with `insufficient_storage` the panel never clears, so the way out of the
account was permanently unreachable. It now passes pointer events through with its own controls
opting back in individually, and sits clear of both the sidebar footer and the mobile bottom nav.
The test that guarded this had `expect(PROGRESS_CODE).not.toMatch(/pointer-events-none/)` — banning
the very property that keeps a `role="status"` region from blocking something else — so the
assertion now states the real requirement instead of its opposite.

**Four "Retry" controls measured 30x16.** Below the 24x24 minimum at phone width, on
`settings.security`, `settings.index`, `TwoFactorPanel` and `TasksWorkspace` — and worse than a
typical target-size defect, because Retry is the control somebody reaches for when something has
already failed. All four now have a real hit area and `shrink-0` so a long message cannot squeeze
them back down.

**The route harness measured one document while the product had moved to another.** `/settings/devices`
reported "0 chars, 0 headings, 0 controls" in one full pass and passed ten times out of ten under the
focused harness. The captured evidence named the mechanism — no console error, two vendor chunks
recorded as `net::ERR_ABORTED`, the signature of `isolation-upgrade.ts` calling `location.replace`
for a cross-origin-isolated document. The settle loop that runs after the clicks already restarted
its budget when a new document arrived; the one before them did not. It does now, with the same
two-extension bound, so a page that genuinely cannot settle still fails.

**Three journey stages asserted the removed browser vault.** They created a passphrase, read the work
back offline, and expected it to survive a reopen — all of which the vault provided and Phase 2
deliberately removed. Asserting them would have demanded the product grow back the second authority
the phase existed to remove. The replacements test what now has to hold: the old `/settings/vault`
address reaches the screen that answers what people came for, an unreachable account SAYS SO rather
than rendering as an empty one, and the project made online must NOT appear offline — because if it
did, something would still be caching account content on the device.

### Gate

Phase 3's gate is "no client-controlled ownership, unintended elevated function or cross-tenant data
path". Every server function derives its actor from `requireSupabaseAuth`; every RPC derives it from
`auth.uid()`; `caller-scoped-functions.test.ts`, `security-definer.test.ts`, `user-isolation.test.ts`
and `organization-assurance.test.ts` hold those three properties against real PostgreSQL. Live
security advisors report no `function_search_path_mutable` and live performance advisors no
`unindexed_foreign_keys` and no `multiple_permissive_policies`.

## Next action

Phase 4 — Commercial usage and offline leases. The tables and functions Phase 3 applied
(`ocade_generation_permits`, `ocade_device_usage_keys`, `ocade_device_usage_leases`,
`ocade_offline_usage_allocations`, `ocade_offline_usage_events`, and the acquire/finalize/release,
allocate/activate/reconcile/return and transport-claim functions) are the authority Phase 4 builds
on; do not create a second one.
