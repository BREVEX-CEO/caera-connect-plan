# OCADE ToRemove Audit

## Purpose

This file records obsolete, superseded, or current-scope-incompatible code and repository material that should be removed, retired, rerouted, or consolidated after verification.

The current product authority is the owner-approved OCADE documentation under `docs/`. CARCC is the company, OCADE is the product, and the current mission is a website-first Chat product centered on Chat, Library, Settings, Offline Intelligence, usage, authentication, pricing information, public/legal pages, and the hidden Admin surface.

This file is not permission to delete live customer data, applied production migrations, production credentials, the admin account, or unreviewed branch history. Every destructive cleanup must first prove that the target is no longer required and that the replacement path is working.

## Status (2026-09-23)

Done on `claude/cool-allen-rlxvkm`: Cowork route, nav, surface and copy removed; Trash/restore replaced by confirmed permanent Delete; provider payment tables, webhook function, side-thread columns and uncalled helper functions retired by forward migration `20260923100000` (apply after that Worker deploys); dead limits module removed. Historical migrations stay as provenance. Branches were reviewed and hold no unmerged current-product value; deleting them needs the owner's go-ahead.

## Current audit baseline

The repository was inspected from `main` at SHA `4a94c049900e46bb997d81bcbe03f61de2a7faac`.

The current repository still contains one live Cowork placeholder route, active Trash/restore conversation logic, legacy payment-schema artifacts, historical migrations for retired product systems, and many non-main branches that require classification before deletion.

## Remove the live Cowork placeholder from the current product

The latest owner instruction is to keep only the current product and remove old or future product code such as Cowork, Projects, Tasks, Artifacts, Automations, Monitors, Organizations, and similar dormant systems.

Remove or reroute these current Cowork references after confirming no current customer flow depends on them:

- Remove the Cowork navigation item from `src/components/shell/AppShell.tsx`, where the primary navigation currently routes to `/cowork`.
- Remove `src/routes/_authenticated/cowork.tsx`, because the route is a future-product placeholder rather than a current OCADE capability.
- Regenerate `src/routeTree.gen.ts` after deleting the Cowork route instead of hand-maintaining stale generated route references.
- Update `docs/PRD.md`, `docs/APP_FLOW.md`, `AGENTS.md`, `CLAUDE.md`, and any other current authority that still says Cowork may remain as a placeholder, so the documentation matches the new decision that future-product code should not remain in the current product.
- Remove any Cowork-specific icon import, label, test, metadata, sitemap reference, navigation branch, analytics event, or dead component that becomes unreachable after the route is removed.

The replacement route is not another future module. The current navigation should reuse the existing Chat, Library, Settings, Pricing/public-page, and Account/Admin authorities only.

## Retire the Trash/restore conversation lifecycle

The current product decision is permanent Delete after explicit confirmation, without a separate Trash/restore deletion lifecycle.

The repository still contains active Trash behavior and should be simplified:

- Replace `setConversationTrashed` and related `deleted_at` Trash behavior in `src/lib/ocade.functions.ts` with the one current permanent-delete authority after the permanent-delete server/database path is proven.
- Remove Trash-specific calls from `src/components/chat/ChatWorkspace.tsx` after the replacement Delete flow is connected.
- Replace the Trash action in `src/components/chat/ConversationList.tsx` with the current permanent Delete flow and keep the confirmation behavior.
- Remove `src/lib/chat/__tests__/conversation-trash-schema.test.ts` only after equivalent permanent-delete authorization and regression tests exist.
- Retire the database functions `ocade_conversation_trash_days` and `ocade_purge_expired_conversation_trash` through a new verified migration rather than by editing already-applied migration history.
- Retire the `deleted_at` Trash state only after proving that no active current query, export, audit, retention rule, or recovery behavior still depends on it.
- Keep Archive only if it remains a deliberate non-destructive organization feature. Archive must never act as a second deletion lifecycle.

Do not delete an existing conversation first and then discover that current code still expects Trash/restore semantics. Build and prove the permanent-delete replacement before dropping the old authority.

## Retire legacy payment-provider runtime and schema remnants

The active Paddle runtime and public webhook route were already removed from current source, but generated database types still expose legacy payment-provider structures.

The generated schema currently still contains legacy tables or provider-specific fields including:

- The `ocade_invoices` table still contains payment-event references.
- The `ocade_payment_events` table still contains provider payment references.
- The `payment_webhook_events` table remains in generated types.
- The `subscriptions` table still contains provider-specific customer and subscription identifiers.
- The `apply_payment_webhook_event` RPC and provider-specific arguments remain in generated types.

Paid checkout is closed and Paddle is not a current product dependency. Codex should trace every caller and production retention requirement, then propose a new safe retirement migration for provider-specific live objects that are no longer required. Do not rewrite or delete old applied migration files merely to make the repository look cleaner.

Keep the current pricing catalogue only as truthful product information while paid checkout remains closed.

## Retired product migration families

