**26 defects: 1 Critical, 16 Major, 7 Medium, 2 Minor.**

## Findings

1. **Critical — Cross-account transcript exposure**
   - **File/function:** `src/lib/chat/use-chat.ts::useChat`; `src/routes/__root.tsx::BrowserBootstrap`; `src/components/shell/AppShell.tsx::signOut`.
   - **Bug/root:** Sign-out clears conversation listings and unsynced turns, but not `conversationId`, `messages`, streaming text, abort controller, or pending reads. `useChat` survives account changes.
   - **Prove/impact:** Sign out with a transcript open, then sign in as another account in the same tab. Account A’s text can remain visible or be restored by a late read. Privacy boundary failure.
   - **Fix:** Abort all work and atomically clear chat state on `user.id` change; key every async result to account and conversation; remount account-owned state.
   - **Status:** **Code-proven**; destructive live account-switch test not performed.
2. **Major — Auth 5xx incorrectly trusts cached session**
   - **Files/functions:** `src/lib/auth/session-failure.ts::classifyAuthFailure`; `src/routes/_authenticated/route.tsx::beforeLoad`.
   - **Bug/root:** Error name containing `retryable` is accepted before nonzero HTTP status. Supabase 2.110.7 emits `AuthRetryableFetchError` for 500–530 with the real status.
   - **Prove/impact:** Pass `{name:"AuthRetryableFetchError",status:503}`; `mayUseCachedSession()` returns true, contradicting its fail-closed contract. Revoked sessions can enter protected client UI during upstream failures, although server functions still re-authenticate.
   - **Fix:** Test explicit nonzero status first; cached fallback only for status `0`/genuine no-response fetch failures. Add status/error-shape matrix tests.
   - **Status:** **Code and dependency-source proven.**
3. **Major — Current question sent to the model twice**
   - **File/function:** `src/lib/chat/use-chat.ts::send`.
   - **Bug/root:** `setMessages([...question])` synchronously updates `transcript.current`; `turns` then appends `question.record` again.
   - **Prove/impact:** Inspect outbound `messages`: the latest user prompt appears twice, distorting responses and token use.
   - **Fix:** Build history from the updated transcript once, or snapshot prior turns and append once. Assert exact role/content sequence at the intelligence boundary.
   - **Status:** **Code-proven.**
4. **Major — Regenerate/Edit/Retry deletes data before permission**
   - **File/function:** `src/lib/chat/use-chat.ts::resend`.
   - **Bug/root:** UI and persisted tail are deleted before `send()` requests a usage permit; refusal result is ignored.
   - **Prove/impact:** Exhaust allowance, then Regenerate/Edit. Original question and later turns disappear without replacement.
   - **Fix:** Acquire permit before deletion or perform a transactional branch replacement with rollback; propagate refusal and deletion failures.
   - **Status:** **Code-proven.**
5. **Major — In-flight answers bleed across conversations/modes**
   - **Files/functions:** `use-chat.ts::send/openConversation/newConversation/setTemporaryChat/removeMessage`; `ChatWorkspace`.
   - **Bug/root:** Navigation, Temporary, New chat, Delete, and sidebar actions remain available during generation. Stream and completion state are global, not request/conversation scoped.
   - **Prove/impact:** Start delayed generation, switch conversation or Temporary mode; old tokens/answer can appear in the new transcript or become orphaned.
   - **Fix:** Bind updates to `{accountId, conversationId, requestId}`; abort/settle before switching; ignore stale events; disable destructive transitions while busy.
   - **Status:** **Code-proven race.**
6. **Major — Message deletion can falsely claim success**
   - **File/function:** `src/lib/chat/use-chat.ts::removeMessage`.
   - **Bug/root:** UI removes immediately and `.catch(() => undefined)` swallows database failure.
   - **Prove/impact:** Inject network/RLS failure, delete, reload: supposedly deleted private text returns because it never left Supabase.
   - **Fix:** Await deletion before committing UI state, or rollback and show an actionable error.
   - **Status:** **Code-proven.**
