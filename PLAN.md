# PLAN — OCADE Pre-Cowork Production Repair

## Mission

This file replaces the previous OCADE rebuild plan completely.

The core product already exists, but it is not allowed to move into Cowork implementation until the current product is repaired, simplified, deployed correctly and proven end to end. `PLAN2.md` is removed. Cowork may remain visible only as a clean unavailable placeholder; no Cowork/Jarvis runtime work is allowed during this mission.

The mission is complete only when Chat, authentication, usage, pricing, payments, online intelligence, Offline Intelligence, Library, Settings, the supported public pages, Supabase, offline/PWA behavior and the responsive UI all work together on the exact production tree.

## Mandatory session start

Before doing anything else, obey `CLAUDE.md` and start every implementation session with both default modes:

```text
/ponytail ultra
/caveman ultra
```

Then read `CLAUDE.md`, this file and every canonical file under `docs/` before editing.

## Non-negotiable execution rule

Use one isolated implementation branch created from the latest `origin/main`.

For every phase:

```text
READ → TRACE → REPRODUCE → CLASSIFY → FIX/DELETE → TEST → BREAK → FIX → RETEST → REAL-BROWSER PROVE → CHECKPOINT → PUSH → VERIFY SHA
```

Do not create duplicate authorities, `v2` systems, temporary second routers, second stores, second usage systems, second auth systems or parallel model lifecycle implementations when the existing canonical authority can be repaired.

Do not hide a broken feature with UI. Fix the real path or remove the feature.

Do not merge partial work to `main`. After every phase gate passes, update `docs/MEMORY.md`, commit, push, verify the exact remote SHA and continue. Only the final fully proven tree may be reconciled with `main` and merged.

## Product scope during this mission

The supported customer product is:

- Chat at `/`;
- Library at `/library`;
- Pricing at `/pricing`;
- Account/Settings;
- authentication;
- online OCADE;
- Offline Intelligence;
- usage and billing;
- About at `/about`;
- Help at `/help`;
- Terms at `/terms`;
- Privacy at `/privacy`;
- hidden Admin where required for operations and access grants;
- Cowork as an unavailable placeholder only.

Retired routes remain deleted/404 unless this plan explicitly restores them.

## Customer identity rule

The customer interacts with **OCADE**, not raw providers or runtimes.

Normal customer-visible UI, assistant answers, progress states, errors, metadata and exported customer content must not expose raw provider/model/runtime identities.

If asked questions such as:

- Who are you?
- What model are you?
- Are you Gemini?
- Are you the local model?
- What LLM powers you?

OCADE identifies itself as OCADE, for example:

> I’m OCADE, your AI assistant.

Raw provider/model/runtime names may exist only where technically required in trusted server-side/private deployment configuration. Provider errors must be sanitized before reaching the browser.

For the private offline model, remove the existing tracked public catalogue/name leakage. The final repository and customer bundle should use opaque OCADE artifact identifiers rather than the vendor/model name. The actual model identity is private deployment configuration. Do not claim perfect secrecy from a determined owner of a device that physically stores local model bytes; instead minimise disclosure as strongly as browser technology permits.

---

# Phase 0 — Fresh audit, freeze Cowork and establish the real baseline

Fetch latest `origin/main`, create the isolated implementation branch and record the exact starting SHA/tree in `docs/MEMORY.md`.

Read the entire reachable repository and the current live Supabase state before editing. Reproduce the currently visible failures, especially the Chat Send failure that reports that OCADE cannot verify the usage allowance.

Create a live dependency map for:

- Chat send/stream/persistence;
- Supabase Auth;
- usage permits and commercial ledger;
- online intelligence Edge Function;
- offline runtime/model lifecycle;
- Library/uploads;
- Pricing/checkout/subscriptions/entitlements;
- Settings/Data Controls;
- service worker/PWA/offline shell;
- public/legal routes;
- hidden Admin/access grants.

Delete `PLAN2.md` and remove every documentation reference that tells an agent to wait for or execute a second plan. Cowork stays unavailable and may not be implemented until a future owner instruction after this plan is complete.

