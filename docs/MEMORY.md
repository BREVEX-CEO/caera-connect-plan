# Project Memory

## Current Status

OCADE is in a production-completion mission. The audited implementation baseline is `main` commit `5b967735267fb650df63d02d76788ba620353cc4` (`feat: integrate OCADE mission through Block 9`). That baseline consolidated prior Claude/Codex work through Block 9 and removed the old mission branches after verification. The canonical implementation authority is now root `PLAN.md`; the old Block-era mission-document set is superseded.

This documentation refresh does not claim the product is production-complete. It records the current decisions and the ordered remaining work so a new AI coding session can continue without reading old conversation history.

## Recently Completed

Prior work established strong deterministic repository evidence, route/donor ledgers, local-model/runtime foundations, extension/native/mobile source, Supabase schema and security groundwork, commercial generation-permit foundations and a normalized intelligence path. The donor inventory accounts for 2,126 files and current production reachability evidence exists for adapted donor modules.

The product decisions were then revised: Supabase becomes the canonical persistent authority for ordinary user/account data; first-visit Offline Intelligence preparation starts before authentication where supported; Chat is the signed-in home; no onboarding wizard or separate dashboard remains; Gemini 3.1 Flash-Lite is the pinned online model; exactly three server-side Gemini key slots are allowed; Cowork has Normal and Jarvis presentations over one runtime; no separately marketed desktop application is required; the final UI uses Claude as the primary structural benchmark with ChatGPT/OpenClaw as secondary references; payments/refunds/disputes/Admin grants are the final major implementation phase.

## Currently In Progress

The next engineering mission starts at Phase 0 of `PLAN.md`: refresh the exact baseline, repair stale evidence/failing checks, and then proceed through architecture cleanup, Supabase persistence/security, usage/intelligence/model lifecycle, full donor re-evaluation, Chat, Normal Cowork, Jarvis Cowork, Code, Projects/Tasks/Artifacts/Search/Memory, agents/capabilities, browser/Windows/mobile, organizations/Admin/trust, monitoring/backup/rollback, final UI/UX, localization/accessibility/performance, payments/Admin grants, final reachability cleanup, exhaustive verification, safe main integration and controlled deployment.

## Known Problems

The implementation plan's audited baseline recorded stale mission evidence/hash assumptions, a formatting defect, at least one suite failure tied to stale mission authority and skipped tests requiring review. Existing browser journeys still encode obsolete onboarding/local-first behavior. Chat remains oversized/mixed-responsibility. Local-first persistence paths and old/future route chunks remain in the production graph. Project/task/artifact and related authorities still include localStorage/IndexedDB paths. Task state/persistence is fragmented. Supabase source/live migration histories differ and require semantic reconciliation. Live Supabase security/performance findings include elevated functions/policy issues and index findings that must be resolved from current evidence rather than blindly applied. Gemini currently requires migration to the pinned three-key model boundary. Offline model preparation still needs first-visit/no-redownload behavior proven end to end. Payments/subscriptions retain historical overlapping authorities and are intentionally completed last.

Treat this list as a starting pointer only: rerun the actual current commands and update this file when evidence changes.

## Important Context

Persistent ordinary customer content must end in Supabase PostgreSQL/private Storage. Incognito stays RAM-only. Temporary unsynchronized local-inference turns may exist only in current-tab memory with loss warnings and exactly-once sync. OPFS stores Offline Intelligence model binaries/chunks/model-owned metadata only.

Offline Intelligence begins preparing in the background on the first device/browser visit when supported, including the landing page. A verified installed model is reused across revisit, sign-in/out, account deletion, service-worker/application deployment and compatible upgrades. Only explicit Remove Offline Intelligence deletes it; deliberate removal suppresses automatic reinstall until explicit Install.

All AI-generating surfaces use one OCADE Intelligence/commercial-permit path. Gemini 3.1 Flash-Lite uses primary/secondary/tertiary server secret slots with primary-first pre-output health failover; Local-only must create zero provider traffic.

Cowork Normal and Jarvis share the same task/agent/permission/usage/runtime. Jarvis is the immersive liquid-glass/network orb presentation with audio-reactive states. Browser and Windows actions require observation/re-observation/postcondition verification. Windows control converges PyWin32/UIA/Win32/native, vision and PyAutoGUI behind one RemoteExecutor, with coordinates only as guarded fallback.

The 2,126-file donor is re-evaluated for maximum useful behavior, especially Chat/Cowork/Code/coding-agent/tasks/tools/files/Git/LSP/permissions/memory/recovery. Do not import duplicate donor architecture merely to increase file reuse.

## Recent Decisions

- Supabase/Storage, not browser-local content stores, is the persistent user-data authority.
- Claude is the primary UI structure/interaction benchmark; ChatGPT and OpenClaw are secondary behavioral references; OCADE remains independently branded/implemented.
- Chat/Cowork/Code are the primary workspace surfaces; Projects/Tasks/Artifacts/Search/Customize/Settings support them.
- The old More dashboard is removed after useful behavior is rewired.
- Payments, refunds, disputes, chargebacks and audited Admin grants are mandatory but implemented last.
- `PLAN.md` is the only implementation plan. `CLAUDE.md` is the only AI handbook. `AGENTS.md` and the former `docs/mission/*` instruction bundle are intentionally removed to avoid duplicate authorities.

## Next Steps

Create one isolated completion branch from freshly fetched `origin/main`, inspect actual current Git/repository state, run the Phase 0 baseline checks in `PLAN.md`, update generated requirement/route/donor/gap evidence against the new canonical documents, fix the baseline failures at root cause, and proceed only when Phase 0's checkpoint is green.

## Things to Be Careful About

Do not assume old local-first README/architecture text is current. Do not reintroduce cloud/provider bypasses around the commercial permit. Do not persist normal content locally. Do not redownload a valid model because the site updated. Do not make Jarvis a second Cowork engine. Do not treat issued automation actions as success before re-observation. Do not merge duplicate payment/subscription tables without preserving history. Do not expose real secrets. Do not remove donor/provenance/legal evidence required for compliance. Do not deploy a tree different from the one verified.

## Session Handoff

A new AI coding session should read `CLAUDE.md`, `docs/PRD.md`, `PLAN.md`, `docs/APP_FLOW.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/RULES.md`, `docs/TESTING.md`, this file and `docs/DECISIONS.md`, then inspect the live repository rather than asking the owner to restate the mission. Update this file after meaningful implementation sessions with the exact current branch/SHA, completed phase/checkpoint, new known problems and next action. Keep it concise and remove obsolete handoff material when the state changes.