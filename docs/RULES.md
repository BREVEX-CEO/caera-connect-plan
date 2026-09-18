# OCADE Non-Negotiable Rules

- `PLAN.md` is the active implementation plan for the current mission. Older plans and audits are historical evidence and may not override the latest owner-approved decisions.
- Every implementation, debugging, cleanup, review, resumed, and release session uses `/ponytail ultra` and `/caveman ultra`, confirms both are active, and keeps them active through the task.
- Caveman Ultra keeps chat output short, direct, low-token, and written in complete sentences. Do not waste tokens on repeated summaries or narration when the work can be done instead.
- Ponytail Ultra keeps implementation small and direct. Apply YAGNI and KISS, challenge unnecessary features, reuse existing code, prefer stdlib/native/platform APIs and installed dependencies, and delete safe dead code before adding machinery.
- Act as an elite production developer. When something fails, trace, reproduce, fix the root cause, test the regression, deliberately test failure, browser-prove the customer path, simplify the result, and continue without asking the owner for help unless the remaining action is genuinely owner-only or externally inaccessible.
- Keep one canonical authority per responsibility. Do not create duplicate routers, intelligence engines, usage gates, installers, manifests, stores, auth flows, attachment pipelines, entitlement resolvers, billing authorities, admin grant systems, synchronization engines, or UI state machines.
- Never sacrifice security, correctness, accessibility, validation, reliability, data integrity, or truthful behavior merely to reduce line count. Fewer lines are preferred only when the final system remains safer and easier to maintain.
- Cowork/Jarvis expansion is frozen until the Chat-first plan is complete and the owner explicitly starts a future mission.
- `/` is Chat. Signed-out visitors may inspect the shell, but Send requires authentication.
- Supabase Auth is the only identity authority. Google and six-digit email OTP are the active methods; phone OTP is removed. Existing users, identities, sessions, and refresh tokens are protected during cleanup.
- Online intelligence uses the single Supabase `ocade-intelligence` boundary. Configured provider secrets stay server-side. Secret values never enter client code, normal tables, logs, exports, or chat.
- Normal customer identity is always OCADE. Do not expose provider, model, WebGPU/WASM, artifact-format, key, internal endpoint, or vendor terminology in ordinary UI, answers, or errors.
- The customer selector is `Auto | Online | Offline`. Auto uses Online when healthy, uses Offline when disconnected and ready, and may fall back only before online output. Online is disabled without Internet. Manual Offline sends zero provider traffic.
- Thinking is shown only on a route that can truthfully honor it. The approved Offline artifact has passed the real Thinking proof; do not expose a no-op Thinking control on routes whose boundary has no matching parameter.
- One successful logical request equals one use. Failures equal zero. Internal retries, duplicate clicks, key failover, and pre-output Online→Offline fallback do not create extra uses.
- Free = 28 per 6h28m with no weekly cap. Pro = 140 per 6h28m and 700/week. Max = 1,400 per 6h28m and 7,000/week. Usage is account-wide across Online and Offline.
- New Chat must not create an empty durable conversation. The first accepted and persisted Send creates it.
- Chat must provide the locked controls and behavior in `PRD.md`, including generated titles, search/history, Copy/Edit/Delete, Regenerate, Retry, Stop, temporary chat, export, Markdown/tables/links/code, attachments, dictation, Thinking where truthful, and duplicate-Send protection.
- Uploaded files are hostile input. Validate ownership, type, size, archives, extraction and parser bounds; never execute them; never treat document text as privileged instructions; preserve source metadata for citations where practical.
- Supported attachments may be up to 100 MB each subject to a bounded total-message limit. Unsafe, unsupported, or malformed files fail closed with a short customer-safe error.
- The approved private Offline release is `ocr-2dc0ee44eb397906`, `484220160` bytes, SHA-256 `2dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800`. Use one installer, one manifest authority, one downloader, and one lifecycle.
- Offline preparation begins automatically after first successful sign-in unless the user previously chose Remove. A compatible verified installation must survive deployments, refreshes, restarts, and sign-in cycles without redownload.
- Explicit Offline Remove persists and blocks automatic reinstall until the customer explicitly chooses Install Offline.
- WebGPU is preferred only after real generation proof on supported hardware. WASM is the fallback before output. Do not create a second customer-visible model/runtime authority merely to satisfy this requirement.
- Offline conversations synchronize to Supabase exactly once after connectivity returns. Local pending state is minimal, idempotent, and non-canonical after reconciliation. Temporary/incognito Chat never synchronizes.
- Every reachable asynchronous UI state must terminate in success, empty, error/Retry, cancelled, or genuine progress. Infinite “Loading…” or “Reading…” is a bug.
- Settings contains Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced. Remove stale recovery-code, phone, or other dead-system copy and controls.
- Pricing and Billing must remain honest while payment-provider onboarding is deferred. Payment never queues or succeeds offline and unavailable checkout must not be faked.
- The permanent owner/admin authority is the audited role/grant system. Normal users must not be able to reach privileged Admin behavior or self-grant entitlements.
- Supabase PostgreSQL and private Storage remain canonical for saved account content after synchronization. RLS and server authorization must enforce ownership; never trust client-provided user id, tier, usage, file ownership, admin status, or payment state.
- Schema cleanup must preserve real auth, customer, financial, legal, security, and entitlement evidence. Trace callers before dropping tables, functions, policies, indexes, buckets, or migrations.
- The visual authority is near-black/charcoal with neutral grey/white, restrained medium glassmorphism, rounded corners, minimal borders, clear typography, and subtle purposeful motion. Avoid sharp boxes, card walls, cinematic scenes, and developer-dashboard clutter.
- Before adding code, ask whether the behavior needs to exist, whether the repository already solves it, whether stdlib/native APIs solve it, and whether an installed dependency already solves it. If one clear line is correct, do not create twenty lines of wrappers around it.
- Delete dead code, unreachable code, obsolete files, unused exports, unused dependencies, stale feature flags, repeated state, unnecessary compatibility layers, and safe near-duplicates after proving they are unused.
- Avoid premature abstractions. Abstract only when repeated real behavior proves it reduces complexity. Prefer clear direct code over clever code.
- Reduce unnecessary state, network calls, database queries, renders, dependencies, storage authorities, and indirection. Prefer native accessible controls instead of recreating reliable platform primitives.
- Reproduce bugs before fixing them, add the smallest useful regression coverage, deliberately test failure and recovery, and browser-prove real customer journeys.
- After every meaningful change, verify that the simplest final architecture still works end-to-end.

