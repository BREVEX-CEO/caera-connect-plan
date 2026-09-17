# OCADE Chat-First Production Completion Plan

## Authority and current baseline

This document is the only active implementation plan. It replaces every earlier continuation plan that conflicts with the decisions below. Work starts from the latest fetched release target and verifies the live external authorities before changing production.

The repository-controlled implementation for Phases 0–14 was completed and merged at `2b43728a87a64fe28275b84aa30a6122f2bf4fc2`. That tree passed 826 unit/database tests, 15/15 verification gates, and 11 browser journeys with 263 checks.

The live Supabase project is `sazhgaisyhkdbrooycdv`. The database and repository migration/type state were reconciled: all 101 repository migrations are represented live, one under a different ledger name whose objects were verified directly, and generated Supabase types were regenerated from the live schema.

The live `ocade-intelligence` Edge Function is still version 6 and is materially older than the completed repository tree. The old function has a 1 MiB request limit where the repository allows 24 MiB, validates attachments but does not forward them to the provider, and does not include grounded web research. The previous Claude session did not deploy it because the available Supabase MCP deploy action required the function contents to be hand-inlined; manually transcribing roughly 27 KB of `edge-handler.ts` into a production boundary risked byte corruption. The safe remaining deployment path is the Supabase CLI from the verified repository tree.

The production frontend Worker is also still an older pre-Phase-1 build until the matching web release is deployed. Edge and frontend must ship as one compatible release, followed by live health and customer-path smoke tests.

Cowork is not part of this mission. It may remain as a simple placeholder, but no Cowork/Jarvis expansion may begin until every reachable requirement in this plan is complete and the owner explicitly starts the next mission.

Payments are not a blocker for this mission. Pricing, Billing, entitlement display, manual Admin grants, and honest unavailable checkout states must work, but production payment-provider onboarding remains an owner-only future task.

Supabase leaked-password protection is not a release blocker while OCADE uses Google and email OTP rather than customer passwords and the feature remains unavailable on the current Supabase plan.

## Current release work still open

- Deploy the repository version of `ocade-intelligence` to `sazhgaisyhkdbrooycdv` using a byte-safe path such as `supabase functions deploy ocade-intelligence --project-ref sazhgaisyhkdbrooycdv` from the verified repository checkout.
- Deploy the matching frontend/Worker release from the same verified tree.
- Confirm `https://ocade.in/api/health` reports `supabasePublic`, `supabaseServer`, `modelDelivery`, and `offlineLeases` as `true` without exposing secret values.
- Run live signed-in smoke tests for Chat, usage settlement, attachments, grounded research, Settings, Library, Offline delivery, and reconnect behavior.
- Complete the hardware-only external proof for real WebGPU generation, forced WebGPU failure with WASM fallback, and the real 484 MB private-object install/resume/repair/reinstall journey. Do not fabricate hardware evidence when the environment lacks the required device or object.

## Current production defects that must be treated as real bugs until the matching release is deployed

- The real Chat can fail before intelligence with “OCADE could not verify your usage allowance” because production still runs an older frontend/Worker release. The completed repository tree contains the root-cause repair, but production parity is not proven until deployment and smoke testing.
- Billing, Advanced, Chat history, and Offline availability fixes exist in the repository but are not considered live until the matching frontend release is deployed and tested.
- The deployed `ocade-intelligence` function and current repository are not yet the same compatible release. The exact source tree, Edge version, database migrations, usage RPCs, and Offline release must be verified together.
- WebGPU is not accepted as complete merely because capability detection exists. Real generation must still be proven on supported hardware, with automatic WASM fallback before output when WebGPU is unavailable or fails.

## Locked product behavior