7. **Major — Temporary attachments are permanently saved**
   - **File/function:** `src/components/chat/ChatWorkspace.tsx::attach`.
   - **Bug/root:** Every readable attachment calls `addLibraryItem`; Temporary mode is never checked.
   - **Prove/impact:** Enable Temporary, attach a file, then inspect Library. The transcript is memory-only but the file persists account-wide.
   - **Fix:** Never write attachments to Library in Temporary mode unless separately and explicitly requested.
   - **Status:** **Code-proven privacy breach.**
8. **Major — Retry/Edit/Regenerate silently loses attachments**
   - **Files/functions:** `use-chat.ts::resend`; `ChatWorkspace::send`.
   - **Bug/root:** Stored messages retain metadata only. Resend calls `send(text, choice)` without original bytes/text.
   - **Prove/impact:** Ask about a file, then Regenerate or Retry. The second request has no attachment but appears to repeat the original question.
   - **Fix:** Retain a secure request-scoped attachment reference/content and resend it; otherwise explicitly say the file must be reattached.
   - **Status:** **Code-proven.**
9. **Major — Chat concurrency guard activates too late**
   - **File/function:** `src/lib/chat/use-chat.ts::send/resend`.
   - **Bug/root:** `busy` is tested before `await beginBilledRequest()`, but set only afterward. Multiple callers can enter the six-second permit window with separate UUIDs.
   - **Prove/impact:** Invoke send/resend twice before permit resolution; two valid permits and generations can result.
   - **Fix:** Acquire a synchronous ref/mutex before the first await and use one stable logical idempotency key.
   - **Status:** **Code-proven concurrency window; browser double-action not executed.**
10. **Major — Failed settlement is never retried**
    - **File/function:** `src/lib/commercial/use-generation-permit.ts::createBilledRequest.settle`.
    - **Bug/root:** `settled=true` is set before network settlement; errors are swallowed. Every later retry is a no-op.
    - **Prove/impact:** Drop the network during finalize/release. Delivered answers may later be undercounted, or empty reservations remain held until expiry.
    - **Fix:** Durable idempotent settlement outbox/retry; mark locally settled only after confirmed server acceptance; expose operational telemetry.
    - **Status:** **Code-proven.**
11. **Major — Offline inference is single-threaded on the actual Chat document**
    - **Files/functions:** `src/lib/security/isolation.ts::ISOLATED_PATH_PREFIXES`; `src/lib/brain/wasm-threads.ts`; Cloudflare headers.
    - **Bug/root:** Only `/ocade` receives COOP/COEP, but `/ocade` is deliberately 404. Real Chat is `/`.
    - **Prove/impact:** Live `/` reported `crossOriginIsolated=false`, no `SharedArrayBuffer`, on an eight-core browser. `/ocade` returned 404 with isolation headers.
    - **Fix:** Isolate the real inference document or build a genuine isolated inference host document/worker with same-origin storage and full-navigation bridging.
    - **Status:** **Live test-proven and code-proven.**
12. **Major — Device cap has no recovery UI**
    - **Files/functions:** `device-identity.ts::ensureCurrentDeviceIdentity`; `UsageSection::OfflineRow`; SQL RPC `revoke_device_for_current_user`.
    - **Bug/root:** Revocation RPC exists, but no product screen invokes it.
    - **Prove/impact:** Live signed-in browser was at the device cap and correctly said Offline cannot work there, but offered no device list or removal action.
    - **Fix:** Add account device management with current-device marker, confirmation, revoke, stale-slot reclamation, and three-browser tests.
    - **Status:** **Live test-proven and code-proven.**