## Mandatory final Ponytail gate

At the last phase of any plan, and immediately before a release, merge, or equivalent integration step when changes have occurred since the previous review, run the available Ponytail review set and fix valid findings before proceeding.

When the host exposes the `anthropic-skills` namespace, use `/anthropic-skills:ponytail-review`, `/anthropic-skills:ponytail-audit`, `/anthropic-skills:ponytail-debt`, and `/anthropic-skills:ponytail-gain`. Otherwise use `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, and `/ponytail-gain`. Do not execute the same skill twice merely because two aliases point to the same implementation.

Use `ponytail-review` to inspect the current diff and remove valid over-engineering. Use `ponytail-audit` to inspect the whole repository for hidden bloat, duplicate authorities, unnecessary dependencies, and dead code. Use `ponytail-debt` to surface intentional shortcuts and resolve debt that blocks the current plan. Use `ponytail-gain` only for measured impact; never invent savings.

After fixing valid findings, rerun the affected tests and the complete plan-defined release verification. Proceed only when the simpler result remains secure, correct, accessible, maintainable, and production-proven.

## Universal Git and release rule

Use the working branch and release target defined by the current plan or owner request. Do not assume a branch named `main`, do not force shared history merely for convenience, and do not integrate a partial phase into the release target. Reconcile the latest target, verify the exact reconciled tree, run the final Ponytail gate, deploy the matching release, and run live smoke tests where the environment permits.

## Mandatory implementation and completion rules

Start implementation work with `/ponytail ultra` and `/caveman ultra` active. Reproduce a defect before fixing it, repair the root cause, and add a regression test that would have failed on the old behavior. Use one canonical authority per responsibility and do not introduce a second router, installer, session authority, usage authority, deployment authority, or storage authority when the existing one can be repaired.

After every requirement in `PLAN.md` is complete, run a separate adversarial enterprise-grade AI-platform QA pass. The tester pass must act like an independent hostile user and must cover unit, integration, regression, browser/E2E, malformed-input, property/fuzz, concurrency/race, failure-injection, auth/session isolation, cross-account privacy invariants, database/RLS permissions, provider and network failures, online/offline transitions, reconnect, storage loss, multi-device behavior, accessibility, responsive layouts, deployment parity, and AI-behavior evaluations. Real boundaries take precedence over stubs when they are safely available. Do not claim real-device, GPU, provider, or production proof unless it was actually executed.

GitHub Actions is optional because paid Actions availability is not assumed. Its unavailability is not permission to skip verification. Run equivalent required tests in a trusted local or agent environment and use the existing direct Cloudflare and Supabase release paths where appropriate.

After correctness and safety are proven, apply a Ponytail/YAGNI/KISS debloat pass. Prefer deleting unnecessary code over adding abstractions. Remove dead code, duplicate implementations, unused exports, stale configuration, obsolete compatibility layers, historical comments that no longer explain an invariant, and unnecessary dependencies only when removal is proven safe. Fewer maintained lines and fewer moving parts are preferred because they reduce the bug surface and make OCADE easier to maintain. Never reduce LOC by deleting required tests, security checks, validation, accessibility behavior, or reliability safeguards.