The repository contains historical migration, rollback, and verification files for features that are outside the current product. These historical files are not evidence that the features should still exist.

The currently visible retired families include:

- The `20260722090000_ocade_projects_outputs_memory` migration family contains Projects/Outputs/Memory-era schema.
- The `20260722110000_ocade_automations` migration family contains Automations-era schema.
- The `20260724211500_ocade_automation_worker` migration family contains the old automation worker.
- The `20260824113306_fix_automation_enqueue_ambiguity` migration family contains an old automation repair.
- The `20260904120000_ocade_organizations_and_membership` migration family contains Organizations and membership.
- The `20260904140000_organization_ownership_before_account_deletion` migration family contains old organization ownership behavior.
- The `20260904150000_high_risk_organization_actions_require_recent_strong_auth` migration family contains organization-specific privileged behavior.
- The `20260904160000_organization_capability_and_tool_policies` migration family contains organization capability/tool policy behavior.
- The `20260905090000_conversation_share_links` migration family contains public conversation sharing.
- The `20260909130000_ocade_side_conversations` migration family contains the retired side-conversation design.
- The `20260909140000_ocade_project_files_and_folders` migration family contains Project files/folders.
- The `20260909190000_ocade_tasks_and_comments` migration family contains Tasks and comments.
- The `20260909200000_ocade_monitors_and_browser_policy` migration family contains Monitors and browser-policy product behavior.
- The `20260910140000_conversation_trash_and_restore` migration family contains the obsolete Trash/restore lifecycle.
- The `20260910150000_a_task_can_belong_to_a_project` migration family contains Task-to-Project coupling.
- The `20260913050000_two_organization_helpers_outlived_their_product` migration family is itself evidence that organization helpers already outlived that product.

Do not simply delete historical migration files if they were applied to production. First inspect the live Supabase schema and generated types, identify which retired objects still exist, and create a new forward-only retirement migration that safely drops or transforms only obsolete live objects.

After the live schema is clean and a fresh reproducible baseline strategy is proven, a separate repository-history consolidation may decide whether old migration/rollback/verification files can be archived or squashed. Until then, retain them as migration history while ensuring no runtime code imports or depends on the retired systems.

## Remove obsolete active references instead of merely hiding them

Codex should scan every current source file, generated file, test, script, route, database type, migration, environment example, public page, and documentation file for the following retired concepts:

- Cowork should have no active route, navigation item, component, runtime authority, or customer-facing placeholder after the current cleanup is approved.
- Projects should have no current route, active table authority, current API, component, hook, state store, background worker, or customer-facing surface.
- Tasks should have no current route, active table authority, current API, component, hook, state store, or customer-facing surface.
- Artifacts should not remain as a separate product module. Generated outputs should reuse the current Library authority where applicable.
- Automations should have no current worker, scheduler, route, component, API, hook, or product authority.
- Monitors should have no current route, browser-policy product path, scheduler, worker, or customer-facing surface.
- Organizations and team-workspace code should have no current product route, membership UI, capability policy, or role system beyond the current account/admin requirements.
- Side conversations should not remain as a separate persistence model. Highlighted text should reuse the current Chat context through Ask OCADE.
- Public share links should not remain active while public conversation sharing is outside current scope.
- Trash/restore should not remain as the deletion authority once permanent Delete is implemented.
- Native-app, browser-control, computer-control, Jarvis, or future-agent code should not remain as current product code unless a new owner-approved mission explicitly reintroduces it.

For every match, record the exact file, folder, function, component, table, RPC, route, test, script, or generated reference. Classify it as active and removable, active but reusable, historical evidence, generated output, or blocked by an unresolved dependency.

## Reuse and reroute rules

Cleanup should make the codebase smaller by routing behavior into existing current authorities instead of replacing removed systems with new abstractions.

- Route generated files and customer-created outputs into the existing Library authority instead of preserving a separate Artifacts product.
- Route highlighted text questions into the existing Chat conversation/context authority instead of preserving side-conversation tables or stores.
- Route every AI request through the existing Auto/Online/Offline intelligence router instead of creating mode-specific Chat engines.
- Route every successful logical generation through the existing account-wide usage authority instead of creating a second quota counter.
- Route durable signed-in account data through the current Supabase account authority instead of reviving project/task/local duplicate databases.
- Route Offline model bytes, chunks, checkpoints, verification metadata, release pointers, and runtime model assets into the one OPFS model authority only.
- Reuse the current Chat, Library, Settings, Account, Admin, auth, notification, usage, and intelligence components when they already solve the needed behavior.
- Reuse existing validation, security, file handling, error handling, accessibility, and query utilities instead of adding wrappers with equivalent behavior.

For every proposed reroute, identify the old caller, the target authority, the exact connection point, and the regression test that proves behavior did not change unexpectedly.

## Branch cleanup

The repository currently contains many non-`main` branches from previous agents, documentation passes, rebuild attempts, feature work, fixes, imports, and Dependabot updates.

Codex must inspect every non-`main` branch and classify it before deletion.

