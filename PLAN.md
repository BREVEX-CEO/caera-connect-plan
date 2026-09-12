# PLAN — OCADE Core Rebuild

## Goal

Replace the current broad product with a smaller OCADE core before touching Cowork/Jarvis.

Final visible core:

- Chat
- Library
- Account → Settings
- About
- Help
- Terms
- Privacy

Cowork remains unavailable/placeholder until this plan is complete. `PLAN2.md` owns its replacement.

## Operating rule

Work in this order:

```text
READ EVERYTHING → TRACE REQUIRED BEHAVIOR → DELETE OLD PRODUCT → READ CLEANED REPO → REBUILD SMALL → PROVE IT
```

Do not preserve code because it is high quality. Preserve only final required behavior and the authorities needed to support it safely.

Do not target a cosmetic deletion percentage. The expected result is a very large deletion, potentially near the owner's 90% goal, but correctness decides what remains.

## Phase 0 — Baseline and total read

- Fetch latest `origin/main` and record SHA/tree.
- Read all canonical authorities.
- Inventory routes, runtime authorities, database objects, tests, dependencies, native helpers and donor remnants.
- Trace every final behavior that must survive: auth, Chat, history, usage, online intelligence, Offline Intelligence, Library, settings, billing, Admin/security, About/Help/Terms/Privacy.
- Produce a deletion map before deleting.
- Measure baseline tracked source LOC with `cloc` if available; otherwise use a deterministic repository script. Exclude dependencies, generated build output, binary/model/design assets and vendor code. Record the exact command and result in `docs/MEMORY.md`.

**Gate:** every old subsystem has KEEP/REUSE/REPLACE/DELETE disposition.

## Phase 1 — Aggressive cleanup

Delete retired visible products and their unused implementation after caller tracing:

- standalone Code and old terminal/coding-agent product UI;
- Projects UI;
- Tasks UI and task-only runtime not needed by the final product;
- Artifacts UI and artifact-only runtime replaced by Library;
- Customize;
- Devices page;
- standalone Search/dashboard surfaces;
- pricing and old landing page;
- desktop/Copilot product UI;
- old Cowork/Jarvis presentation/runtime paths reserved for replacement in `PLAN2.md`;
- duplicate computer/browser-control stacks not required as temporary dependencies for `PLAN2.md`;
- obsolete donor Primary Logic code/archive after proving nothing final needs it;
- dead routes, components, stores, hooks, CSS, tests, scripts and dependencies;
- obsolete documentation and stale evidence formats.

Preserve only the minimum staging seam required so `PLAN2.md` can replace Cowork safely.

After deletion, read the smaller repository again and update the dependency map.

**Gate:** no retired primary destination is reachable or shipped as a normal customer surface.

## Phase 2 — Minimal shell and routing

Build the simple shell using `design/reference/grok/` as the structural/density reference and OCADE's own branding.

Desktop:

```text
OCADE
+ New chat
Chat
Library
Cowork
Recent chats
Account
```

- Settings opens from Account.
- Top bar: back/forward and chat search where useful.
- `/` renders Chat immediately.
- Signed-out users can inspect the shell; Send triggers authentication.
- Keep `/about`, `/help`, `/terms`, `/privacy`.
- Remove pricing and landing-page routing.
- Mobile uses a compact chat-first drawer.
- Use near-black/grey/white, restrained 1px borders, small/medium radii and light glassmorphism.

**Gate:** desktop and mobile routing contains no duplicate navigation hierarchy.

## Phase 3 — Authentication

Use Supabase Auth as the only identity authority.

Required entry choices:

1. Continue with Google — primary.
2. Email → 6-digit OTP.
3. Phone → international country picker + 6-digit OTP.
4. Optional password may be configured/used through Account where supported.

Requirements:

- verified identity before full authenticated use;
- preserve safe redirect/deep-link behavior;
- enumeration-resistant errors and bounded resend/backoff;
- production provider flags match actual Supabase provider readiness;
- enable Supabase leaked-password protection before launch when password auth exists;
- never create a second auth store.

**Gate:** real browser journeys prove Google-ready state, email OTP flow, phone formatting/OTP flow, sign-out/session recovery and protected Send behavior.

## Phase 4 — Chat

Chat is the product home.

UI:

- centered reading area;
- one simple history sidebar;
- empty state `Ask OCADE`;
- composer shows only attachment, microphone and send by default;
- optional compact intelligence selector: `Auto`, `OCADE`, `Offline`;
- no suggestion-chip wall;
- no duplicate search/composer controls;
- no model/vendor/runtime terminology;
- contextual message actions only.

Behavior:

- conversations/messages persist through Supabase;
- rename/archive/trash/restore/delete-all remain simple and correct;
- attachments route into Library/storage correctly;
- usage/model/provider failures are one-line customer errors, not fake answer/artifact cards;
- if no answer exists, do not offer Export/Save output controls.

**Gate:** Chat works signed-in across refresh, another browser/device, mobile widths, failure states and usage exhaustion.

## Phase 5 — Account-wide usage authority

Keep one server-authoritative allowance across every device and AI surface.

Free policy remains:

- 28 successful user requests;
- 388-minute / 6h 28m window;
- online and offline combined;
- one successful user request/turn = one use;
- internal retries, tools and Cowork/Jarvis substeps do not multiply the user's charge.

When exhausted:

- block new AI generation everywhere;
- do not bypass through Offline Intelligence;
- keep history, Library, manual browsing/settings and Billing usable;
- show exact remaining/reset state.

Offline reconciliation must remain signed/tamper-resistant and account-wide.

**Gate:** concurrency and multi-device tests prove the same remaining count everywhere.

## Phase 6 — Gemini online intelligence

Online Chat uses the pinned OCADE online model through a server boundary.

