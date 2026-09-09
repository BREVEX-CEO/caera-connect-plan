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

## Next action

Phase 3 — Supabase security, Auth, MFA and schema reconciliation. Start by semantically reconciling
source migrations against live: the live database was 78 tables against 91 in source before this
phase, and the named gaps have not yet been worked. Note also that `supabase/config.toml` names
project `ubantxggjducfmwoydim` while the live project this session applied migrations to is
`sazhgaisyhkdbrooycdv` — reconcile that before any deployment step.