Branches with currently open pull requests must not be deleted during the read-only audit. The open-PR branch set observed during this audit includes:

- `agent/full-repo-error-audit-20260818` is used by open PR #8.
- `agent/local-only-hardening` is used by open PR #7.
- `agent/repo-wide-hardening-20260818` is used by open PR #6.
- `dependabot/github_actions/actions/checkout-7.0.1` is used by open PR #42.
- `dependabot/github_actions/actions/setup-node-7.0.0` is used by open PR #43.
- `dependabot/github_actions/actions/upload-artifact-7.0.1` is used by open PR #44.
- `dependabot/github_actions/github/codeql-action/analyze-4.38.0` is used by open PR #41.
- `dependabot/github_actions/github/codeql-action/init-4.38.0` is used by open PR #45.
- `dependabot/npm_and_yarn/eslint-10.9.0` is used by open PR #24.
- `dependabot/npm_and_yarn/eslint-plugin-react-hooks-7.1.1` is used by open PR #26.
- `dependabot/npm_and_yarn/multi-00f7b83f97` is used by open PR #37.
- `dependabot/npm_and_yarn/routine-8c1a79006f` is used by open PR #46.
- `dependabot/npm_and_yarn/vitest-4.1.11` is used by open PR #25.

Every other non-`main` branch should be compared against current `main` for unique commits, open review state, and any still-needed work.

The large cluster of `rebuild/simplified-ocade-authority*` branches and old `docs/*`, `claude/*`, `agent/*`, `feat/*`, `fix/*`, and `import/*` branches should be treated as deletion candidates when they are fully merged, superseded, or contain no unique current work.

The audit must output an exact branch table with the branch name, head SHA, unique commits versus `main`, related PR state, classification, and deletion recommendation.

Because the requested Codex audit is GitHub read-only, Codex should not actually delete branches. It should produce the exact safe deletion set so a later authorized cleanup can remove them without losing unique work.

## Do not remove these current authorities merely to reduce line count

Do not delete or weaken current code simply because it is large.

Keep and improve the current:

- Keep the Chat authority because it owns current conversations and message behavior.
- Keep the Library authority because it is the destination for uploaded and generated files.
- Keep the Settings authority because it owns current account/product settings.
- Keep the Auto/Online/Offline router because it is the one customer intelligence-routing authority.
- Keep the account-wide usage authority because it prevents inconsistent quota accounting.
- Keep the Offline installer and OPFS model lifecycle because they are required current product behavior.
- Keep auth, MFA, session/device revocation, RLS, server-side authorization, security headers, validation, and audit controls that protect current product behavior.
- Keep the hidden Admin capability required for owner/admin grant management.
- Keep tests that prove current security, authorization, accounting, deletion, Offline integrity, and customer-visible behavior.

YAGNI and KISS must reduce unnecessary code, not remove required safeguards.

## Required output from the future audit

For every obsolete or suspect item, the audit must report:

- State the exact file or folder path where the item is present.
- State the exact function, component, route, table, RPC, migration, test, script, branch, or generated symbol involved.
- State whether the item is broken, obsolete, duplicated, unreachable, historical, reusable, or security-sensitive.
- State what should replace or absorb it.
- State exactly how callers should be rerouted.
- State exactly what can be deleted and what must remain until a migration or replacement is proven.
- State the regression/security tests required before deletion.
- State the expected line-count or complexity reduction where it is meaningful.
- State whether removal improves performance, maintainability, attack surface, build size, bundle size, database complexity, or debugging clarity.

The final audit must include total counts by severity and by cleanup class, together with a complete file-by-file removal map.

## Security review requirement

After mapping removal and reuse, perform a separate adversarial security analysis.

Model how an elite attacker would target OCADE through authentication, sessions, OAuth callbacks, account switching, RLS, privileged RPCs, Admin grants, file uploads, prompt/file injection, usage permits, Offline leases, model delivery, OPFS state, service workers, browser storage, redirects, CSP, headers, API limits, concurrency races, stale state, error leakage, provider-boundary abuse, and deployment mismatch.

For every plausible attack path, identify the exact current defense, the exact missing control if one exists, the likely impact, the relevant file/service/database rule, and the smallest robust mitigation.

Do not add security theater, duplicate middleware, duplicate authorization systems, or unnecessary dependencies. Reuse the existing security authorities whenever they can correctly enforce the missing control.

## Final cleanup doctrine

Use **YAGNI — You Aren't Gonna Need It** to remove code, abstractions, routes, schemas, flags, workers, modules, dependencies, and compatibility paths that serve no current approved requirement.

Use **KISS — Keep It Simple, Stupid** to choose the smallest clear architecture with one authority per responsibility, direct routing, fewer layers, fewer maintained lines, fewer states, and fewer places for bugs to hide.

The goal is not the smallest line count at any cost. The goal is fewer necessary lines, fewer duplicate authorities, better performance, clearer ownership, stronger security, easier maintenance, and a lower probability of defects.