- `/` opens Chat immediately. Signed-out visitors may inspect Chat, Library, Pricing, legal pages, and the shell, but Send requires sign-in.
- New Chat shows a clean empty composer immediately and does not create an empty database conversation. A durable conversation is created only when the first logical Send is accepted and persisted successfully.
- The composer exposes `Auto | Online | Offline`. Auto uses connected OCADE while the Internet and online boundary are healthy, switches to Offline when connectivity is absent and Offline is ready, and may fall back to Offline only when online generation fails before provider output starts.
- When the browser has no Internet, Online is disabled and Auto visibly but subtly indicates that it is operating Offline. Manual Offline sends no Gemini/provider request under any condition.
- Offline conversations ultimately belong to Supabase. While disconnected, unsynchronized turns are retained in the smallest safe local sync journal needed for survival and are uploaded exactly once when connectivity returns. Supabase remains canonical after reconciliation.
- The first successful sign-in on a device begins Offline preparation automatically as soon as practical without blocking normal Online Chat. A verified compatible local installation is reused across refreshes, browser restarts, sign-in cycles, and ordinary OCADE deployments.
- If the user explicitly removes Offline Intelligence, that decision persists. OCADE must not redownload automatically after a deploy, refresh, restart, or sign-in. Offline remains disabled until the user explicitly chooses Install Offline.
- Normal customer UI and assistant responses identify the intelligence only as OCADE, Online, or Offline. Provider, model, artifact format, WebGPU/WASM, vendor, key, and internal runtime names are not shown to normal customers.
- One successful logical user request consumes exactly one use. Failed requests consume zero. Internal retries and pre-output fallback attempts do not add uses. Regenerate and Edit→successful regeneration each consume one successful use.
- Usage is account-wide across Online and Offline modes. Exhaustion blocks new generation while history, Library, Settings, Pricing, Billing, export, and account controls remain usable.
- Chat supports Copy, Edit, Delete, Share action preparation, Regenerate, Retry, Stop, Markdown, tables, links, code-block Copy, generated titles, rename, search, grouped history, drafts, duplicate-Send prevention, temporary chat, individual export, and contextual controls that stay visually quiet until needed.
- The composer supports `+`, multiple attachments, text, microphone dictation, mode selection, Thinking, Send/Stop, drag-and-drop, paste, attachment progress, remove, retry, reorder, and preview/download. Supported attachments may be up to 100 MB each subject to bounded total-message limits.
- Thinking is exposed only where the active route can truthfully honor it. The approved Offline release `ocr-2dc0ee44eb397906` has been proven to deliberate with that same artifact and declares the capability; Auto/Online do not expose a fake Thinking switch when the online boundary has no matching parameter.
- Uploaded content is untrusted. OCADE must validate ownership, size, declared and detected type, archive structure, parser limits, and extraction bounds; it must never execute uploaded content or let document text become privileged instructions. Malformed, dangerous, or unsupported content fails closed with a short customer-safe error.
- Important answers based on files should cite the useful file/page/section/row/cell source where practical. Offline image understanding is not claimed; images require connected OCADE. Safe local text extraction may feed Offline mode where supported.
- Microphone behavior is dictation first. Speech is placed into the composer for review and is never auto-sent. If the browser lacks the required native capability, the control is disabled or hidden truthfully.
- Public conversation sharing is deferred until core Chat is fully reliable. The user-message action surface may expose Share only when the actual safe sharing flow exists; otherwise the control remains absent rather than fake.
- Web research belongs to normal Chat through the existing intelligence/tool authority and uses provider-native grounded search rather than a second crawler or Chat engine.

## Locked navigation and settings

- The primary sidebar remains compact and contains New Chat, Chat, Library, Cowork placeholder, recent conversations/search, and the account control. It must not become a dashboard of product modules.
- Settings contains Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced. Offline Intelligence belongs inside Data Controls or a clearly nested Intelligence subsection rather than becoming a competing top-level product.
- Usage & Limits shows the current tier, current 6h28m window, weekly cap where applicable, remaining uses, reset times, what counts as one use, and a compact meter.
- Billing shows plan and upgrade information with clear Free/Pro/Max cards. When payment-provider checkout is not configured, it must say so honestly rather than pretending a checkout succeeded.
- Account keeps Google and email OTP identity, email change where supported, session-safe sign-out, device/session management where actually implemented, and account deletion with confirmation. Phone authentication is removed completely.
- Notifications must not describe recovery codes or other removed systems. Security-critical account messages remain truthful even when optional product notifications are disabled.

## Locked design direction

- OCADE uses a near-black/charcoal foundation with neutral grey and white, restrained medium glassmorphism on important surfaces, rounded geometry without sharp enterprise-box corners, strong readable typography, generous but not wasteful spacing, and very subtle purposeful motion.
- Chat uses an open conversational layout rather than putting every message in a large card. The composer is the main glass surface. Sidebars, dialogs, Settings, attachment surfaces, and pricing cards may use restrained glass when it improves hierarchy.
- Desktop keeps a steady left sidebar and centered workspace. Tablet and phone preserve the same capabilities with the sidebar becoming a drawer and Settings becoming an appropriate sheet/full-height surface. Horizontal overflow is forbidden.
- Loading, empty, error, disabled, installing, ready, removed, offline, and reconnecting states are part of the design and must be polished rather than treated as developer diagnostics.