13. **Major — Partial device registration can permanently consume a slot**
    - **File/function:** `src/lib/commercial/device-identity.ts::registerCurrentDevice`.
    - **Bug/root:** Device insert and browser-grant insert are separate. Cleanup deletion’s returned error is ignored.
    - **Prove/impact:** Fail grant insert and cleanup delete; an orphan device remains and counts toward the cap.
    - **Fix:** One transactional security-definer registration RPC, or strictly verify compensating deletion and queue repair.
    - **Status:** **Code-proven failure path.**
14. **Major — Paid offline allowance can remain stranded for a week**
    - **Files/functions:** `offline-allowance.ts::syncOfflineAllowance`; SQL `ocade_return_offline_usage`.
    - **Bug/root:** Return RPC has no production caller. Free expires with its session; paid weekly capacity remains held.
    - **Prove/impact:** Allocate a weekly block, leave it mostly unused, revoke/abandon device: account cannot reuse the remainder until reset.
    - **Fix:** Idempotent final settlement with reconciliation watermark and safe late-event handling; invoke on revoke/lease closure.
    - **Status:** **Repository-recorded and code-proven; paid production trigger not active.**
15. **Major — First OTP sign-in can leave Offline Intelligence permanently failed until reload**
    - **Files/functions:** `use-installation.ts::useInstallationBootstrap`; `installation-browser.ts::resolveInstallTarget`; `auth.verify.tsx::verify`.
    - **Bug/root:** Bootstrap runs while signed out; authenticated release lookup fails and produces `fatal_error`. Client-side OTP navigation does not rerun bootstrap.
    - **Prove/impact:** Fresh signed-out tab → bootstrap → email OTP → SPA navigation. No install retry occurs; Settings offers no useful retry for this fatal state.
    - **Fix:** Restart installation on authenticated account transition; classify unauthenticated release lookup as waiting-for-session, not fatal.
    - **Status:** **Code-proven sequence; live OTP mutation not performed.**
16. **Major — Production is behind current source**
    - **Files/functions:** `src/routeTree.gen.ts`; `src/lib/launch/prelaunch-response.ts`; Cloudflare deployment.
    - **Bug/root:** Current source defines public routes, but production does not serve them.
    - **Prove/impact:** Live 404s: `/company`, `/founder/haans-antoni`, `/products/ocade`, `/compare`, `/blog`, `/careers`, `/team`, `/press`, `/status`, `/security`, `/faq`, `/search`. Current source contains these routes.
    - **Fix:** Deploy one reconciled commit; publish Git SHA/deployment tag; run route matrix against that exact deployment.
    - **Status:** **Live test-proven deployment drift.**
17. **Major —** **`www`** **is a second production origin**
    - **Files/functions:** `wrangler.json::routes`; `src/cloudflare-entry.ts::fetch`.
    - **Bug/root:** Both hosts serve 200; no canonical-host redirect.
    - **Prove/impact:** `www.ocade.in` and `ocade.in` have separate auth, localStorage, IndexedDB, OPFS and service workers—potentially two model downloads and split sessions.
    - **Fix:** 308 redirect `www` to apex before assets/Nitro, preserving path/query.
    - **Status:** **Live and code-proven.**
18. **Medium — Settings says Offline is both Ready and unavailable**
    - **Files/functions:** `DataControlsSection::OfflineIntelligenceSection`; `UsageSection::OfflineRow`.
    - **Bug/root:** Model lifecycle and device/lease eligibility are independent UI authorities.
    - **Prove/impact:** Live Settings simultaneously showed “Ready” and “cannot do that in this browser.”
    - **Fix:** One composite readiness model: artifact + runtime + device registration + usable signed lease.
    - **Status:** **Live test-proven.**
19. **Medium — Device-registration error leaks across account transitions**
    - **File/function:** `device-identity.ts::problem/publish`.
    - **Bug/root:** Module-global problem state is not keyed by account and is not reset on sign-out.
    - **Prove/impact:** Account B can temporarily inherit Account A’s `device_limit` state if refresh fails or has not run.
    - **Fix:** Store status per account/browser identity and clear it during auth transition.
    - **Status:** **Code-proven; account-switch display not live-tested.**