**Gate:** exact current failures are reproducible, all canonical authorities are mapped, `PLAN2.md` is gone, Cowork is frozen, and the implementation branch is remotely verified.

---

# Phase 1 — Hunt every reachable production bug

Treat every current page and visible control as untrusted until proven.

Root-cause and repair the usage/send error. Trace the real sequence:

```text
browser session
→ authenticated account
→ generation request
→ usage permit
→ server ledger
→ selected intelligence route
→ output delivery
→ permit finalization/release
→ persisted conversation
```

Do not merely change the error message.

Test every supported route signed out and signed in. Find and fix:

- pages that fail to load;
- route/deep-link refresh failures;
- broken controls;
- stale imports;
- Supabase/RLS errors;
- server/client boundary errors;
- Edge Function errors;
- upload/download errors;
- state that disappears incorrectly on refresh;
- mobile/tablet overflow;
- console errors and unhandled promise rejections;
- stale service-worker assets;
- wrong fallbacks;
- broken account/usage/billing state.

A visible control must execute real behavior, show a truthful unavailable state, or be removed.

**Gate:** every supported route loads, zero known blocking browser errors remain, and Chat can reach a real permit decision rather than failing generically.

---

# Phase 2 — Authentication and account recovery

Supabase Auth remains the only identity authority.

Required sign-in methods:

1. Google;
2. email 6-digit OTP;
3. optional account password only where deliberately supported;
4. MFA/assurance flow where required for sensitive operations.

Enable email sign-in in the Supabase project. Phone sign-in is removed by owner decision: sending SMS needs an external provider OCADE does not have, and a sign-in method that can only refuse is worse than one that is absent. Do not create custom password storage. Preserve safe redirects, enumeration-resistant messaging, resend cooldown/backoff, session recovery and sign-out.

Do not delete or mutate existing users, identities, active sessions, refresh tokens or MFA state during database cleanup.

**Gate:** Google-ready state, email OTP, session recovery, sign-out and protected Chat Send all pass real-browser proof without creating a second auth authority.

---

# Phase 3 — Supabase cleanup, logs, user preservation and easy access grants

The live project is `sazhgaisyhkdbrooycdv`. Re-verify that project before any migration or data cleanup.

## Never touch these during cleanup

Do not delete or truncate:

- `auth.users`;
- `auth.identities`;
- `auth.sessions`;
- `auth.refresh_tokens`;
- active auth flow/MFA state;
- real account profiles/roles/settings required by final OCADE;
- real subscriptions/payment evidence;
- legal consent evidence;
- real customer conversations/messages/Library objects unless the customer explicitly deletes them.

Do not clear platform-managed Auth history merely to make the project look empty.

## Remove retired product schema/data

Trace callers first, then remove schema objects used only by retired products such as old Cania/Madee/Ficia/messaging/project/task/automation/organization/status/support surfaces when they are no longer required by the final app.

Use reversible, reviewed migrations. Regenerate TypeScript types afterward. Keep RLS enabled and least-privilege policies correct.

## Clear stale application logs/test data safely

Delete stale development/launch/test operational rows only from non-authoritative application tables that are proven not to be customer, financial, legal or security evidence. Examples may include obsolete launch-gate state, retired provider-event/test traces and old product activity logs after caller tracing.

Do not delete legal, payment, entitlement, auth or security evidence simply because it looks like a log.

Where a log is still required, add a bounded retention policy instead of allowing indefinite growth.

## Easy manual access grants

Keep one canonical entitlement-grant authority for manually granting user access.

Hidden Admin must make it easy for the owner/admin to:

- search a user by email or stable user id;
- see current tier/entitlement;
- grant Free/Pro/Max access;
- set optional start/end time;
- record a short reason;
- revoke a manual grant;
- distinguish manual grant from paid subscription;
- audit who granted/revoked access.

Manual grants must never require editing `auth.users` directly and must never corrupt payment history.

**Gate:** live schema matches the final app, retired data/logs are safely removed or bounded, existing accounts/sessions remain intact, RLS/advisors are clean, and manual access grants work end to end.

---

# Phase 4 — Online OCADE through Gemini with exactly three secrets