## Phase 0 — Establish current truth and documentation

Rewrite every canonical Markdown authority to match this plan, the current repository, the live Supabase project, the owner’s latest Chat decisions, and the current screenshots. Record the exact source SHA, live Edge Function version, active schema/migration state, private Offline release identity, and known production failures. Do not change product code until the contradictions in documentation are removed.

The phase gate is that `PLAN.md`, `CLAUDE.md`, `docs/PRD.md`, `docs/TRD.md`, `docs/APP_FLOW.md`, `docs/ARCHITECTURE.md`, `docs/Backend Schema.md`, `docs/DECISIONS.md`, `docs/DESIGN.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/UI UX Brief.md`, `docs/UI_REFERENCE_CHECKLIST.md`, and `docs/MEMORY.md` all describe one product without contradictory auth, Offline, usage, UI, or Cowork rules.

## Phase 1 — Repair the live Chat authority

Trace the real production path from Supabase session through generation-permit claim, allowance verification, online routing, response streaming, settlement, message persistence, and conversation persistence. Reproduce the current allowance error before fixing it. Verify every required RPC/function signature against the live database and the generated types.

Deploy the exact current compatible `ocade-intelligence` source after tests pass. Prove a real signed-in message reaches Gemini through Supabase, streams a response, charges exactly one use, persists both turns, and survives refresh. Prove a failed request charges zero and a pre-output key/fallback attempt does not double-charge.

The phase gate is a real production Chat journey with no generic allowance failure and with source SHA, Edge version, migration state, and usage state recorded together.

## Phase 2 — Eliminate infinite loaders and dead controls

Convert every asynchronous customer surface to a bounded state machine: loading → success, empty, or error → Retry. Apply this to chat history, Billing allowance, Advanced sessions, Library, account actions, Offline preparation, entitlement reads, and any other reachable indefinite loader.

Remove stale controls or text that refer to deleted recovery codes, phone OTP, unsupported payment actions, or other dead systems. Do not keep a button merely because a test can click it.

The phase gate is a browser sweep proving that no reachable screen can remain indefinitely on a loading message and every interactive control has a real handler and truthful result.

## Phase 3 — Finish the complete Chat interaction contract

Implement and prove New Chat, generated title, rename, deletion confirmation, search, grouped recent history, Copy, Edit with branch regeneration from the edited point, Regenerate, Retry, Stop, temporary chat, individual export, contextual Share only when the real flow exists, drafts, duplicate-Send suppression, Markdown, tables, links, and code-copy.

Make the composer grow to a sensible maximum, preserve drafts across non-destructive navigation/failure, use Enter to send and Shift+Enter for newline, and keep controls compact. Thinking remains a small optional control beside the mode selector when the selected route can truthfully honor it.

The phase gate is a real production-build browser journey that performs every required action on desktop, tablet, and phone widths without stale state, duplicate messages, lost drafts, or console/runtime errors.

## Phase 4 — Finish attachments and hostile-file safety

Connect supported files to the actual intelligence request, not only to Library storage. Support multiple attachments, drag/drop, clipboard paste, upload progress, remove, retry, reorder, transcript preview/download, ownership validation, and source-linked answers.

Build one bounded ingestion authority that validates type and size, rejects unsafe archives and malformed structures, limits decompression/extraction, strips executable behavior, treats extracted text as untrusted data, and prevents cross-user object access. Use private Library storage and RLS rather than client trust.

The phase gate includes real benign files, malformed files, oversized files, archive-bomb-shaped fixtures, prompt-injection text, cross-user access attempts, and a real file that visibly influences the final answer.

## Phase 5 — Make `Auto | Online | Offline` one router

Create or consolidate one intelligence-routing authority. Auto prefers Online when connectivity and the online boundary are healthy, uses Offline when connectivity is absent and the local runtime is ready, and may fall back only before online output begins. Online never silently becomes Offline unless the user selected Auto. Manual Offline never sends provider traffic.

Disable the Online option when the browser is offline and give Auto a subtle Offline indication. Preserve the user’s prompt and current work during network changes.

The phase gate deliberately toggles connectivity and provider failure and proves the selected route, no double-output, no double-charge, and zero provider traffic in manual Offline mode.

