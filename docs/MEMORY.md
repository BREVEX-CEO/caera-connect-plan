# Project Memory

## Current Status

OCADE is in a production-completion mission. The audited implementation baseline is `main` commit `5b967735267fb650df63d02d76788ba620353cc4` (`feat: integrate OCADE mission through Block 9`). That baseline consolidated prior Claude/Codex work through Block 9. The canonical implementation authority is root `PLAN.md`; later documentation-only commits may advance `main` without changing the implementation baseline described by the plan.

The 2026-09-09 Markdown cleanup checkpoint at `5440321cb4ceb962f541e2b8ed994d8965234d7a` left 77 tracked Markdown files after three superseded ADR files were consolidated into `docs/DECISIONS.md` and removed. The protected authority set remained intact; later documentation-only authority repairs may advance `main` beyond that historical checkpoint.

The canonical documentation set is now intentionally role-specific: `docs/PRD.md`, `docs/TRD.md`, `docs/APP_FLOW.md`, `docs/UI UX Brief.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/Backend Schema.md`, `docs/RULES.md`, `docs/TESTING.md`, this file and `docs/DECISIONS.md`. `CLAUDE.md` remains the single AI handbook and `PLAN.md` remains the sole implementation sequence. `AGENTS.md` is intentionally absent.

This documentation refresh does not claim the product is production-complete. It records the current decisions and ordered remaining work so a new engineering session can continue without relying on old conversation history.

## Recently Completed

Prior work established deterministic repository evidence, route/donor ledgers, local-model/runtime foundations, extension/native/mobile source, Supabase schema/security groundwork, commercial generation-permit foundations and a normalized intelligence path. The donor inventory accounts for 2,126 files and current production reachability evidence exists for adapted donor modules.

The product decisions were revised: Supabase becomes the canonical persistent authority for ordinary user/account data; first-visit Offline Intelligence preparation starts before authentication where supported; Chat is the signed-in home; no onboarding wizard or separate dashboard remains; Gemini 3.1 Flash-Lite is the pinned online model; exactly three server-side Gemini key slots are allowed; Cowork has Normal and Jarvis presentations over one runtime; no separately marketed desktop application is required; the final UI uses Claude as the primary structural benchmark with ChatGPT/OpenClaw as secondary references; payments/refunds/disputes/Admin grants are the final major implementation phase.

Repository branch housekeeping removed branches proven to be ancestors/duplicates of `main` while retaining branches with active PRs or unique/uncertain work. The Markdown inventory was then audited. Three standalone ADR files were merged into `docs/DECISIONS.md` and deleted; supporting acceptance/readiness, legal, breach/security, deployment/model/CDN, Windows/browser, donor provenance/licence and release-evidence Markdown remain supporting records rather than canonical product authority.

## Currently In Progress

The next engineering mission starts at Phase 0 of `PLAN.md`: refresh the exact implementation baseline, repair stale evidence/failing checks, and then proceed through architecture cleanup, Supabase persistence/security, usage/intelligence/model lifecycle, full donor re-evaluation, Chat, Normal Cowork, Jarvis Cowork, Code, Projects/Tasks/Artifacts/Search/Memory, agents/capabilities, browser/Windows/mobile, organizations/Admin/trust, monitoring/backup/rollback, final UI/UX, localization/accessibility/performance, payments/Admin grants, final reachability cleanup, exhaustive verification, safe main integration and controlled deployment.

## Known Problems

The implementation plan's audited baseline recorded stale mission evidence/hash assumptions, a formatting defect, at least one suite failure tied to stale mission authority and skipped tests requiring review. Existing browser journeys still encode obsolete onboarding/local-first behavior. Chat remains oversized/mixed-responsibility. Old and future route chunks remain in the production graph. Supabase source/live migration histories differ and require semantic reconciliation. Live Supabase security/performance findings include elevated functions/policy issues and index findings that must be resolved from current evidence rather than blindly applied. Gemini currently requires migration to the pinned three-key model boundary. Offline model preparation still needs first-visit/no-redownload behavior proven end to end. Payments/subscriptions retain historical overlapping authorities and are intentionally completed last.

Treat this list as a starting pointer only: rerun the actual current commands and update this file when evidence changes.

## Important Context

Persistent ordinary customer content must end in Supabase PostgreSQL/private Storage. Incognito stays RAM-only. Temporary unsynchronized local-inference turns may exist only in current-tab memory with loss warnings and exactly-once sync. OPFS stores Offline Intelligence model binaries/chunks/model-owned metadata only.

Offline Intelligence begins preparing in the background on the first device/browser visit when supported, including the landing page. A verified installed model is reused across revisit, sign-in/out, account deletion, service-worker/application deployment and compatible upgrades. Only explicit Remove Offline Intelligence deletes it; deliberate removal suppresses automatic reinstall until explicit Install.

