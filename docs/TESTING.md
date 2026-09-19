# OCADE Testing Authority

A capability is complete only when its real customer path is proven at the correct layer. Unit tests, a green build, a stubbed browser journey, and a live production smoke test are different evidence and must not be described as interchangeable.

## Core gates

Every phase runs the smallest relevant checks while implementing and the complete tracked verification at final release. At minimum use the current typecheck, lint, formatting, production build, route/reachability, bounded-read, dead-control, secret, model-identity, content-storage, Supabase-type, accessibility, unit/integration, database, and browser journey gates where applicable.

No new error/warning is dismissed merely because an earlier tree had warnings. A flaky test is reproduced and fixed at its root rather than normalized through reruns.

## P0 production proof

Before feature expansion, reproduce the current real “OCADE could not verify your usage allowance” failure and trace the exact live session → permit/RPC → intelligence → settlement → persistence chain. The repair is accepted only when a real signed-in production request reaches the deployed intelligence boundary, streams an answer, consumes exactly one use, persists the transcript, and survives refresh.

Verify the deployed `ocade-intelligence` function is the source intended by the final Git tree. Record function version, Git SHA, migration state, and generated types together.

## Async-state proof

Exercise Chat history, Billing allowance, Advanced sessions, Library, account actions, Offline preparation, Usage & Limits, and every other reachable async surface under success, empty, delayed, network-failure, permission-failure, and retry conditions. No test may accept an indefinite “Loading…” or “Reading…” state.

## Auth and authorization proof

Prove Google auth readiness, real email-OTP request/verify, generic enumeration-resistant responses, resend/rate limiting, stale/replayed challenge rejection, duplicate-submit protection, safe redirects, sign-out/session recovery, normal-user/Admin separation, and preservation of existing accounts.

Use Supabase RLS/server checks to prove cross-user isolation for conversations, messages, Library objects, entitlements, and privileged Admin operations.

## Chat proof

Prove New Chat without an empty DB row, first successful Send creating/persisting the conversation, generated title, rename, delete confirmation, search/grouped history, Copy, Edit, Regenerate, Retry, Stop, temporary chat, individual export, contextual Share only if real, Markdown/tables/links/code-copy, draft preservation, duplicate-Send suppression, Thinking, microphone dictation, and responsive composer behavior.

Test cancellation and failures during streaming. Edit/Regenerate must not accidentally stack duplicate answers or double-charge.

## Attachment/security proof

Use real supported files plus malformed, mismatched-MIME, oversized, archive-bomb-shaped, deeply nested, prompt-injection, cross-user, and unsupported fixtures. Prove bounded extraction, private storage, no execution, no cross-user fetch, upload progress/retry/remove/reorder/preview/download, and that a real attached document actually changes the intelligence answer with useful source references.

## Usage proof

Prove Free/Pro/Max exact limits, reset windows, weekly caps, one-success=one-use, failed=zero, internal retry/failover=zero extra, duplicate clicks/tabs/idempotency, Edit→success and Regenerate→success accounting, exhaustion behavior, sidebar/composer/Usage & Limits/Billing consistency, and account-wide state across multiple browser contexts.

## Online intelligence proof

Use the real Edge Function to prove JWT verification, allowed-origin behavior, the configured primary path, bounded pre-output failover, sanitized provider errors, no client key leakage, attachment forwarding, output limits, and no failover after output begins.

## Offline installation and inference proof

Use the real private release `ocr-2dc0ee44eb397906` and verify authorized R2 delivery, exact byte length/full SHA, adaptive parallel transfer, interruption/resume, browser restart recovery, expired authorization refresh, corruption-targeted repair, OPFS persistence, compatible site update with zero redownload, explicit Remove suppression, explicit reinstall, and real Offline generation.

On supported GPU hardware, prove real WebGPU generation. Force the pre-output WebGPU failure path and prove automatic WASM fallback using the same artifact/lifecycle. Capability detection alone does not pass this gate.

## Offline conversation/sync proof

Enter airplane mode, create multiple Offline turns, preserve pending work through the intended browser lifecycle, reconnect, and prove exact-once Supabase synchronization. Repeat reconnect and refresh to prove no duplicate messages, duplicate usage events, or silent loss. Manual Offline must show zero provider traffic.

## Settings and UI proof

Exercise every Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced control on desktop, tablet, and phone widths. Verify rounded layout, no horizontal overflow, visible keyboard focus, accessible labels, reduced-motion behavior, touch targets, truthful unavailable states, and absence of stale recovery-code/phone/dead-system UI.

## Performance and Supabase proof

Run realistic bounded-read/load scenarios for conversation history, Library, settings, usage, and file metadata. Review Supabase security/performance advisors after migrations. Investigate auth-RLS initialization, multiple permissive policies, and unused-index findings against real workloads before changing policies/indexes.

## Final release gate

Reread `PLAN.md` against the exact reconciled tree. Run `npm run verify:full`, build and all relevant browser journeys, then smoke-test the actual deployed release. Record what was live versus simulated.

Final evidence must include the remote Git SHA, deployed frontend version/build, active Edge Function version/source, applied migration state, generated types state, Offline release id/hash, real Online answer, exact usage decrement, attachment-to-answer proof, Offline answer, WebGPU/WASM proof where hardware is available, no-redownload update proof, Remove/reinstall proof, Library isolation, auth recovery, and every genuine external blocker. Only the exact verified tree may fast-forward to `main` without force.

## Final adversarial QA protocol

After the entire active plan is implemented, run a separate tester-style validation pass whose purpose is to expose defects rather than confirm success. Exercise the application through isolated browser sessions as a real user would, deliberately switch accounts, conversations, modes, devices, connectivity states, and storage states during in-flight work, and verify that stale async results can never cross account, conversation, request, or device boundaries.

Run unit, integration, regression, end-to-end browser, malformed-input, property/fuzz, concurrency/race, failure-injection, auth/session isolation, cross-account data isolation, database/RLS permission, provider/network failure, online/offline transition, reconnect, storage-loss, multi-device, responsive, accessibility, deployment-parity, and AI-behavior evaluation coverage. Maintain hard invariants such as “Account A can never observe Account B data,” “one successful logical generation consumes exactly one use,” “failed generations consume zero,” “temporary data is not durably persisted unless explicitly requested,” and “a verified installed offline release is not redownloaded by an ordinary deployment.”

Do not let mocks or stubs stand in for final proof when a safe real integration boundary is available. Classify evidence as proven, code-verified, simulated, or externally unverified. GitHub Actions is optional because paid Actions availability is not assumed; run equivalent required verification in a trusted local or agent environment instead of skipping it.

When failures are found, reproduce them deterministically, fix the root cause, add a regression test, and rerun the smallest relevant test first before the broader gate. After all correctness gates are green, simplify safely with YAGNI/KISS without weakening coverage.

## Audit-remediation proof matrix

The active 15-finding remediation phases require explicit coverage for HTTP-to-HTTPS enforcement, rejected direct revocation-column updates, concurrent final-slot device registration, MFA-backed admin grants, server-side account search beyond the newest 200 profiles, account/conversation switches during permit acquisition, partial Regenerate failure, visible-output persistence failure, preservation of Thinking/Research options on Regenerate, truthful Offline synchronization copy, forced uninstall deletion failure, 360–375 px public-navigation and Settings layouts, Help account-deletion routing, and noindex metadata for non-public surfaces.

The final writable browser pass must exercise real Online, Auto, and Offline generation plus state-changing customer flows in a disposable environment. Read-only inspection is not accepted as proof for a behavior that requires mutation.
