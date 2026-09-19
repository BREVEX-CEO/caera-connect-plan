# OCADE Testing Strategy

## Philosophy

Test the product at the layer where customers experience it. A unit test can prove a function; it cannot by itself prove production Chat, a real provider response, RLS, model installation or mobile browser behavior.

Every bug fix should have a regression that would have failed before the fix.

## Test stack

Use the repository's existing:
- Vitest;
- PGlite/database twin suites;
- TypeScript/typecheck;
- ESLint/Prettier checks;
- custom security/content/reachability/storage gates;
- Playwright-core browser journeys;
- production build/Worker preview.

## Unit tests

Use for pure policy and state machines:
- usage windows;
- routing/fallback;
- installer transitions;
- download plans/checkpoints;
- MIME/file validation;
- auth/session classification;
- pricing rules.

## Integration tests

Use for:
- Chat send/regenerate/delete persistence;
- account switching;
- usage permits/settlement;
- Library upload/delete;
- Offline allocation/device flows;
- notification sync;
- admin grants.

## Database tests

Real PostgreSQL-compatible tests must cover:
- RLS/privileges;
- security-definer functions;
- account isolation;
- concurrent device-cap registration;
- idempotent usage;
- atomic destructive mutations;
- admin authorization.

## Browser/E2E

Use real browser control against safe disposable data.

Test every reachable current:
- page;
- button;
- menu;
- dialog;
- setting;
- link;
- loading/empty/error/retry state.

Critical journeys:
- Google/email OTP/password auth as implemented;
- Send/Stop/Edit/Regenerate/Retry/Delete;
- Temporary Chat;
- highlight → Ask OCADE;
- attachment/Library;
- Auto/Online/Offline;
- usage exhaustion/reset;
- session/device revoke;
- admin grant;
- model install/remove/reinstall;
- mobile/tablet/desktop.

## Online Intelligence proof

A real Online test requires evidence that the server boundary produced the response. Customer/browser evidence must not expose the real provider/model name.

Test:
- success stream;
- provider failure before output;
- no fallback after meaningful output;
- timeout/cancel;
- exactly-once usage;
- no identity leakage.

## Offline proof

Real hardware/browser proof should cover:
- empty-profile first install;
- OPFS-only bytes/chunks/checkpoints/metadata;
- interruption/resume;
- refresh/restart;
- ordinary website deploy does not redownload unchanged release;
- Remove verifies OPFS deletion;
- removed state suppresses auto install;
- reinstall;
- supported acceleration path and fallback where hardware permits;
- zero Online provider traffic in manual Offline;
- image input refused.

Do not call Safari/iOS/Android support proven until tested on the real environment.

## Storage tests

Identity/storage gate must fail if model bytes/chunks appear in IndexedDB, Cache Storage, localStorage or a second runtime cache.

Pending unsynced account work is a separate encrypted journal and must not be confused with model storage.

## Responsive/accessibility

At minimum exercise 360/375 px phone, tablet and desktop layouts:
- no horizontal overflow;
- reachable controls;
- focus/keyboard;
- labels and dialog semantics;
- reduced motion;
- readable contrast.

## Security/privacy

Test:
- cross-account isolation;
- direct forbidden DB mutations;
- revoked sessions/devices;
- malicious file types/content;
- open redirects/canonical host/HTTPS;
- CSP;
- provider/model identity scans;
- bundle secret scans;
- customer-safe errors.

## Mocking strategy

Mocks/stubs are for deterministic failure paths and unit logic. They are never substitute proof when the real boundary is available. Label evidence as live/browser, real local/database, stub/simulation, or unverified external.

## Test data

Use dedicated disposable accounts/files/devices for destructive QA. Never modify real customer data to prove a test.

## Required checks

Run affected tests first, then appropriate broader checks. Release-grade changes normally include:
- Run `npm run typecheck` to verify TypeScript types.
- Run `npm run lint` to verify lint rules.
- Run `npm run format:check` to verify formatting.
- Run `npm test` to execute the automated test suite.
- Run `npm run identity:check` to verify identity-secrecy rules.
- Run `npm run content-storage:check` to verify content and storage rules.
- Run `npm run audit:secrets` to scan for leaked secrets.
- Run every browser journey that exercises the changed behavior.
- Run `npm run verify:full` before release-grade completion.

## CI

GitHub Actions is optional because paid Actions availability is not assumed. A red/unavailable Actions card is not product evidence. Required verification must still run locally/through the agent/direct authorities.

## Definition of done

- exact reconciled tree tested;
- no known repository-controlled Critical/Major launch blocker;
- regressions green;
- current browser flows green;
- source/deployment parity checked;
- remaining real-device/provider/payment limitations listed rather than marked passed.