All AI-generating surfaces use one OCADE Intelligence/commercial-permit path. Gemini 3.1 Flash-Lite uses primary/secondary/tertiary server secret slots with primary-first pre-output health failover; Local-only must create zero provider traffic.

Cowork Normal and Jarvis share the same task/agent/permission/usage/runtime. Jarvis is the immersive liquid-glass/network orb presentation with audio-reactive states. Browser and Windows actions require observation/re-observation/postcondition verification. Windows control converges PyWin32/UIA/Win32/native, vision and PyAutoGUI behind one RemoteExecutor, with coordinates only as guarded fallback.

The 2,126-file donor is re-evaluated for maximum useful behavior, especially Chat/Cowork/Code/coding-agent/tasks/tools/files/Git/LSP/permissions/memory/recovery. Do not import duplicate donor architecture merely to increase file reuse.

## Recent Decisions

- Supabase/Storage, not browser-local content stores, is the persistent user-data authority — implemented, and enforced by `content-storage:check`.
- A device revocation and a site permission are account facts, not browser facts. Signing out clears what a tab was holding and never the account's own records.
- An approval decision is a single conditional statement in the database, so two devices answering at once cannot both believe they decided it.
- Claude is the primary UI structure/interaction benchmark; ChatGPT and OpenClaw are secondary behavioral references; OCADE remains independently branded/implemented.
- Chat/Cowork/Code are the primary workspace surfaces; Projects/Tasks/Artifacts/Search/Customize/Settings support them.
- The old More dashboard is removed after useful behavior is rewired.
- Payments, refunds, disputes, chargebacks and audited Admin grants are mandatory but implemented last.
- `PLAN.md` is the only implementation plan. `CLAUDE.md` is the only AI handbook. `AGENTS.md` and the former `docs/mission/*` instruction bundle are intentionally removed.
- Separate `TRD.md`, `UI UX Brief.md` and `Backend Schema.md` are now part of the canonical role-specific documentation set while `DESIGN.md` and `ARCHITECTURE.md` remain separate detailed authorities.
- The former standalone ADR decisions now live in `docs/DECISIONS.md`; the three superseded ADR files were removed after their unique decisions were preserved.
- Supporting historical/evidence Markdown is deleted only when proven unreferenced and valueless for legal/provenance/audit/operations; cleanup must never break package scripts, tests or recovery evidence.

## Current State

Branch `claude/plan-implementation-n3yjkn`, cut from `origin/main` at `a7a99e3`.

`PLAN.md` Phase 0 (baseline and evidence repair), Phase 2 (Supabase canonical persistence) and
Phase 3 (Supabase security, Auth, MFA and schema reconciliation) are complete. Phase 1 is complete
except for splitting `ChatSurface`, which is carried forward.

Phase 2 in one line: ordinary user content now has ONE persistent authority. Memory, artifacts and
their activity ledger, citations, message feedback, notification preferences, paired devices,
approvals, tasks, task comments, monitors and browser site permissions all moved from
`localStorage`/IndexedDB into the account. `npm run content-storage:check` fails the build if
content returns to browser storage; 40 device/model stores are declared with a written reason each.

Two of those were safety-critical rather than merely inconvenient. A device revocation and a site
permission each lived in one browser, so revoking a lost phone from a laptop left it trusted on
every other machine. Both are account rows now, and signing out no longer clears devices or
approvals — that was safe while they were local and destructive once they were not.

Phase 3 in one line: source and live agree, and the acts that hand out access ask who you are.
Source declares 96 tables (two renamed away by later migrations) and live now holds exactly those
96; the reconciliation was done by schema effect, which is how three "missing" migrations turned out
to be already applied. Seven previously-unapplied migrations were applied, and five new ones repaired
what the reconciliation exposed:

- `ocade_organization_policies` still constrained capabilities to `privateSync`, so withholding
  account storage would have been refused by a CHECK constraint with nothing on screen to explain it.
- `ocade_share_conversation` still refused unless `privacy_mode = 'private_sync'` — a rule that read
  as enforced, was unreachable because nothing set the column, and would have started refusing real
  conversations the moment anything wrote the old value back. Gate and column both removed.
- `privacyMode` was still a required field on `EngineContext` that nothing read, and
  `assemble.ts` printed it into the system prompt, telling the model about a storage mode the product
  does not have.
- Four tables ran two permissive SELECT policies for the same role, so every read also called
  `has_role` on rows already admitted. Merged. Support articles deliberately keep two, because `anon`
  cannot execute `has_role` and a merged policy would break the signed-out help centre.
- Twenty-two foreign keys had no covering index. The cost lands on DELETE of the parent, under lock —
  and twenty of them are on the account-deletion and device-revocation paths.
- Inviting an address, re-issuing its invitation link and reactivating a suspended member asked for no
  recent strong authentication, so an unlocked laptop could add an owner. Now gated. Deactivation
  stays ungated on purpose; organization groups stay ungated because they grant nothing.