20. **Medium — Browsers without Web Locks silently lose offline allocation**
    - **File/function:** `device-identity.ts::ensureCurrentDeviceIdentity`.
    - **Bug/root:** `!navigator.locks` returns `null` without publishing `unavailable` or using another lock.
    - **Prove/impact:** Unsupported/restricted browser never registers, while model UI can still report Ready.
    - **Fix:** Implement a transactional server-side fallback or explicit unsupported state.
    - **Status:** **Code-proven; real-browser coverage unverified.**
21. **Medium — Sitemap authority disagrees with reachable pages**
    - **File/function:** `src/routes/sitemap[.]xml.ts::PUBLIC_PATHS`.
    - **Bug/root:** Sitemap lists the 12 live 404 routes, derives hostname from the request—creating a `www` sitemap—and omits current public authorities such as `/about` and `/support`.
    - **Prove/impact:** Crawlers receive dead/cross-origin canonical URLs.
    - **Fix:** Generate sitemap from a canonical deploy-tested route manifest with apex origin.
    - **Status:** **Live and code-proven.**
22. **Medium — Release documentation contradicts itself**
    - **Files:** `PLAN.md`; `docs/ARCHITECTURE.md`; `docs/MEMORY.md`.
    - **Bug/root:** PLAN top says Edge v6/old frontend; Phase 14 says v7/new frontend. Architecture still calls v6 live.
    - **Prove/impact:** Operators cannot determine what must be deployed and may repeat or skip a production release.
    - **Fix:** One generated release-state record tied to deployed SHA/function version; remove stale prose.
    - **Status:** **Confirmed source contradiction.**
23. **Medium — CSP leaves broad exfiltration capability**
    - **File/function:** `src/lib/security/public-response.ts::APP_CSP`.
    - **Bug/root:** `script-src` permits `'unsafe-inline'`; `connect-src` permits every HTTPS/WSS destination.
    - **Prove/impact:** No XSS was found, but any future injection bypasses most CSP protection and can transmit data to arbitrary HTTPS hosts.
    - **Fix:** Nonces/hashes for hydration, remove unsafe inline script, and allowlist exact Supabase/provider/analytics hosts.
    - **Status:** **Configuration proven; exploitability contingent/suspected.**
24. **Medium — Conversation metadata mutations have no rollback**
    - **File/function:** `use-chat.ts::rename/setArchived/trash`.
    - **Bug/root:** Optimistic UI is committed before awaited backend mutation; failures do not restore state.
    - **Prove/impact:** Network/RLS failure shows renamed/archived/deleted state until refresh, misleading users.
    - **Fix:** Mutation state with rollback and visible error; reload authoritative row after failure.
    - **Status:** **Code-proven.**
25. **Minor — Permit timeout leaves timers alive**
    - **File/function:** `use-generation-permit.ts::withTimeout`.
    - **Bug/root:** `Promise.race` timer is not cancelled when acquisition resolves early.
    - **Prove/impact:** Every request retains a timer/closure for six seconds; bursts create avoidable transient memory and scheduling work.
    - **Fix:** Store timer handle and clear it in `finally`.
    - **Status:** **Code-proven.**
26. **Minor — Dead installation telemetry**
    - **File:** `src/lib/brain/install-telemetry.ts`.
    - **Bug/root:** Sixty-event ring/listener set has no reader or subscriber.
    - **Prove/impact:** Permanent memory and maintenance surface with no operational value.
    - **Fix:** Wire it into diagnostics or delete it after offline lifecycle verification.
    - **Status:** **Code-proven dead code.**

## Weak, vacuous, or incomplete tests