## Phase 6 — Finish the private Offline Intelligence lifecycle

Use the owner-approved private release `ocr-2dc0ee44eb397906`, byte length `484220160`, and SHA-256 `2dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800`. The customer browser receives only authorized opaque OCADE delivery metadata and model bytes from private OCADE-controlled Cloudflare R2.

Finish automatic first-sign-in preparation, adaptive parallel download, bounded concurrency, resumable ranged transfer, checkpointing, expired-link refresh, full digest verification, targeted corruption repair, atomic activation, OPFS persistence, install-once reuse, explicit Remove, persistent `user_uninstalled`, explicit reinstall, and clear Ready/Installing/Repairing/Removed states.

A normal site deployment, browser restart, refresh, or sign-in cycle must not redownload a verified compatible release. Explicit uninstall must never be silently reversed.

The phase gate uses the real private object and proves first install, interrupted resume, restart recovery, targeted repair, update-without-redownload, Remove persistence, and explicit reinstall.

## Phase 7 — Prove WebGPU-first with WASM fallback

Use the existing single Offline artifact and single lifecycle. Prefer WebGPU only where the existing runtime genuinely supports the artifact and real generation succeeds. If WebGPU is unavailable or fails before output, fall back automatically to WASM without a second installer, second model authority, or second customer-visible product.

The phase gate runs real generation on a GPU-capable Chrome environment, forces the WebGPU failure path, proves WASM fallback, and records performance/memory observations. Capability detection alone is not proof.

## Phase 8 — Make disconnected conversations durable and idempotent

Use Supabase as the canonical saved-conversation authority while retaining only the minimum local pending-sync journal required for disconnected turns to survive the practical browser lifecycle. Every pending turn carries stable client ids/idempotency keys so reconnect synchronizes exactly once and repeated reconnects cannot duplicate content.

The phase gate covers airplane mode, multiple offline turns, refresh/reopen where the chosen browser storage permits, reconnect, repeated reconnect, conflicting remote updates, and exact-once settlement/sync.

## Phase 9 — Finish Usage & Limits, Billing, and upgrade surfaces

Add the dedicated Usage & Limits settings view and compact sidebar/composer indications. Show remaining uses, current 6h28m reset, weekly reset where applicable, current tier, and the exact rule that one successful logical generation consumes one use.

Keep the approved Free/Pro/Max policy: Free receives 28 uses per 6h28m with no weekly cap; Pro receives 140 per 6h28m and 700 per week; Max receives 1,400 per 6h28m and 7,000 per week. Manual Admin grants remain the current owner-access path until a payment provider is configured.

Billing must never spin forever. Upgrade cards remain useful even when checkout is externally unavailable; payment cannot queue or succeed offline.

The phase gate cross-checks sidebar, composer, Usage & Limits, Billing, and server-side allowance state against the same account in multiple browser contexts.

## Phase 10 — Rebuild Settings around working controls only

Finish Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced with compact rounded layouts, truthful empty/error states, and no dead recovery-code/phone/product remnants. Data Controls must provide account export, conversation/library deletion as specified, and Offline install/remove lifecycle without conflating model deletion with account deletion.

The phase gate opens and exercises every Settings control on representative desktop, tablet, and phone viewports and proves persistence or a truthful unavailable state.

## Phase 11 — Harden auth, Supabase, uploads, and abuse boundaries

Keep Supabase Auth as the only identity authority with Google and six-digit email OTP through the configured SMTP path. Phone OTP is removed. Prevent useful account enumeration, rapid OTP abuse, replay, malformed auth state, duplicate form submission, open redirects, entitlement tampering, cross-user Library access, and Admin escalation.

Use Supabase RLS and server-side authorization for all user-owned data. Review the live security and performance advisors, including auth-policy initialization, multiple permissive policies, and unused indexes, but do not drop an index or policy solely because an advisor labels it unused; trace real callers and expected production queries first.

The phase gate proves normal-user/admin isolation, RLS isolation, email-OTP truthfulness, abuse limits, and no secret/provider leakage to the browser.

## Phase 12 — Add web research through the existing Chat authority

After the core Chat and intelligence router are stable, add research/browsing as a bounded tool path inside the existing Chat request lifecycle. It must use the same auth, usage, cancellation, source-citation, safety, and persistence authorities and must not create a second Chat product.

The phase gate proves a sourced research answer, cancellation, tool failure, and no double-charge.