Online OCADE uses the existing server/Edge Function boundary. No provider key may reach the browser.

Exactly these three Supabase secrets are allowed:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

When this phase is reached, **stop and explicitly ask the owner to provide exactly three Gemini API keys as secrets**. The owner has already stated that they will provide all three.

After the owner supplies them:

- add them to Supabase Secrets using the connected secure Supabase capability when available;
- never commit them;
- never echo them into source, logs, database rows or browser bundles;
- redeploy `ocade-intelligence`;
- verify JWT/auth requirements;
- verify a real answer through the production boundary.

If the current tool environment cannot write Supabase Secrets directly, do not ask for code changes instead. Give the owner the one minimal secret-setting action required, then continue after it is completed.

Routing rules:

- primary key first;
- secondary/tertiary only for key-local authentication/transport failure before output;
- bounded retry/failover before output;
- never rotate keys to evade a shared 429 quota;
- never fail over after output begins;
- sanitize provider errors.

**Gate:** real production online answer works, only three secret slots exist, no key is exposed, and controlled failure tests prove correct failover.

---

# Phase 5 — One simple account-wide allowance

Replace the current mixed weighted-work behavior with a simple successful-request model for every tier.

One successful user request = one use.

Failed generations = zero uses.

Internal retries/fallback attempts = zero extra uses.

Copy/delete/download = zero uses.

Edit → successful regenerate = one new use.

Regenerate → successful answer = one new use.

Allowances:

```text
Free
28 uses / 6h28m
no weekly cap

Pro
140 uses / 6h28m
700 uses / week

Max
1,400 uses / 6h28m
7,000 uses / week
```

Max is exactly 10× Pro.

The allowance is account-wide across Windows/macOS/Android/iPhone/iPad, across online and offline, and across every successful generation path.

If one device uses 10 of Free's 28, every other device sees 18 remaining.

When the applicable allowance reaches zero:

- lock new generation for Online, Auto and Offline;
- history remains readable;
- Library remains usable;
- Settings/Billing/Pricing remain usable;
- show truthful reset time and Upgrade action.

Offline use must not create an unlimited loophole. Use signed/tamper-resistant local allowance leases and reconcile them to the server when connectivity returns. If there is neither server connectivity nor a valid signed local lease, fail closed.

Usage UI:

```text
18 of 28 left · resets in 2h 14m
```

Show a small meter near Account/sidebar, a subtle low-usage warning near Send and full details under Billing, including Upgrade.

**Gate:** concurrency, multi-device, online/offline and reset tests prove one shared allowance with no double charge or bypass.

---

# Phase 6 — Restore Pricing, checkout and entitlements

Restore public `/pricing` and keep Billing inside Settings.

Current approved catalogue:

| Tier | Weekly | Monthly |
| --- | --- | --- |
| Free | Free | Free |
| Pro | $8 / €8 / £8 / ₹288 | $28 / €28 / £28 / ₹1,888 |
| Max | $28 / €28 / £28 / ₹1,888 | $88 / €88 / £88 / ₹5,888 |

Keep the existing price-signature rule. Use regional currency automatically with a manual currency selector.

Pricing UI uses clean glass cards and a weekly/monthly toggle.

Real checkout must connect:

```text
Pricing
→ checkout
→ payment confirmation
→ subscription/entitlement
→ allowance tier
→ Billing state
```

No payment is processed or queued when offline. Pricing information may still load from the offline shell, but checkout clearly requires Internet.

Manual Admin grants and paid entitlements must be separate, auditable sources that resolve into one final tier decision.

**Gate:** Free/Pro/Max display correctly, real checkout/entitlement flow is connected where provider configuration exists, offline purchase is impossible, and entitlement immediately changes the correct allowance.

---

# Phase 7 — Replace Offline Intelligence with the private OCADE 0.6B runtime

Replace the old local model/runtime configuration completely.

The selected offline model is an owner-approved private 0.6B model. Its vendor/model identity must not be written into customer-facing UI or new tracked public model catalogues. Use the internal product name **OCADE Offline** / **Offline Intelligence** only.

Scrub obsolete tracked model identity leakage from:

- old catalogue JSON;
- source constants/comments where not technically required;
- filenames exposed to customers;
- tests/snapshots;
- client metadata;
- user-visible diagnostics.

Use two internal execution forms for the same OCADE Offline capability:

1. WebGPU-first artifact/runtime on devices where it is genuinely verified;
2. WASM fallback artifact/runtime where WebGPU is unavailable or unstable.

A device downloads only the artifact it needs initially. If WebGPU later fails genuinely, acquire the WASM artifact only when required.

Normal customer UI must never expose WebGPU/WASM/vendor/model terminology.

Offline modes:

- Fast — default;
- Thinking — optional.

Both remain branded as OCADE.

**Gate:** the old local model is gone, the new private 0.6B runtime produces real answers, WebGPU-first/WASM fallback works and no normal customer surface exposes raw model/runtime identity.

---

# Phase 8 — Private model distribution and ultra-fast resumable installation

Do not download local model artifacts from Hugging Face or another public model host in the customer browser.

Use OCADE-controlled Cloudflare infrastructure with a **private R2 bucket**.

Requirements:

- bucket not publicly listable;
- no permanent public raw object URLs;
- browser receives only short-lived authorised delivery for opaque artifact/shard ids;
- no R2 credentials in the browser;
- CDN/cache strategy may be used only if it preserves the private access design;
- rate/WAF protection;
- strong integrity hashes;
- no raw vendor/model filename in customer-visible requests or metadata where avoidable.

Use immutable independently verifiable shards/chunks rather than one giant all-or-nothing file when that produces better measured throughput and repairability.

Adaptive parallel download:

```text
start at a safe concurrency
measure real throughput
try 4 / 8 / 12 / 16 / 24 / 32 where appropriate
increase only while throughput improves and stability remains good
back down automatically when more parallelism becomes slower or unreliable
```

The goal is maximum real throughput, including ~25 Mbps connections, not the largest connection count.

Every completed shard is persisted immediately.

Support:

- pause/resume;
- connection changes;
- tab minimisation;
- browser suspension;
- best-effort Background Fetch where genuinely supported;
- service-worker coordination where valid;
- bounded retries/backoff;
- per-shard integrity;
- targeted repair;
- atomic final activation.

A killed browser/OS must not cause restart from zero. On reopen, continue from already verified shards.

**Gate:** first install, interruption, minimisation, browser restart, offline resume, corruption of one shard and re-entry all behave correctly without unnecessary full redownload.

---

# Phase 9 — OPFS lifecycle and the uninstall rule

Use OPFS/persistent browser storage for local model bytes and model-owned metadata where supported. Request persistence where available and handle storage refusal/eviction truthfully.

Normal first signed-in visit:

```text
internet available
+ model not installed
+ user has never intentionally removed it
→ automatically begin preparing OCADE Offline in the background
```

The user may continue chatting online while installation runs.

Show unobtrusive progress near Account/sidebar, for example:

```text
Preparing OCADE Offline · 43%
```

Clicking opens a medium-glass progress panel with progress, speed/status, Pause/Resume and Cancel.

## Critical explicit-uninstall rule

If the user manually removes OCADE Offline:

- delete its local artifacts;
- record an explicit local `user_uninstalled` preference independent of app build/version;
- never auto-redownload because of deploy, site update, commit, merge, browser restart, sign-out/sign-in or compatible OCADE update;
- show:

> You uninstalled OCADE Offline. Get it back to use OCADE without internet.

and an **Install Offline** button.

Only an explicit Install action clears that suppression.

If the model was never installed and the device is offline, show:

> OCADE Offline isn’t installed. Connect once to install it, then use OCADE without internet.

Keep an install/request button visible; remember the intent and start installation automatically when connectivity returns.

A deliberate incompatible model revision, genuine corruption/missing bytes or browser eviction may require new bytes, but ordinary site updates never do.

**Gate:** intentional removal persists across updates and sign-in cycles, first-time installation auto-starts correctly, and no redownload loop is possible.

---

# Phase 10 — Intelligence routing and truthful fallback

Default signed-in Chat behavior:

```text
internet available + online OCADE healthy
→ use online OCADE

online provider fails before output + OCADE Offline ready
→ use OCADE Offline automatically

no internet + OCADE Offline ready
→ use OCADE Offline

no internet + OCADE Offline absent
→ show installation/connect-once guidance
```

`Offline` mode always uses the local OCADE runtime and creates zero provider traffic.

`Auto`/online OCADE may fall back to local only before any provider output has begun and only when local runtime is verified ready.

A successful fallback still costs exactly one use total.

Images require online OCADE; when truly offline, image understanding is refused cleanly rather than pretending the local text model can see images.

Textual documents may be locally extracted where safely supported and their text passed to Offline Intelligence. Typed/pasted text always works. If a document format cannot be locally and safely extracted, clearly require Online OCADE rather than fabricating support.

**Gate:** every online/offline/failure state produces one truthful deterministic route with no double charge and no provider/model leakage.

---

# Phase 11 — Whole OCADE usable offline in Chrome

OCADE is a website, reached at `ocade.in` in a browser, and is never offered as an application to install.

No install button, no install prompt, no promotion of a desktop or native app, no app-store listing, no "add to home screen" wording, and no web app manifest — a manifest with `display: standalone` is itself what makes Chrome offer to install a site, so there is none.

The service worker stays. Offline caching and installability are separate browser features that only look related; the shell opens without a connection either way.

When Chrome has no Internet, the cached OCADE shell must still open and provide all functionality that can honestly work locally:

- Chat with Offline Intelligence when installed;
- locally available conversation history;
- locally available Library metadata/content that has been cached intentionally;
- Account/Settings shell;
- Pricing information;
- About;
- Help;
- Terms;
- Privacy.

Cloud-only actions remain visible where useful but clearly require Internet.

Payment never processes offline.

New offline conversation work is stored locally and syncs to the same account/conversation authority when Internet returns, with deterministic conflict handling.

Official target environments:

- Windows Chrome;
- macOS Chrome;
- Android Chrome;
- iPhone/iPad Chrome/WebKit where browser capabilities permit.

Linux may work but is not an advertised/certified target.

**Gate:** airplane-mode/browser-reopen tests prove the OCADE shell and Offline Chat work where supported, and online-only actions fail truthfully.

---

# Phase 12 — Complete Chat experience

Keep one canonical Chat authority and finish the normal features expected from a modern assistant.

Composer/input:

- `Ask OCADE`;
- attachment `+` menu;
- drag/drop;
- clipboard paste;
- microphone;
- Send;
- Stop generation;
- Auto/OCADE/Offline selector;
- upload progress;
- retry failed upload;
- remove/reorder attachments before send.

Supported online attachment handling should include images, PDF, Word/text, CSV/Excel, PowerPoint and common safe code/archive types where intentionally supported, up to **100 MB per attachment**, with a bounded total-message limit.

Messages/answers:

- Copy;
- Edit user prompt;
- Regenerate;
- Delete;
- Retry failed generation;
- code-block Copy;
- Markdown;
- tables;
- links;
- attachment preview/download.

Editing a previous prompt regenerates from that point while retaining prior history internally rather than silently corrupting it.

New Chat immediately presents a fresh empty composer but does not create an empty database conversation until the first real Send.

Images use online OCADE only. Offline image requests are clearly refused/held rather than sent to the local text runtime.

**Gate:** every Chat control works on desktop/tablet/mobile, attachments and usage accounting are correct, and refresh/device-sync behavior is proven.

---

# Phase 13 — Library, Settings, Data Controls and Admin polish

Library remains one authority for customer files/outputs.

Required Library behavior:

- All / Images / Files;
- search;
- grid/list where useful;
- preview;
- download;
- delete;
- delete-all through Data Controls;
- private object access through Supabase/RLS.

Settings categories:

- Account;
- Appearance;
- Notifications;
- Data Controls;
- Billing;
- Advanced.

Data Controls includes:

- delete conversations;
- delete uploaded/generated files/images;
- export account data;
- Offline Intelligence state/remove/install;
- privacy controls.

Account includes sign-in methods and account deletion flow.

