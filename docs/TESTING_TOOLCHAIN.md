# OCADE Autonomous Testing Toolchain and Evidence Matrix

## Principle

The development team should behave like a coordinated engineering organization. Each connected testing tool has a defined job. Tools must not fight over the same mouse, browser, emulator, device, or state at the same time.

MCPs and external automation are test instruments. They do not become the customer runtime or replace OCADE's Device Agent/mobile companion.

## Zero-extra-cost rule

- The active development/test plan should prefer free, open-source, locally available, or already-included tools.
- BrowserStack or another paid/trial-only real-device service is not a required authority and should be removed from the mandatory toolchain when it requires payment.
- If a legitimate free real-device/Mac service is available temporarily, it may add evidence but must not become a dependency required for CI or release correctness.

## Current MCP/test stack

- Playwright Real Chrome performs real Chrome customer journeys, authenticated flows, extension interactions where supported, layout checks, task/control workflows, and repeatable browser regression.
- Chrome DevTools MCP inspects console errors, network failures, storage, cookies, service workers, performance, memory, and browser/runtime diagnostics.
- Playwright iOS WebKit provides iPhone/Safari-like web compatibility evidence on Windows. It does not count as real iPhone hardware proof.
- Playwright WebKit Desktop provides desktop WebKit compatibility evidence. It does not count as native macOS Device Agent proof.
- Playwright Android Mobile provides responsive/mobile Chromium compatibility evidence.
- Playwright Firefox provides Firefox compatibility evidence.
- Playwright Edge provides Microsoft Edge compatibility evidence.
- Appium Mobile is the primary structured mobile/device automation authority for Android and later supported Apple environments.
- Mobile MCP is an independent second mobile tester for screenshots, UI inspection, taps/swipes, app launch/stop/install/uninstall, orientation, and supported device/emulator control.
- Physical Computer Use controls the real unlocked Windows desktop for installers, uninstallers, Settings, tray/menu interactions, native apps, File Explorer, Task Manager, mouse, keyboard, screenshots, and physical-result verification.
- Filesystem MCP provides controlled local file access for test artifacts and project/workspace inspection where permitted.

## Connected platform/service tools

- GitHub connector is the repository/source/branch/PR authority.
- Supabase tooling is used for database schema, migrations, RLS, authentication, RPC, storage, task/device/permission state, and backend verification.
- Cloudflare tooling is used for deployed Worker/runtime identity, routes, headers, environment, and deployment verification.
- Sentry or the selected error-monitoring boundary should group production issues into understandable incidents without exposing secrets.
- Claude Computer/Remote Control may independently verify physical Windows results, but it should not click simultaneously with another physical-computer controller.

## Coordination

- One tool is designated the actor for a test step and another may be the verifier.
- Playwright and physical computer control must not both type/click into the same foreground browser at the same time.
- Appium and Mobile MCP should run independent passes or distinct steps, not simultaneously drive the same Android UI.
- DevTools observes/debugs browser state while Playwright is the primary browser actor.
- Physical Computer Use performs native Windows installation/tray/app/system actions while Playwright verifies the website and DevTools verifies browser internals.
- A failed subsystem does not stop unrelated test suites. Continue independent tests and report blocked dependencies separately.

## Test order

- Start with JARVIS core authority, security, task state, permissions, STOP, action broker, workspace boundaries, browser safety, and device identity because these are current release blockers.
- Test the Windows Device Agent physically on Windows, including install, enrollment, tray, startup, task execution, Stop, Take Over, Co-work, update, rollback, exit, uninstall, process termination, credential removal, reinstall, and re-pairing.
- Test the Chrome extension lifecycle, including build/package, install/unpacked test profile where appropriate, authorization, owned tabs, revoke, disable/re-enable, browser restart, update, and unrelated-tab protection.
- Test Android using Playwright mobile Chromium for web/PWA compatibility, BlueStacks or another free emulator for OS-level Android evidence, Appium as primary automation, and Mobile MCP as an independent cross-check.
- Test iPhone/iPad web behavior through WebKit compatibility. Real iPhone/iPad claims remain blocked until legitimate physical Apple hardware or an equivalent real-device environment is available.
- Test macOS web behavior through desktop WebKit. Native macOS agent/installer/TCC claims remain blocked until legitimate real macOS evidence exists.
- After JARVIS/device paths are stable, run the full OCADE site regression across Chat, Offline Intelligence, Library, Settings, authentication, billing, support/legal pages, admin access boundaries, responsive layouts, accessibility, and production deployment.