## Phase 13 — Perform the whole-product UI/UX and Ponytail cleanup

Refine the shell, Chat, Library, Settings, usage surfaces, pricing cards, loading states, Offline states, dialogs, and mobile behavior using the locked near-black rounded glass direction. Remove unnecessary cards, oversized empty panels, excessive borders, duplicate controls, developer diagnostics, and sharp corners.

Measure source LOC, source-file count, and dependency count before cleanup. Use `/ponytail ultra` to remove dead code, obsolete modules, duplicate helpers, stale feature remnants, unnecessary wrappers, repeated state, unreachable code, and unused dependencies while preserving security, accessibility, correctness, and tests. Reduce complexity rather than chasing a cosmetic LOC number.

The phase gate records before/after LOC and file/dependency counts, lists the meaningful dead systems removed, and reruns every relevant test/browser journey.

## Phase 14 — Certify the exact production release

Reread this entire plan against the final tree. Run `npm run verify:full`, production build, the complete browser journeys, Supabase type checks, secret/identity scans, RLS/security verification, and live smoke tests on the exact reconciled tree.

Prove Google login, email OTP, Chat, Gemini through the deployed Edge Function, exact usage decrement, attachments, Library, Settings, Offline install, no-Internet Chat, reconnect sync, WebGPU generation, forced WASM fallback, ordinary deployment with zero model redownload, explicit Remove persistence, and explicit reinstall. Test Windows Chrome and Android Chrome directly where available and the practical macOS/iPhone/iPad browser targets where available; record any hardware-only proof that remains external instead of fabricating it.

The repository-controlled Phase 14 verification has passed on the completed tree.

The Supabase Edge Function is deployed: `ocade-intelligence` on project `sazhgaisyhkdbrooycdv` is **version 7**, and its deployed source was read back and diffed byte-for-byte against this tree across all five files. Version 6 and its 1 MiB request cap, dropped attachments and missing grounded research are no longer in production.

The frontend Worker is not deployed. The reason was a stale deployment controller rather than a missing credential — it required the pre-launch gate header that Phase 2 removed from `cloudflare-entry.ts`, so every deployment failed validation before Wrangler ran. That is fixed and proven end to end against the real controller.

Production certification remains open on one owner-only action: run the **Cloudflare production deployment** workflow on `main` with `deploy_approval` = `I_APPROVE_OCADE_PRODUCTION_DEPLOY` and `rollback_version_id` = the `deploymentId` at `https://ocade.in/api/health`. The live smoke tests (Chat, usage, attachments, grounded research, Library, Settings) and the `/api/health` configuration check follow that deployment; they cannot be run from a session whose network egress to `ocade.in` and `*.supabase.co` is blocked.

## Mandatory final simplification and quality gate

At the last phase of this plan and immediately before the final integration/release when changes have occurred since the last review, keep `/ponytail ultra` and `/caveman ultra` active and run the available Ponytail final-review skills.

If Claude Code exposes the `anthropic-skills` namespace, use `/anthropic-skills:ponytail-review`, `/anthropic-skills:ponytail-audit`, `/anthropic-skills:ponytail-debt`, and `/anthropic-skills:ponytail-gain`. Otherwise use the upstream `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, and `/ponytail-gain` forms. Do not execute the same skill twice merely because two aliases point to the same implementation.

Use `ponytail-review` to inspect the current diff and remove valid over-engineering. Use `ponytail-audit` to inspect the whole repository for hidden bloat, duplicate authorities, unnecessary dependencies, and dead code. Use `ponytail-debt` to surface deliberate shortcuts and resolve any debt that blocks this plan. Use `ponytail-gain` only to record measured impact; never fabricate savings.

Fix valid findings as an elite production developer, rerun the affected tests and the full release verification, and proceed only when the simpler result remains secure, correct, accessible, maintainable, and production-safe.

## Progress-safety and checkpoint rule

Implementation occurs on an isolated working branch created from the latest plan-defined release target. After each phase passes its phase gate, update `docs/MEMORY.md`, create a descriptive checkpoint commit, push that branch, and verify the remote SHA. Never integrate an incomplete phase into the release target. Context reset, Auto Continue, or usage reset resumes from `docs/MEMORY.md` and the last verified checkpoint rather than restarting completed work.

The final integration uses the plan-approved non-destructive strategy only after the whole plan passes together on the reconciled tree. Do not assume a branch name or force shared history unless the owner explicitly defines that for a future mission.