Regenerating the types caught real drift rather than noise, including four RPC arguments the newer
generator types as non-nullable; three are omitted now and two go through
`src/lib/supabase/rpc-null.ts`. `supabase/config.toml` pointed at the wrong project and now names
`sazhgaisyhkdbrooycdv`.

Twelve migrations were added across Phases 2 and 3, each with its rollback and verification; the
database twin applies, verifies and rolls back all 92 against real PostgreSQL. Live security advisors
report no mutable function search path; live performance advisors report no unindexed foreign keys and
no duplicated permissive policies. The full record, including what was audited and deliberately left
alone, is in `docs/mission/OCADE_EXECUTION_STATE.md`.

The browser proofs found three more defects and one stale harness. A status panel was covering the
Account menu at the same corner and z-index as the sidebar, permanently on a device that fails for
storage — so signing out was unreachable. Four "Retry" controls measured 30x16, below the touch
minimum, on exactly the screens somebody reaches after a failure. The route harness measured one
document while the product had already replaced it, which produced a blank-page report for a route
that passes ten times out of ten. And three customer-journey stages still asserted the browser vault
Phase 2 removed; they now assert what has to hold instead — an unreachable account says so, and the
work made online must NOT be readable offline.

## Next Steps

Phase 8 (Normal Cowork) is complete. The runtime was already there — one agent
loop, one task registry, observation-backed verification of every mutating
action, an approval layer shared with Chat. What was wrong was the account it
gave of itself, and every one of the five defects reported work as other than it
was, which is this phase's gate stated in the negative.

The planner read success as `reason === "answered"`, but the loop's ending for a
run that used tools and could stand behind them is `verified` — the stronger of
the two. So every step that touched anything was recorded as failed: a completed
multi-step task turned the panel red, and the next step was told the previous one
"did not work". Pressing Stop mid-plan was reported the same way, and because
only a cancelled run escapes delivery, it was also charged for. Typing a new
instruction during a plan recorded "New instruction" and did nothing with it —
the revision handle never reached `runPlannedTask`. The plan itself was invisible:
`onStep` existed and nothing passed it. And `reconcileInterruptedRuns` treated
"not in this tab's registry" as proof of death, so a second window buried the
mission running in the first one while it carried on moving the mouse.

All five are fixed at the authority rather than the symptom: one `succeeded()`,
one plan `reason` that cancellation outranks, the revision passed through and
carried into later steps, the step announced as a timeline entry of its own, and
a 20-second heartbeat with a three-beat staleness threshold.

Cowork also gained what it did not have. Emergency stop kills every live run
anywhere in OCADE, hands back the keyboard, does not take it again, asks for no
confirmation and says what it stopped. The Command Center became what
`docs/DESIGN.md` describes — a collapsible inspector, closed by default, behind
one control, answering this computer, this browser, who is acting, permission
and what the workspace withheld, the current action, receipts and diagnostics —
instead of a name on the column holding the conversation. A companion killed
between instructions gets one reconnect before the refusal is reported. A reload
mid-task now says what was interrupted, and restarts nothing.

`ChatSurface` is still ~3,500 lines inside `ocade.index.tsx`, carried from Phase
1, deliberately.

Next is Phase 9 — Jarvis Cowork: a view and controller over this same runtime,
never a second one. Gate: Normal and Jarvis produce identical task history,
permissions, usage and receipts.

One known external item remains from Phase 3: `auth_leaked_password_protection`
is disabled in Supabase Auth. It is a dashboard setting with no repository path,
recorded in `docs/deployment/PRODUCTION_STATE.md` as a pre-launch action.

## Things to Be Careful About

Do not assume old local-first README/architecture text is current. Do not reintroduce cloud/provider bypasses around the commercial permit. Do not persist normal content locally. Do not redownload a valid model because the site updated. Do not make Jarvis a second Cowork engine. Do not treat issued automation actions as success before re-observation. Do not merge duplicate payment/subscription tables without preserving history. Do not expose real secrets. Do not remove donor/provenance/legal/evidence/runbook documents required for compliance, scripts or recovery merely to reduce Markdown count. Do not deploy a tree different from the one verified.

## Session Handoff

A new AI coding session should read `CLAUDE.md`, `docs/PRD.md`, `docs/TRD.md`, `PLAN.md`, `docs/APP_FLOW.md`, `docs/UI UX Brief.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/Backend Schema.md`, `docs/RULES.md`, `docs/TESTING.md`, this file and `docs/DECISIONS.md`, then inspect the live repository rather than asking the owner to restate the mission. Update this file after meaningful implementation sessions with the exact current branch/SHA, completed phase/checkpoint, new known problems and next action. Keep it concise and remove obsolete handoff material when the state changes.
