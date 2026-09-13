# OCADE Testing Authority

## Rule

A feature is not complete because code exists. It is complete only when the real path is proven at the correct layer.

Every `PLAN.md` phase runs the smallest relevant gate set during implementation, then the complete gate set at final verification.

## Core static gates

Run as applicable:

- TypeScript typecheck;
- ESLint;
- formatting check;
- production build;
- dead import/module scan;
- secret scan;
- customer-visible provider/model leak scan.

No new warning/error may be dismissed simply because the old repository already had warnings.

## Unit/integration tests

Required subjects include:

- usage policy and reset windows;
- generation permit idempotency;
- no double-charge on retries/fallback;
- Free/Pro/Max exact allowances;
- entitlement resolution;
- pricing catalogue/signature;
- safe auth redirects;
- email/phone formatting and OTP state;
- attachment validation;
- New Chat behavior;
- edit/regenerate accounting;
- offline install state machine;
- explicit `user_uninstalled` persistence;
- adaptive download/resume/repair;
- online→offline fallback before output only;
- offline zero-provider-traffic rule;
- local sync/idempotency.

## Database tests

Use a real Postgres/Supabase-compatible environment for DB behavior.

Prove:

- migrations apply cleanly;
- rollback/verification where provided;
- RLS isolation;
- generation permit concurrency;
- shared account-wide allowance;
- offline lease reconciliation;
- entitlement grants;
- subscription/entitlement resolution;
- Library private access;
- retired schema removal has no final caller;
- auth/account tables are untouched by cleanup migrations.

After final migrations regenerate types and run Supabase security/performance advisors.

## Browser journeys

Browser proof must run against the production build, not only component mocks.

Required journeys:

### Shell/routes

- every supported route signed out;
- every supported route signed in;
- deep-link refresh;
- retired routes return intended 404;
- no console/page errors.

### Auth

- Google-ready path;
- email OTP flow;
- phone OTP formatting/verification path;
- sign-out;
- session recovery;
- protected Send;
- MFA/assurance where required.

### Chat

- real Send;
- New Chat;
- refresh/persistence;
- recent history;
- Copy;
- Edit;
- Regenerate;
- Delete;
- Stop;
- Retry failure;
- Markdown/table/link/code rendering;
- attachment upload/progress/retry/remove/reorder/preview/download;
- 100 MB boundary behavior;
- mobile/tablet composer.

### Usage

- Free starts at 28;
- one successful answer decrements exactly one;
- failed request costs zero;
- fallback costs one total;
- Edit→success costs one;
- Regenerate→success costs one;
- account-wide state matches across two browser/device contexts;
- exhaustion blocks online/offline generation;
- history/Library/Settings/Pricing remain usable;
- reset countdown is correct;
- Pro/Max session+week caps are correct.

### Online OCADE

- real Edge Function answer;
- auth/JWT behavior;
- primary secret path;
- allowed pre-output failover;
- 429 no quota-evasion rotation;
- no key/client exposure;
- provider errors sanitized.

### Offline Intelligence

- first install;
- WebGPU-first path where supported;
- WASM fallback;
- Fast/Thinking UI behavior;
- private authorised artifact delivery;
- adaptive parallel download;
- pause/resume;
- tab minimise;
- browser restart;
- connection interruption;
- one corrupt shard repaired without full redownload;
- OPFS persistence;
- compatible app update causes no redownload;
- explicit Remove sets persistent suppression;
- sign-out/in after explicit Remove does not reinstall;
- explicit Install clears suppression;
- no Internet + never-installed gives connect-once guidance;
- Offline mode makes zero provider requests.

### Whole-site offline

- the website works with no install step of any kind;
- nothing offers to install OCADE, and no web app manifest is served;
- airplane mode then reopen;
- shell loads;
- Offline Chat works when model ready;
- local/cached history and pages work as designed;
- Pricing information loads from cache;
- checkout/payment refuses offline;
- reconnect sync is idempotent.

### Pricing/Billing

- Free/Pro/Max;
- weekly/monthly toggle;
- USD/EUR/GBP/INR;
- manual currency selector;
- checkout Internet requirement;
- real entitlement update where provider configured;
- manual Admin grant/revoke;
- allowance changes immediately from entitlement.

### Library/Settings/Admin

- private upload/read/delete;
- Data Controls delete/export flows;
- Offline install/remove state;
- notifications/settings persistence;
- user search/grant/revoke in hidden Admin;
- no direct auth-user mutation.

## Responsive matrices

At minimum prove representative widths for:

- desktop;
- tablet;
- phone.

Official environment focus:

- Windows Chrome;
- macOS Chrome;
- Android Chrome;
- iPhone/iPad Chrome/WebKit where supported.

Linux is not a certified target.

## Final release gate

Before merge, run all current tracked gates plus the complete browser journey set on the exact reconciled tree.

After merge/deploy, production smoke test must include:

- auth;
- one real online answer;
- one exact usage decrement;
- one offline answer/fallback;
- one Library upload/delete;
- Pricing/Billing;
- sign-out/sign-in recovery;
- customer-visible provider/model leak scan.

The final remote `main` SHA/tree must match the tree that passed verification.