Create/use exactly three Supabase Edge Function secrets:

- `GEMINI_API_KEY_PRIMARY`
- `GEMINI_API_KEY_SECONDARY`
- `GEMINI_API_KEY_TERTIARY`

Never put these values in normal database tables or client bundles.

Routing:

- primary first;
- key-local 401/403 may fail over before output;
- bounded pre-output transport/5xx retry/failover is allowed;
- 429 does not rotate to evade shared project quota;
- no slot failover after output begins.

Customer UI calls the result `OCADE`, not Gemini.

**Gate:** secret scan, edge tests and real controlled responses prove no client key exposure and correct failover.

## Phase 7 — Offline Intelligence

Internal implementation uses the selected Qwen 2.5 1.5B model, but that identity is **never customer-facing**.

Customer labels are only:

- `Offline`
- `Offline Intelligence`
- `Preparing OCADE`
- `Downloading <percent>`
- `Verifying`
- `Ready`
- `Repairing`
- `Removed`

Lifecycle:

1. Start preparation automatically on first supported desktop/mobile/tablet visit.
2. Before downloading, detect a verified existing model in OPFS.
3. If verified, reuse it immediately.
4. If missing, download content-addressed chunks in parallel using adaptive safe concurrency.
5. Persist/resume completed chunks across interruption.
6. Verify the complete manifest/fingerprint.
7. Repair only missing or corrupt chunks.
8. Request persistent browser storage where supported and report eviction honestly if the browser removes data.

The model identity/version is independent from the website/app build SHA. Therefore a verified model must **not** redownload because of:

- page refresh;
- browser restart;
- sign-in/sign-out;
- account deletion;
- service-worker update;
- normal site deployment;
- a commit or merge to main;
- compatible OCADE code updates.

Only an explicit user removal, actual corruption/missing bytes, browser eviction or a deliberate incompatible model revision may require bytes again.

Explicit Remove deletes model data and suppresses automatic reinstall until the user explicitly installs again.

`Auto` uses online OCADE when available and may truthfully fall back to verified Offline Intelligence when appropriate. `Offline` creates zero provider traffic.

**Gate:** first-install, interruption/resume, corruption repair, revisit, sign-out/in, new app build and explicit-remove tests all pass without unnecessary full redownload.

## Phase 8 — Library

Single Library replaces Artifacts and scattered upload/output views.

```text
Library
All | Images | Files
Search
[content grid]
```

Contains:

- uploaded files;
- uploaded images;
- generated files/images/outputs from Chat and later Cowork;
- provenance internally where required, not as default screen clutter.

Support preview/download/delete, individual deletion and delete-all through Data Controls.

**Gate:** cross-device Library data and private object access are proven through Supabase/RLS.

## Phase 9 — Settings and Data Controls

Desktop uses a compact centered settings modal; mobile uses a sheet/full-height equivalent.

Categories:

- Account
- Appearance
- Notifications
- Data Controls
- Billing
- Advanced

Data Controls owns:

- delete all conversations;
- delete all uploaded images/files;
- export account data;
- Offline Intelligence state/removal;
- related privacy controls.

Advanced hides diagnostics, device/security details and runtime information from normal customers.

Keep copy short: labels and one-line explanations/errors.

**Gate:** settings survive refresh/device change where account-scoped and never expose raw secrets/model identifiers.

## Phase 10 — Supabase reduction

After final core reachability is known, remove database objects used only by retired products.

Keep only what final OCADE needs, including:

- identities/profiles/security;
- conversations/messages;
- Library metadata/private storage;
- settings/preferences/notifications;
- usage/entitlements/offline reconciliation;
- billing;
- hidden Admin and organization authority only where still required;
- minimal future Cowork/Jarvis persistent state if `PLAN2.md` explicitly requires it.

Remove retired Projects/Tasks/Artifacts/Code-specific tables/RPCs/policies/functions only after dependency tracing and with reversible migrations/verification.

Regenerate Supabase types. Maintain RLS/least privilege.

**Gate:** source/live schema effect agrees and no final caller references removed objects.

## Phase 11 — Polish, accessibility and performance

Implement only useful product polish:

- light/dark handling as designed;
- mobile menu/drawer;
- keyboard shortcuts;
- hover/focus states;
- restrained cursor-reactive motion;
- scrollbar polish;
- copy controls;
- skeleton loaders;
- sticky shell elements only where useful;
- skip-to-content;
- OpenGraph metadata;
- clean empty states;
- toasts;
- password visibility;
- FAQ accordion only in Help;
- back-to-top only on long Help/legal pages;
- cookie banner only if optional cookie use actually requires consent.

Meet WCAG AA intent, reduced motion and keyboard/screen-reader semantics. Avoid heavy GPU work in ordinary UI.

**Gate:** responsive/browser/accessibility/performance audits pass.

## Phase 12 — Core final proof

On the exact production build:

- run typecheck, lint, format, unit/database tests and security gates;
- test every remaining route signed-out and signed-in;
- press every reachable customer control;
- test mobile and desktop widths;
- test real Chat responses and usage exhaustion;
- test email/phone/auth recovery;
- test Library upload/delete/delete-all;
- test Settings/Data Controls/Billing shell;
- test Offline Intelligence first download, parallelism, resume, repair and no-redownload across a new app build;
- scan for forbidden model/provider identifiers in customer bundles/UI;
- scan for dead retired routes/components/dependencies;
- measure final core source LOC using the same Phase 0 method and record before/after/delta.

Do not start `PLAN2.md` until this gate is green.

## Definition of PLAN complete

Core OCADE is smaller, understandable and independently usable. Chat, online intelligence, Offline Intelligence, auth, usage, Library and Settings work end to end. Retired surfaces are gone rather than hidden. The verified offline model survives ordinary application updates without redownload.
