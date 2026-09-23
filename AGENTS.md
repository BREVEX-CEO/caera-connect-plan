# OCADE Agent Handbook

## Project overview

**CARCC** is the company. **OCADE** is CARCC's AI product. Keep that relationship consistent everywhere: company context says CARCC; product context says OCADE. Remove the former CARCC CADANE/CADANE identity from current product material.

OCADE's current mission is a **website-only, Chat-first AI product**. The release target is deliberately narrow: Chat, Library, Settings, Offline Intelligence, usage/limits, Pricing, authentication, public/legal pages, and the hidden owner/admin surface. Cowork may remain only as a clean reserved placeholder. Do not build Code, Projects, Tasks, Automations, Monitors, Organizations, native apps, browser/computer control, or other future products unless a new owner-approved mission explicitly adds them.

The customer-facing intelligence choices are **Auto | Online | Offline**. Provider, vendor, model, runtime, artifact-format and infrastructure identities are implementation details and must not appear in ordinary UI, customer errors, exports, public metadata, or client-visible diagnostics.

## Authority order

1. The owner's current request.
2. `PLAN.md` for the active implementation/audit mission. **Do not rewrite PLAN.md unless the owner explicitly asks.**
3. `docs/PRD.md` for product scope.
4. `docs/TRD.md` and `docs/ARCHITECTURE.md` for technical architecture.
5. `docs/APP_FLOW.md` for journeys/navigation.
6. `docs/DESIGN.md` and `docs/UI UX Brief.md` for UI.
7. `docs/Backend Schema.md` for data/security.
8. `docs/RULES.md`, `docs/TESTING.md`, `docs/DECISIONS.md`, and `docs/MEMORY.md`.

Do not revive requirements from old migrations, comments, deleted products, screenshots, or historical plans when the current authorities reject them.

## Repository and stack

- TypeScript, React 19, TanStack Router/Query/Start, Vite, Tailwind CSS.
- Use Node 22+ with npm for the repository toolchain.
- Supabase Auth/PostgreSQL/Storage for account identity and durable account data.
- Cloudflare Worker for the website and private R2 delivery for Offline Intelligence.
- Keep one server-side Online Intelligence boundary.
- Keep one browser Offline Intelligence installer and runtime authority.
- Vitest, PGlite/database twins, Playwright-core browser journeys, custom verification gates.

## Development commands

Use the scripts already in `package.json`. Important commands:

- Run `npm run build` to create the production build.
- Run `npm run typecheck` to verify TypeScript types.
- Run `npm run lint` to check lint rules.
- Run `npm run format:check` to verify formatting.
- Run `npm test` to execute the unit and integration test suite.
- Run `npm run verify:full` to execute the complete verification matrix.
- Run `npm run audit:browser` to execute the browser audit journey.
- Run `npm run audit:online` to verify Online Intelligence behavior.
- Run `npm run audit:offline` to verify Offline Intelligence behavior.
- Run `npm run audit:usage` to verify usage accounting.
- Run `npm run identity:check` to verify identity-secrecy rules.
- Run `npm run content-storage:check` to verify storage rules.
- Run `npm run audit:secrets` to scan for leaked secrets.

GitHub Actions is optional; unavailable/red paid Actions are not product evidence. Equivalent verification still has to run through trusted local/agent execution.

## Architecture conventions

- One authority per responsibility. Do not create parallel stores, installers, routers, usage gates, auth systems, or model lifecycles.
- Supabase is canonical for durable signed-in account data.
- Offline model **bytes, chunks, checkpoints, model metadata and activation state use OPFS only**. Do not store model bytes/chunks in IndexedDB, Cache Storage, localStorage, the normal downloads folder, or a second browser cache.
- A non-model preference such as “the user explicitly removed Offline Intelligence” may live outside OPFS because it must survive deletion of the model itself.
- Verified model releases survive ordinary website deploys, refreshes, browser restarts, and sign-in cycles. A site update must not trigger a model redownload.
- Pending offline account work may use a separately encrypted local journal when required to survive restart; it is not model storage and it must reconcile exactly once.
- Manual Offline sends zero Online Intelligence provider traffic.
- Offline does not accept image input or claim image understanding.
- One successful logical answer is one use across Auto/Online/Offline and all devices. Failed delivery is zero uses.

## Product identity and secrecy

Normal product surfaces say only CARCC, OCADE, Auto, Online, Offline, and customer-safe capability language.

Never expose:

- Never expose provider, vendor or model names in ordinary customer surfaces.
- Never expose raw runtime names in ordinary customer surfaces.
- Never expose model file formats, OPFS, WebGPU, WASM, R2 or Supabase implementation vocabulary in the normal UI.
- provider keys, model source URLs, private bucket/object names, service-role credentials, secrets, stack traces, or internal deployment identifiers.

The real provider/model identity may exist only where technically unavoidable in tightly scoped server-only secret configuration or deployment integration. Keep it out of the browser bundle and public repository documentation whenever configuration can carry it instead.

## Authentication

Target product methods are Google, six-digit email OTP, and password sign-in. MFA is optional for ordinary customers and required for privileged/admin operations. Never expose whether an email exists through unsafe auth copy.

## Current commercial rules

- Free: 28 successful uses / 6h28m, no weekly cap.
- The Pro tier allows 140 successful uses per 6h28m window and 700 per week.
- The Max tier allows 1,400 successful uses per 6h28m window and 7,000 per week.
- Anchor usage windows to the account.
- Use the same allowance across all devices and intelligence modes.
- Current catalogue remains Free / Pro / Max with weekly and monthly paid cadences.
- Paid checkout is **not open now**. Do not add or revive Paddle. Upgrade must clearly say paid plans are not open and must not charge anyone.

## Security requirements

- Enforce RLS and server-side authorization for user-owned data.
- Never trust client user ids, entitlement, usage, MIME type, model readiness, or privileged role claims.
- Treat every uploaded file and extracted text as hostile input.
- Admin is role-gated and hidden from ordinary users.
- Custom grants are owner/admin-only, audited, expiring, and require privileged authorization.
- Sessions/devices are visible and revocable.
- No direct client mutation of security-sensitive device or entitlement fields.

## UI rules

- Keep the interface dark, premium, minimal and inspired by the interaction density of leading AI chat products.
- Use restrained glass effects and avoid card-wall or dashboard clutter.
- Keep full product capability across desktop, tablet and phone with responsive interaction patterns.
- Hide implementation details.
- Every async state must terminate in success, empty, error/Retry, cancellation, or genuine progress.
- Current repository Grok reference screenshots live in `docs/design-references/grok/`.

## Testing requirements

Reproduce before fixing when safe. Add a regression that fails on the old behavior. Then run the smallest relevant tests, broader gates, browser journeys, and `verify:full` as appropriate.

For release-grade QA, use real browser control with disposable test data to test every reachable page, button, menu, setting, error state, Auto/Online/Offline, account switching, usage, devices, model install/remove/reinstall/resume, mobile layouts, and security boundaries. Do not call an unperformed real-device/provider/payment test “passed.”

## Forbidden changes

- Do not modify `PLAN.md` unless explicitly requested.
- Do not reintroduce CADANE branding.
- Do not expose provider/model/vendor identity to customers.
- Do not add Paddle or a live payment checkout while paid plans are closed.
- Do not add current-scope Projects, Tasks, Automations, Monitors, Organizations, Code, or native apps.
- Do not add a second model store or store Offline model chunks outside OPFS.
- Do not weaken security, validation, accessibility, usage accounting, or tests to reduce code.
