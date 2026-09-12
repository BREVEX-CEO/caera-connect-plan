# PLAN — OCADE Core Rebuild

## Goal

This mission is a deliberate near-total cleanup and rebuild of the current OCADE core before Cowork/Jarvis replacement begins. The target is to remove approximately 90% of the obsolete legacy product implementation and then rebuild the remaining product around the final OCADE architecture.

Do not preserve old code because it is high quality, polished or already working. Keep only required final behavior and authorities: Chat, Library, Account/Settings, auth, usage, online intelligence, Offline Intelligence, billing, security/Admin infrastructure, About the Founder, Help, Terms & Conditions, Privacy Policy, required Supabase authorities and the minimum future seam needed by `PLAN2.md`.

Anything reused must be fully customized, simplified and integrated into the new OCADE product. No old customer-facing surface should survive unchanged merely because it is reusable.

Cowork remains unavailable/placeholder until this plan is fully complete. `PLAN2.md` owns the OCADE JARVIS replacement.

## Operating rule

Work in this order:

```text
READ EVERYTHING → TRACE REQUIRED FINAL BEHAVIOR → AUDIT → DEBT SCAN → DELETE/CLEAN ABOUT 90% OF OBSOLETE LEGACY IMPLEMENTATION → READ THE REDUCED REPOSITORY AGAIN → REBUILD/CUSTOMIZE THE WHOLE CORE PRODUCT → TEST → BREAK → FIX → RETEST → REAL-BROWSER PROVE
```

The 90% target applies to obsolete legacy application code, retired routes, components, stores, tests, styles, duplicate runtimes, stale schema objects, obsolete imported material and stale documentation. Required security, auth, usage, billing, model, Supabase and future Cowork infrastructure must not be deleted merely to manufacture a percentage. Measure the result honestly and record the baseline, final count and reduction in `docs/MEMORY.md`.

Implementation must occur on one isolated completion branch created from the latest `origin/main`. After every phase gate passes, update `docs/MEMORY.md`, create a descriptive checkpoint commit on that completion branch, push it, verify the remote SHA, report the checkpoint, and continue. These checkpoints are mandatory to prevent progress loss across context resets, crashes, usage limits or session loss. Never merge a partial phase or incomplete plan to `main`. Only after every PLAN phase passes together should the verified completion branch be reconciled with latest `main`, fully reverified, then merged/fast-forwarded to `main` without force, pushed and remote-SHA verified.

## Phase 0 — Baseline, total read and isolated branch

Fetch the latest `origin/main`, record the exact SHA/tree and create the isolated completion branch before implementation. Read all canonical authorities and inspect the complete repository, routes, runtime authorities, database objects, tests, dependencies, native helpers and imported remnants. Trace only the final behavior that must survive: auth, Chat, history, usage, online intelligence, Offline Intelligence, Library, settings, billing, Admin/security, About the Founder, Help, Terms & Conditions and Privacy Policy. Produce the deletion map before deleting anything. Measure baseline tracked source LOC with one deterministic method and record the exact command/result in `docs/MEMORY.md`.

**Gate:** every old subsystem is traced and classified, the baseline is recorded, and the isolated completion branch exists.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 0 on the completion branch, push and verify the remote SHA.

## Phase 1 — Approximately 90% legacy cleanup

Aggressively delete the retired old product and its unused implementation. Remove standalone Code and old terminal/coding-agent UI, Projects UI, Tasks UI and task-only runtime not required by the final architecture, Artifacts UI and artifact-only runtime replaced by Library, Customize, Devices, standalone Search/dashboard surfaces, pricing, the old landing page, desktop/Copilot UI, old Cowork/Jarvis presentation/runtime paths reserved for `PLAN2.md`, duplicate computer/browser-control stacks not required as temporary future seams, obsolete imported Primary Logic material, dead routes, components, hooks, stores, CSS, tests, scripts, dependencies, obsolete Supabase objects and stale documentation/evidence.

High quality is not a preservation criterion. If a legacy implementation is not required by the final product, delete it even if it works well. Preserve only required authorities and the smallest safe staging seam needed for later `PLAN2.md` integration.

After the deletion pass, measure the reduction against Phase 0. Target approximately 90% removal of obsolete legacy implementation. If required infrastructure prevents an exact 90% measured source reduction, keep the required code and document the exact result and reason rather than weakening security or correctness.

Then read the reduced repository again from top to bottom before rebuilding.

**Gate:** retired primary destinations are gone rather than hidden, obsolete dependencies are removed, the reduced repository has been reread, and the measured cleanup is documented.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 1 on the completion branch, push and verify the remote SHA.

## Phase 2 — Rebuild the minimal shell and routing

