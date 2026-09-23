# OCADE Testing Strategy

## Philosophy

Test the product at the layer where customers experience it. A unit test can prove a function; it cannot by itself prove production Chat, a real provider response, RLS, model installation or mobile browser behavior.

Every bug fix should have a regression that would have failed before the fix.

## Test stack

Use the repository's existing:

- Use Vitest for unit and integration testing.
- Use PGlite and database-twin suites for database behavior checks.
- Use TypeScript typechecking to catch contract and typing errors.
- Use ESLint and Prettier checks for code quality and formatting.
- Use the custom security, content, reachability and storage gates.
- Use Playwright-core browser journeys for real UI flow verification.
- Use a production build and Worker preview for release-like browser verification.

## Unit tests

Use for pure policy and state machines:

- Unit-test usage-window calculations and resets.
- Unit-test intelligence routing and fallback decisions.
- Unit-test Offline installer state transitions.
- Unit-test model download plans and checkpoint logic.
- Unit-test MIME and file validation.
- Unit-test authentication and session-failure classification.
- Unit-test pricing rules and approved price formatting.

## Integration tests

Use for:

- Integration-test Chat send, regenerate and delete persistence.
- Integration-test account switching and state isolation.
- Integration-test usage permits and settlement.
- Integration-test Library upload and delete behavior.
- Integration-test Offline allocation and device flows.
- Integration-test notification preference and history synchronization.
- Integration-test admin grant creation, validation and revocation.

## Database tests

Real PostgreSQL-compatible tests must cover:

- Database-test row-level security and privilege boundaries.
- Database-test security-definer functions and their authorization checks.
- Database-test cross-account isolation.
- Database-test concurrent device-cap registration.
- Database-test idempotent usage accounting.
- Database-test atomic destructive mutations.
- Database-test admin authorization.

## Browser/E2E

Use real browser control against safe disposable data.

Test every reachable current:

- Exercise every reachable page.
- Exercise every reachable button.
- Exercise every reachable menu.
- Exercise every reachable dialog.
- Exercise every reachable setting.
- Exercise every reachable link.
- Exercise every reachable loading, empty, error and Retry state.

Critical journeys:

- Exercise Google, email OTP and password authentication as implemented.
- Exercise Send, Stop, Edit, Regenerate, Retry and Delete.
- Exercise Temporary Chat and prove that it does not persist.
- Exercise highlight-to-Ask-OCADE behavior when implemented.
- Exercise attachment and Library flows.
- Exercise Auto, Online and Offline independently.
- Exercise usage exhaustion and reset behavior.
- Exercise session and device revocation.
- Exercise the admin grant flow.
- Exercise model install, remove and reinstall.
- Exercise mobile, tablet and desktop layouts.

## Online Intelligence proof

A real Online test requires evidence that the server boundary produced the response. Customer/browser evidence must not expose the real provider/model name.

Test:

- Prove a successful real Online response stream.
- Prove the pre-output Online failure path.
- Prove that fallback does not occur after meaningful Online output.
- Prove Online timeout and cancellation behavior.
- Prove exactly-once usage accounting for Online requests.
- Prove that customer-facing Online behavior leaks no provider or model identity.

## Offline proof

Real hardware/browser proof should cover:

- Prove the first Offline install from an empty browser profile.
- Prove that model bytes, chunks, checkpoints and model metadata live only in OPFS.
- Prove model interruption and resume behavior.
- Prove model persistence across refresh and browser restart.
- Prove that an ordinary website deploy does not redownload an unchanged Offline release.
- Prove that Remove verifies OPFS deletion before reporting success.
- Prove that Removed state suppresses automatic reinstall.
- Prove explicit Offline reinstall after removal.
- Prove the supported acceleration path and fallback behavior where the hardware permits it.
- Prove that manual Offline produces zero Online provider traffic.
- Prove that Offline image input is refused.

Do not call Safari/iOS/Android support proven until tested on the real environment.

## Storage tests

Identity/storage gate must fail if model bytes/chunks appear in IndexedDB, Cache Storage, localStorage or a second runtime cache.

Pending unsynced account work is a separate encrypted journal and must not be confused with model storage.

## Responsive/accessibility

At minimum exercise 360/375 px phone, tablet and desktop layouts:

- Confirm there is no horizontal overflow.
- Confirm that all controls remain reachable.
- Confirm keyboard navigation and focus behavior.
- Confirm accessible labels and dialog semantics.
- Confirm reduced-motion behavior.
- Confirm readable contrast.

## Security/privacy

Test:

- Test cross-account isolation.
- Test that forbidden direct database mutations are rejected.
- Test revoked sessions and devices.
- Test malicious file types and hostile file content.
- Test open-redirect resistance, canonical-host behavior and HTTPS enforcement.
- Test the Content Security Policy.
- Run provider and model identity scans.
- Run client-bundle secret scans.
- Confirm that customer-facing errors are sanitized and safe.

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

- Confirm that the exact reconciled tree was tested.
- Confirm that no known repository-controlled Critical or Major launch blocker remains.
- Confirm that all relevant regressions are green.
- Confirm that all current browser flows are green.
- Confirm that source and deployment parity was checked.
- remaining real-device/provider/payment limitations listed rather than marked passed.