Advanced keeps technical diagnostics/security information away from normal users and still must not reveal private provider/model identity unnecessarily.

Hidden Admin includes the manual entitlement-grant workflow defined in Phase 3.

**Gate:** cross-device state, private storage, deletion/export, access grants and billing all work with clean RLS/permissions.

---

# Phase 14 — GUI rebuild: clean medium glassmorphism + restrained motion

Use `docs/design-references/grok/` plus the owner-supplied repair screenshots as the structural reference, while keeping OCADE branding and implementation original.

Target:

- near-black/charcoal ground;
- clean grey/white typography;
- medium glassmorphism on sidebar, composer, settings, dialogs, menus, pricing cards and attachment surfaces;
- backdrop blur with thin neutral borders;
- restrained highlights;
- no heavy neon or giant gradient fields;
- large usable Chat workspace;
- polished spacing and alignment;
- compact account/usage meter;
- consistent responsive behavior.

Motion may include:

- smooth panel open/close;
- subtle hover movement;
- short blur/opacity transitions;
- download/progress animation;
- gentle streaming indicator;
- small Offline preparation animation.

Respect reduced-motion settings and avoid GPU-heavy decorative scenes.

Desktop, tablet and mobile must all feel intentional rather than being a shrunken desktop layout.

**Gate:** responsive screenshots/browser checks match the intended hierarchy/density and accessibility/performance remain acceptable.

---

# Phase 15 — Final deployment, production proof and merge

Before merge, run the complete local/CI gate set on the exact completion-branch tree:

- typecheck;
- lint;
- formatting;
- unit tests;
- database/migration verification;
- RLS/security advisors;
- secret scans;
- dead-route/dead-module scans;
- build;
- real-browser journeys at desktop/tablet/mobile widths;
- PWA/offline tests;
- online Gemini tests;
- Offline Intelligence tests;
- usage concurrency/multi-device tests;
- Pricing/checkout/entitlement tests;
- auth and email OTP tests;
- Library/uploads;
- Settings/Data Controls;
- manual Admin access grants;
- public/legal routes;
- customer-visible model/provider leak scan.

Then verify production prerequisites:

1. exactly three Gemini secrets present;
2. current `ocade-intelligence` Edge Function deployed;
3. required Supabase migrations applied in the correct app-compatible order;
4. email login enabled;
6. private Library bucket/policies correct;
7. private offline-model R2 delivery configured;
8. production site/service worker/PWA updated.

Perform a real production smoke test with a dedicated test account, including one real online answer, one usage decrement, one offline fallback, one Library upload/delete, one Pricing/Billing check and one sign-out/sign-in recovery.

Fetch the latest `origin/main`, reconcile without force, rerun every final gate on that exact reconciled tree, then merge/fast-forward to `main`, push and verify the final remote SHA/tree.

**Final gate:** the exact tree on `main` is the exact tree that passed the complete production verification.

---

# Definition of complete

This plan is complete only when all of the following are true together:

- the current Send/usage failure is fixed at its root;
- all required pages load;
- Google and email OTP auth works;
- existing accounts/logged-in users survived Supabase cleanup;
- stale retired schema/data/logs are removed safely;
- manual user access grants are easy and auditable;
- exactly three Gemini keys are configured securely and online OCADE works;
- Free/Pro/Max allowances are enforced account-wide online/offline;
- Pricing and real entitlement wiring work;
- the old local model is replaced by the private OCADE 0.6B runtime;
- WebGPU-first/WASM fallback is proven;
- private R2 model delivery is fast, resumable and integrity-checked;
- explicit user uninstall prevents future automatic redownload until the user asks to reinstall;
- OCADE opens and works appropriately when Chrome has no Internet;
- Chat has the expected attachment/edit/regenerate/copy/stop/retry features;
- Library, Settings, Data Controls and Billing work;
- customer-facing identity is always OCADE;
- the UI is clean, responsive, medium-glass and polished;
- Cowork remains unimplemented/unavailable;
- all final gates pass on the exact production/merged tree.

After this plan finishes, do not begin Cowork automatically. Wait for a new explicit owner instruction.