Rebuild the shell around the cleaned architecture using `docs/design-references/grok/` as the sole structural/density visual reference while keeping OCADE branding and original implementation.

The desktop shell is OCADE, New chat, Chat, Library, Cowork, Recent chats and Account. Settings opens from Account. `/` renders Chat immediately. Signed-out users may inspect the shell, but Send requires authentication. Keep `/about` as About the Founder, `/help`, `/terms` as Terms & Conditions, and `/privacy` as Privacy Policy. Remove pricing and the old landing flow. Mobile uses a compact chat-first drawer.

Use near-black/grey/white, restrained 1px borders, small/medium radii and light glassmorphism. Do not recreate Stitch/Jarvis 3D design. Any surviving old component must be fully customized to the new shell instead of reused unchanged.

**Gate:** desktop and mobile routing contain one clean navigation hierarchy and no retired customer surface remains reachable.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 2 on the completion branch, push and verify the remote SHA.

## Phase 3 — Authentication rebuild

Use Supabase Auth as the only identity authority. Primary entry is Continue with Google, with email 6-digit OTP and phone OTP using an international country picker. Optional password may be configured under Account where supported. Preserve safe redirects and deep links, use enumeration-resistant errors and bounded resend/backoff, and enable leaked-password protection when password auth exists. Do not create a second auth store.

**Gate:** real browser journeys prove Google-ready state, email OTP, phone formatting/OTP, sign-out/session recovery and protected Send behavior.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 3 on the completion branch, push and verify the remote SHA.

## Phase 4 — Rebuild Chat completely

Chat is the product home. Rebuild it as a simple centered workspace with one history sidebar, `Ask OCADE` empty state, attachment, microphone and send controls, plus an optional compact selector showing only `Auto`, `OCADE`, `Offline`. Do not show provider/model/runtime terminology, duplicate search/composer controls or suggestion-chip walls.

Persist conversations/messages through Supabase. Keep rename/archive/trash/restore/delete-all simple and correct. Route attachments into Library/storage. Show concise one-line failures. Never render fake answer/artifact controls when no answer exists.

**Gate:** Chat works across refresh, another browser/device, mobile widths, auth states, provider failures and usage exhaustion.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 4 on the completion branch, push and verify the remote SHA.

## Phase 5 — Account-wide usage authority

Keep one server-authoritative allowance across every device and AI surface. Free remains 28 successful user requests per 388 minutes / 6h28m, online and offline combined. One successful user request equals one use; internal retries, tools and later Cowork/Jarvis substeps do not multiply the user charge.

When exhausted, block new AI generation everywhere, including Offline Intelligence, while keeping history, Library, Settings and Billing usable. Offline reconciliation remains signed/tamper-resistant and account-wide.

**Gate:** concurrency and multi-device tests prove one shared remaining count and correct reset behavior.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 5 on the completion branch, push and verify the remote SHA.

## Phase 6 — Online OCADE through Gemini