- `scripts/e2e/online-journey.mjs` records permits, attachments and system prompts, but not the exact user-message sequence; finding 3 passes unnoticed.
- `scripts/e2e/chat-journey.mjs` proves Temporary does not create a sidebar conversation, but never checks Library; finding 7 passes.
- Its Delete check observes DOM only—no backend failure/reload—so finding 6 passes.
- Regenerate covers success only; no exhausted allowance/provider refusal after deletion, so finding 4 passes.
- `scripts/e2e/shell-journey.mjs` celebrates `/ocade` returning 404 and never requires the real Chat document to be isolated.
- `every-ai-surface-is-gated.test.ts` largely asserts source text/order; dead or unreachable code can satisfy it.
- No focused tests cover `session-failure.ts` with Supabase retryable 503 errors.
- No concurrent double-send, conversation-switch-during-stream, account-switch transcript, canonical-host, or production sitemap route test exists.
- Usage/device journeys primarily use the local Supabase stub; they are not live RLS or multi-device proof.
- Repository-recorded test totals were **not** treated as current passes.

## Confirmed working

- [Live health](https://ocade.in/api/health) returned 200, `no-store`, and all four configuration-presence flags were true.
- `/`, `/auth`, `/about`, `/pricing`, `/privacy`, and `/terms` returned 200.
- Mobile 375×812 had no horizontal overflow; drawer navigation worked.
- Service worker controlled the live page.
- Supabase endpoints rejected requests without an API key.
- Live Settings exposed usage count, device-cap refusal, installed-model state, and explicit Remove.
- HTML model output remains escaped through `react-markdown`; no raw-HTML renderer was found.
- Current SQL contains extensive RLS/RPC verification and rollback material, but live execution was not claimed.

## Still unverified

Strict zero-write rules prevented running current `verify:full`, Vitest, build, local E2E, PostgreSQL twins, or bundle scans because they create output/cache/database artifacts.

Also unverified:

- Real Gemini generation, research grounding and provider failure injection.
- Live Edge Function source/version parity.
- Actual Offline generation, 484 MB+ artifact transfer, digest, resume, repair, WebGPU and forced WASM.
- Offline→online event reconciliation and storage-loss recovery.
- Real multi-device revocation and late offline settlement.
- Cross-account live RLS mutation tests.
- OTP/Google/MFA account lifecycle.
- Android Chrome, Windows Chrome GPU, macOS Safari, iPhone/iPad.
- Paid checkout/webhooks and production billing.
- Sustained load, memory profiling and provider concurrency.
- Deployed Git SHA: health exposes a Cloudflare deployment UUID, not a source commit tag.

## Exact fix order

1. **F1–F2:** Close account/session privacy boundary.
2. **F3–F10:** Repair chat request identity, resend semantics, attachments and billing settlement.
3. **F11:** Move isolation to the real inference document.
4. **F12–F15:** Finish device lifecycle, offline allocation return and authenticated install recovery.
5. **F16–F17:** Deploy one reconciled artifact and canonicalize the host.
6. **F18–F21:** Unify Offline state and repair route/sitemap truth.
7. **F22–F24:** Reconcile operational authority, harden CSP and mutation rollback.
8. **F25–F26:** Remove timer/dead-code debt.
9. Add the missing adversarial tests above, then run the full local/database/browser suite in a disposable writable checkout.
10. Only afterward certify live Gemini, Supabase RLS, Cloudflare, GPU/offline and real-device behavior.

## Mandatory completion protocol

Treat every unresolved finding above as active work and fix it in the stated order unless direct evidence proves that a finding no longer applies. Reproduce each defect before changing the implementation, fix the root cause instead of masking the symptom, add or strengthen regression coverage, and preserve security, privacy, usage-accounting, offline-integrity, accessibility, and deployment invariants.

After the entire plan is complete, run a separate enterprise-grade AI-platform quality pass designed to break the product rather than merely confirm happy paths. Use isolated tester-style browser journeys, unit and integration tests, regression tests for every historical defect, malformed-input and property/fuzz testing where appropriate, concurrency and race testing, failure injection, auth and cross-account isolation checks, database and RLS permission checks, provider and network failure checks, online/offline transitions, storage-loss and reconnect checks, multi-device checks, responsive and accessibility checks, deployment parity checks, and AI-behavior evaluations. Never claim hardware, real-device, provider, GPU, or production proof that was not actually performed.

GitHub Actions is optional and must never block completion because paid Actions availability is not assumed. Run the required verification in a trusted local or agent environment and use the existing direct Cloudflare and Supabase authorities where appropriate. Do not weaken tests, security, or release gates merely because remote Actions is unavailable.

After correctness is proven, apply `/ponytail ultra` and strict YAGNI/KISS debloating. Prefer deletion, reuse, one canonical authority, native platform capabilities, and fewer maintained lines over new wrappers or abstractions. Remove dead code, duplicated logic, stale compatibility paths, obsolete comments, unused exports, dead configuration, and unnecessary dependencies only when their removal is proven safe. Report before/after maintained line counts and keep tests and security controls intact.

---

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

The frontend Worker is deployed. Cloudflare builds and deploys `ocade-web` from `main` on every push, and the live Worker bundle was read back and contains this tree's markers: the `supabaseServer`/`modelDelivery`/`offlineLeases` health configuration, `Usage & Limits`, `thinkingSuitable`, release `ocr-2dc0ee44eb397906` and grounded `research`. The pre-Phase-1 build is gone.

Separately, `npm run deploy:web` had been refusing every deployment on any machine with any credential: it required the pre-launch gate header that Phase 2 removed from `cloudflare-entry.ts`. That is fixed and proven end to end against the real controller. Because Cloudflare already deploys `main`, the owner should decide whether that controller and `cloudflare-production.yml` remain a second deployment authority at all.

Production certification remains open on live evidence only, and that evidence cannot be gathered from a session whose network egress to `ocade.in` and `*.supabase.co` is blocked: read `https://ocade.in/api/health` and confirm `supabasePublic`, `supabaseServer`, `modelDelivery` and `offlineLeases` are all true, then run the live Chat, usage, attachment, grounded research, Library and Settings journeys.

## Mandatory final simplification and quality gate

At the last phase of this plan and immediately before the final integration/release when changes have occurred since the last review, keep `/ponytail ultra` and `/caveman ultra` active and run the available Ponytail final-review skills.

If Claude Code exposes the `anthropic-skills` namespace, use `/anthropic-skills:ponytail-review`, `/anthropic-skills:ponytail-audit`, `/anthropic-skills:ponytail-debt`, and `/anthropic-skills:ponytail-gain`. Otherwise use the upstream `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, and `/ponytail-gain` forms. Do not execute the same skill twice merely because two aliases point to the same implementation.

Use `ponytail-review` to inspect the current diff and remove valid over-engineering. Use `ponytail-audit` to inspect the whole repository for hidden bloat, duplicate authorities, unnecessary dependencies, and dead code. Use `ponytail-debt` to surface deliberate shortcuts and resolve any debt that blocks this plan. Use `ponytail-gain` only to record measured impact; never fabricate savings.

Fix valid findings as an elite production developer, rerun the affected tests and the full release verification, and proceed only when the simpler result remains secure, correct, accessible, maintainable, and production-safe.

## Progress-safety and checkpoint rule

Implementation occurs on an isolated working branch created from the latest plan-defined release target. After each phase passes its phase gate, update `docs/MEMORY.md`, create a descriptive checkpoint commit, push that branch, and verify the remote SHA. Never integrate an incomplete phase into the release target. Context reset, Auto Continue, or usage reset resumes from `docs/MEMORY.md` and the last verified checkpoint rather than restarting completed work.

The final integration uses the plan-approved non-destructive strategy only after the whole plan passes together on the reconciled tree. Do not assume a branch name or force shared history unless the owner explicitly defines that for a future mission.