## Real physical Windows matrix

- Verify installer launch and clean completion.
- Verify the expected OCADE tray presence and no duplicate agents.
- Verify startup/autostart configuration.
- Verify browser/device pairing and unique device identity.
- Verify Calculator, classic apps, Store/UWP apps, files, selected workspaces, terminal boundaries, browser work, and multi-application tasks.
- Verify STOP during an active physical action rather than only between actions.
- Verify user physical input causes the defined pause/takeover behavior.
- Verify Co-work mode intentionally arbitrates control.
- Verify update success and rollback after a simulated failed health check.
- Verify uninstall stops processes before removing files/credentials.
- Verify reinstall produces the intended identity/recovery behavior without stale duplicate authority.

## Android matrix

- Verify direct companion install flow in a free test environment.
- Verify permission guidance, overlay/bubble state, accessibility/UI control, notifications where supported, file/gallery flows, share/import flows, app launch, contact/message/call intent behavior, background task state, orientation, low-memory, slow-network, keyboard/composer, and PWA install/resume behavior.
- Verify Android system prompts are handled honestly rather than bypassed.
- Verify a second mobile automation stack can reproduce the key outcomes independently.

## Browser matrix

- Verify Google sign-in, fallback sign-in, account switching, stale token refresh, sign-out cleanup, multiple tabs, back/forward, reload, deep links, and expired/rejected sessions.
- Verify real Chrome first, then Edge, Firefox, and WebKit compatibility.
- Verify service-worker/PWA states and storage behavior.
- Verify private-network/DNS/redirect/subresource controls for JARVIS browser execution.
- Verify CAPTCHA, OTP, passkey, UAC, payment authorization, and other human security boundaries are not bypassed.

## UI/UX matrix

- Verify desktop, tablet, Android phone, iPhone-like WebKit, and narrow 360–375px layouts.
- Verify clean sidebar collapse/expansion, composer growth, skeletons, loading, empty states, errors, permissions, usage near limit, locked limit, settings, Help, owner/admin responsive behavior, and no horizontal overflow.
- Verify dark/light themes, keyboard navigation, focus visibility, contrast, reduced motion, scrollbars, screen-reader semantics where applicable, and touch targets.
- Verify no page accumulates redundant options or explanatory text that belongs in Help.

## Security/adversarial matrix

- Attempt cross-account, cross-conversation, cross-device, stale-result, replay, duplicate-send, cancellation, race, workspace escape, symlink/junction escape, command-confirmation bypass, permission-revocation race, prompt-injection, DNS rebinding, private redirect, stale-screen coordinate, debugger attachment leakage, enrollment abuse, and protocol-version skew.
- Re-run relevant security tests after every authority or execution change.
- Never count source-visible behavior as a pass until the required runtime/deployed result is observed.

## Cleanup and regression

- After functional/security repair, run Caveman and Ponytail on active production code only.
- Use Caveman to simplify ownership, routing, abstractions, and unnecessary complexity.
- Use Ponytail to remove proven dead/duplicate code, stale dependencies, obsolete files, and accidental bloat.
- Never clean immutable donor/import snapshots.
- Cleanup is followed by the same targeted tests because simplification can introduce regressions.

## Release gate

- Do not merge product implementation to main merely because it compiles.
- The final implementation branch must have no known Critical or Major release blocker for the capabilities being shipped.
- Build, typecheck, lint, formatting, dependency/security checks, unit/integration/protocol tests, browser/device journeys, security tests, and deployment verification must be green or explicitly blocked with the affected public capability disabled.
- Verify the deployed production source identity matches the merged main revision before declaring release completion.