Online Chat uses the pinned OCADE online model — Gemini 3.1 Flash-Lite — through one server boundary. Create/use exactly three Supabase Edge Function secrets: `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, `GEMINI_API_KEY_TERTIARY`. Never put them in normal database tables, logs or client bundles.

Use primary-first routing. Key-local 401/403 may fail over before output, bounded pre-output transport/5xx retry/failover is allowed, 429 must not rotate to evade shared project quota, and no slot failover occurs after output begins. Customer UI calls the service only `OCADE`.

**Gate:** secret scans, edge tests and controlled responses prove no client key exposure and correct failover.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 6 on the completion branch, push and verify the remote SHA.

## Phase 7 — Offline Intelligence rebuild

The internal implementation uses the selected Qwen 2.5 1.5B model, but that identity is never customer-facing. Normal UI may show only `Offline`, `Offline Intelligence`, `Preparing OCADE`, `Downloading <percent>`, `Verifying`, `Ready`, `Repairing` and `Removed`.

Automatically prepare on the first supported desktop/mobile/tablet visit. Before downloading, detect a verified compatible model in OPFS and reuse it immediately. If absent, use fast bounded adaptive parallel chunk downloading, persist completed chunks, resume interruptions, verify the complete model, and repair only missing/corrupt chunks. Request persistent storage where supported and report eviction honestly.

Model identity/version is independent of website/app build SHA. A verified compatible model must not redownload because of page refresh, browser restart, sign-in/sign-out, account deletion, service-worker update, normal deployment, commit, merge to `main` or compatible OCADE code update. Only explicit removal, actual corruption/missing bytes, browser eviction or a deliberate incompatible model revision may require model bytes again.

Explicit Remove deletes model data and suppresses immediate automatic reinstall until explicit Install. `Auto` may use online OCADE and truthfully fall back to verified Offline Intelligence; `Offline` creates zero provider traffic.

**Gate:** first install, parallelism, interruption/resume, corruption repair, revisit, sign-out/in, new app build and explicit removal all pass without unnecessary full redownload.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 7 on the completion branch, push and verify the remote SHA.

## Phase 8 — Rebuild Library

Library replaces Artifacts and scattered upload/output views. Use one simple `All | Images | Files` experience with search and a clean content grid/list. It contains uploaded files, uploaded images and generated files/images/outputs from Chat and later Cowork. Support preview, download, delete, individual deletion and delete-all through Data Controls. Keep technical provenance out of the default UI.

**Gate:** cross-device Library data and private object access are proven through Supabase/RLS.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 8 on the completion branch, push and verify the remote SHA.

## Phase 9 — Rebuild Settings and Data Controls

Desktop uses a compact centered settings modal; mobile uses a sheet/full-height equivalent. Categories are Account, Appearance, Notifications, Data Controls, Billing and Advanced. Data Controls owns delete-all conversations, delete uploaded images/files, export account data, Offline Intelligence state/removal and related privacy controls. Advanced hides diagnostics, device/security details and runtime information from normal customers.

Keep copy short and fully customize any retained settings implementation to the new shell.

**Gate:** account-scoped settings survive refresh/device change and no raw secret/model/runtime identifier is exposed.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 9 on the completion branch, push and verify the remote SHA.

## Phase 10 — Supabase cleanup and reduction

After final core reachability is known, remove database objects used only by retired products. Keep only identities/profiles/security, conversations/messages, Library metadata/private storage, settings/preferences/notifications, usage/entitlements/offline reconciliation, billing, hidden Admin/organization authority where still required, and minimal future Cowork/Jarvis persistence explicitly required by `PLAN2.md`.

Remove retired Projects/Tasks/Artifacts/Code-specific tables, RPCs, policies and functions after dependency tracing and with reversible migrations/verification. Regenerate Supabase types and maintain RLS/least privilege.

**Gate:** source and live schema agree and no final caller references a removed object.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 10 on the completion branch, push and verify the remote SHA.

## Phase 11 — Polish, accessibility and performance

Implement only useful polish: light/dark handling as designed, mobile drawer, keyboard shortcuts, hover/focus, restrained motion, scrollbar polish, copy controls, skeletons, sticky shell elements where useful, skip-to-content, OpenGraph metadata, clean empty states, toasts and password visibility. FAQ accordion belongs only in Help, back-to-top only on long Help/legal pages, and a cookie banner only when optional cookie use actually requires consent.

Meet WCAG AA intent, reduced-motion expectations and keyboard/screen-reader semantics. Avoid heavy GPU work in ordinary UI.

**Gate:** responsive, browser, accessibility and performance audits pass.

**Checkpoint:** update `docs/MEMORY.md`, commit Phase 11 on the completion branch, push and verify the remote SHA.

## Phase 12 — Core final proof and final merge

On the exact completion-branch production build, run typecheck, lint, format, unit/database tests and security gates; test every remaining route signed-out and signed-in; press every reachable customer control; test mobile and desktop widths; test real Chat responses and usage exhaustion; test auth recovery; test Library upload/delete/delete-all; test Settings/Data Controls/Billing; test Offline Intelligence first download, parallelism, resume, repair and no-redownload across a new app build; scan customer bundles/UI for forbidden model/provider identifiers; scan for dead retired routes/components/dependencies; and measure final source LOC using the same Phase 0 method.

Then reread the entire `PLAN.md` against the final branch tree. Fetch latest `origin/main`, reconcile it into the completion branch without force, rerun every final gate on that exact reconciled tree and verify it again. Only after all gates pass together may the completion branch be merged or fast-forwarded into `main`. Push `main`, verify the final remote SHA/tree and perform the required production verification/deployment sequence.

**Gate:** the exact tree merged to `main` is the same tree that passed the complete final verification.

**Final checkpoint:** record final state in `docs/MEMORY.md`, commit/push/verify the completion branch, then merge the verified whole plan to `main` and verify the final remote SHA/tree.

## Definition of PLAN complete

The old broad OCADE product has been aggressively removed and the core has been rebuilt around the final architecture. The cleanup target is approximately 90% removal of obsolete legacy implementation, measured honestly against Phase 0. Chat, online intelligence, Offline Intelligence, auth, usage, Library, Settings, required public/legal/founder pages and required backend authorities work end to end. Retired surfaces are deleted rather than hidden. Reused code is fully customized rather than carried forward unchanged. The verified Offline Intelligence model survives ordinary OCADE updates without redownload. `PLAN2.md` does not begin until this entire plan is green and merged only through the verified checkpoint/final-merge workflow.