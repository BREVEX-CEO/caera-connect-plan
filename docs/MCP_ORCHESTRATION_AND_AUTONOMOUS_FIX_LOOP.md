# OCADE MCP Orchestration, Resilience, and Autonomous Fix Loop

## Purpose

This document defines how Claude and other coding/testing agents must use the large OCADE MCP/tool stack without creating tool conflicts, context exhaustion, duplicated work, false passes, or uncontrolled test loops. The goal is to make the toolchain behave like a disciplined engineering team rather than a collection of independent agents all trying to control the same environment.

## Core operating rule

- Every test run begins with an explicit tool-role assignment. One tool is the actor for a surface and other tools are observers or independent verifiers.
- Two tools must never type, click, scroll, drag, install, uninstall, or mutate the same foreground browser, desktop, emulator, or physical device at the same time.
- A tool may observe while another acts only when the observer is passive and cannot interfere with state.
- Every action that mutates code, infrastructure, browser state, device state, database state, or installation state must have a named owner and an evidence record.
- If two tools can test the same behavior, use them sequentially as independent verification rather than concurrently.

## Current MCP and tool roles

- `playwright-real-chrome` is the primary actor for repeatable real-Chrome customer journeys, signed-in flows, responsive browser tests, extension-facing web flows, task UI, and regression automation.
- `chrome-devtools-real-chrome` is the passive browser-debug authority for console errors, network failures, cookies, storage, service workers, performance, memory, request timing, and browser/runtime diagnostics.
- `playwright-ios-webkit` is an iPhone/Safari-like compatibility tester. Its results are emulation/browser-compatibility evidence only.
- `playwright-webkit-desktop` is the desktop WebKit compatibility tester. It does not prove native macOS Device Agent behavior.
- `playwright-android-mobile` is the mobile-Chromium compatibility tester for responsive/PWA behavior.
- `playwright-firefox` verifies Firefox-specific browser compatibility.
- `playwright-edge` verifies Microsoft Edge-specific browser compatibility.
- `appium-mobile` is the primary structured mobile automation authority for Android device/emulator testing and future supported Apple environments.
- `mobile-mcp` is the independent second mobile verifier for screenshots, element inspection, taps, swipes, keyboard input, app lifecycle, orientation, and supported install/uninstall/device actions.
- `physical-computer-use` is the primary actor for the real unlocked Windows desktop, including Settings, File Explorer, Task Manager, native applications, installers, uninstallers, tray interactions, mouse/keyboard, and physical-result verification.
- `filesystem` is used for controlled local file inspection and test artifacts. It is not a substitute for GitHub repository truth.
- GitHub connector remains the repository/branch/PR/merge authority.
- Supabase tooling remains the database/auth/RLS/RPC/storage/backend verification authority.
- Cloudflare tooling remains the deployed Worker/runtime/routes/headers/deployment authority.
- Sentry remains the incident/error monitoring authority where connected.
- Claude Computer/Remote Control may be used as an independent physical Windows verifier when it is not fighting another desktop-control actor.

## Tool health gate

Before a long test or fix run, the agent must validate tool health.

- Confirm that each required MCP starts successfully and returns a minimal read-only capability response.
- Confirm the target browser/device/emulator is visible to the intended actor.
- Confirm Playwright Real Chrome and DevTools are attached to the intended browser profile rather than different sessions.
- Confirm Appium and Mobile MCP can see the intended Android emulator/device before beginning Android tests.
- Confirm Physical Computer Use sees the current Windows desktop before native installer or tray testing.
- Confirm GitHub, Supabase, Cloudflare, and Sentry connections are available before relying on them as proof.
- If a tool is unhealthy, mark that evidence class blocked and continue all independent tests that do not require it. Do not stop the entire mission.

## Surface locking and conflict prevention

The agent must maintain a simple lock table for active test surfaces.

- A browser lock identifies which tool currently owns Chrome/Edge/Firefox/WebKit interaction.
- A desktop lock identifies which tool currently owns physical Windows input.
- A mobile lock identifies which tool currently owns BlueStacks, an Android emulator, or a physical mobile device.
- A repository lock identifies which branch/session owns writes.
- A database/infrastructure lock identifies which session owns schema or deployment mutations.
- A lock is released only after the step has reached a stable state and evidence is captured.
- Observers may read state while a lock is held only when they cannot alter the target.

## Context-window and long-run resilience

The project is too large to depend on one uninterrupted agent context. The work must be resumable.

- Maintain a durable implementation ledger in the repository that records current branch, exact main/base SHA, completed work, open findings, test results, blocked evidence, current tool health, and next unfinished step.
- Before context compaction, session restart, model fallback, or handoff, write the exact current state to the ledger.
- On resume, read the ledger, current Git status, current branch, latest main SHA, and relevant authority docs before doing new work.
- Never restart a completed audit section or repeat expensive tests merely because the model context changed unless a dependency changed or regression verification requires it.
- Large work is divided into bounded waves such as authority/security, browser, Windows, Android, Apple web compatibility, UI, admin/billing, full-site regression, cleanup, and final release.
- Each wave has explicit entry criteria and exit criteria.
- Summaries must preserve exact finding IDs, test totals, source SHA, environment, and blocked evidence so later sessions do not invent state.

## Rate-limit and usage resilience

- Tool/provider rate limits are expected operational constraints rather than reasons to abandon the mission.
- When a rate-limited tool fails, checkpoint current state, continue independent local tests, and retry the blocked tool later when allowed.
- Do not spam retries or create an uncontrolled loop.
- Model-context or provider limits must never cause completed work to be forgotten; the ledger is the continuity authority.
- A model fallback may continue the mission only after rereading the durable state and relevant authorities.
- No test result is upgraded from blocked to pass merely because a rate limit prevented verification.

## Autonomous test-fix-retest loop

Every reproducible defect follows the same loop.

1. Reproduce the problem on the latest relevant source/environment and record evidence.
2. Identify the root cause and shared authority responsible for the failure.
3. Write or update a targeted regression test before or alongside the fix where practical.
4. Implement the smallest safe root-cause repair without introducing duplicate systems.
5. Run targeted tests for the exact defect.
6. Run nearby integration tests for the affected subsystem.
7. Use the strongest available real browser/device/physical test for the behavior.
8. Deliberately attempt to break the fix using edge cases, stale state, concurrency, cancellation, permission changes, restart, network loss, and unexpected user input where relevant.
9. If the fix fails, record the new evidence and return to root-cause analysis.
10. When targeted evidence is green, run the broader regression slice for that subsystem.
11. Only then mark the finding fixed in the implementation ledger.
12. After several fixes in one subsystem, run a clean end-to-end pass to detect interaction regressions.

## Error hunting strategy

The agent must not wait for the user to identify every bug.

- Inspect browser console/network errors even when the visible UI appears correct.
- Inspect error monitoring for repeated production failures and correlate them with source versions.
- Search for stale TODO/FIXME/temporary code and verify whether it represents real unfinished behavior.
- Compare docs against current implementation and live behavior to find unimplemented or contradictory product requirements.
- Compare UI donor/reference behavior against active production implementation and remove fake/prototype-only behavior.
- Inspect state transitions for loading, empty, failure, retry, cancellation, resume, sign-out, account switch, device switch, permission revoke, browser back/forward, refresh, and concurrent tabs.
- Inspect packaging and install/uninstall paths for missing files, stale processes, duplicate agents, credentials left behind, failed rollback, and version skew.
- Inspect security boundaries for cross-account, cross-device, workspace escape, path traversal, symlink/junction, stale permissions, prompt injection, private-network access, DNS rebinding, stale screen coordinates, raw-shell confirmation, replay, and protocol skew.
- Inspect UI visually for overflow, clipped controls, poor spacing, inconsistent radius, weak hierarchy, unreadable contrast, excessive text, useless options, duplicate actions, slow loading, jank, and misleading status.
- Inspect the codebase for duplicate feature authorities, dead modules, misleading filenames, stale imports, unnecessary dependencies, giant mixed-responsibility files, and tiny low-value abstractions.

## Browser test sequence

- Use Playwright Real Chrome as the primary browser actor.
- Keep Chrome DevTools attached as the debugger/observer.
- Test Google sign-in, fallback auth where supported, account switching, expired tokens, refresh, sign-out, multiple tabs, back/forward, deep links, and reauthentication.
- Test JARVIS ordinary conversation, task creation, Stop, Take Over, Resume, device selection, permissions, usage, extension behavior, and recovery.
- Test private-network/DNS/redirect/subresource defenses at the browser-execution layer.
- Test extension owned-tab isolation and detach behavior.
- Repeat required compatibility journeys in Edge, Firefox, desktop WebKit, Android mobile Chromium, and iPhone-like WebKit.
- Keep browser tests deterministic. Do not let desktop-control automation move or click the browser during a Playwright-controlled step.

## Physical Windows test sequence

- Use Physical Computer Use as the primary desktop actor and Claude Computer/Remote Control only as an independent verifier when useful.
- Test clean install, repair/reinstall, startup/autostart, tray presence, duplicate-process prevention, settings/permissions, app inventory, classic apps, UWP/Store apps, files, terminal/workspace, browser handoff, multi-app tasks, Stop, Take Over, Co-work, update, failed update, rollback, Exit, uninstall, process termination, credential removal, and re-pairing.
- Verify actual windows/processes/files/settings after JARVIS claims success.
- Test task interruption while an action is physically in progress.
- Test user mouse/keyboard takeover behavior.
- Test multiple monitors/DPI if hardware exists; otherwise mark the evidence blocked.

## Android test sequence

- Use Playwright Android Mobile for web/PWA compatibility.
- Use a zero-cost Android environment such as BlueStacks or another free emulator for Android OS-level testing.
- Use Appium Mobile as the primary actor for one Android test pass.
- Release the mobile lock, reset to a known state, then use Mobile MCP for an independent second pass of the critical flows.
- Test direct companion install flow, permission guidance, overlay/floating bubble, accessibility/UI control, notification access where used, app launch, contacts/calls/messages where safe, gallery/file/share/import flows, background task state, orientation, keyboard/composer, low-memory conditions where configurable, slow network, PWA install/resume, Stop, uninstall, and reinstallation.
- Android system permission/security prompts are expected boundaries. The product should guide the user rather than bypass them.

## Apple-platform evidence

- Playwright iOS WebKit tests iPhone/Safari-like web compatibility only.
- Desktop WebKit tests Safari/WebKit compatibility only.
- Native macOS Device Agent, TCC, signing/notarization, real iPhone/iPad PWA lifecycle, and native iOS helper behavior require legitimate Apple hardware/environment evidence.
- If real Apple hardware is unavailable, continue all source/browser compatibility work and mark native evidence blocked.
- Do not create a fake pass or claim that WebKit emulation proves native Apple behavior.

## Visual and UI regression

- Test the product at desktop, tablet, 360px/375px phones, Android-like mobile, iPhone-like WebKit, dark theme, light theme, reduced motion, keyboard-only navigation, and loading/error/empty/permission/limit states.
- Capture before/after screenshots for material UI changes.
- Compare spacing, hierarchy, scrollbars, skeletons, composer, sidebar, settings, task progress, orb/graph, admin dashboard, Help, and billing states.
- A visually incorrect result is a bug even when DOM assertions pass.
- Do not rely on a single screenshot size to approve responsive behavior.

## Build/package verification

- Validate deterministic extension build/package and minimum-permission manifest.
- Validate Device Agent package contains every runtime resource and dependency.
- Validate installer/uninstaller lifecycle on a clean or disposable environment where possible.
- Validate version metadata and protocol compatibility.
- Validate update artifacts, signature/trust configuration, health check, rollback, and stale-version behavior.
- Validate Android companion package/install path when implemented.
- Never claim public signing/notarization proof without the required real credentials/environment.

## Cleanup loop

Cleanup occurs only after functionality is proven.

- Run Caveman to simplify ownership, routing, state, abstractions, and unnecessary complexity.
- Run Ponytail to remove proven dead code, duplicate code, stale dependencies, obsolete files, and prototype scaffolding.
- Never modify immutable donor/import snapshots.
- After cleanup, rerun the same targeted tests and a broader regression slice.
- If cleanup breaks a working behavior, restore the required behavior and simplify again rather than keeping the regression.

## Final release gate

A release candidate can merge only when all of the following are true.

- No known Critical or Major release blocker remains for a capability that will be shipped or publicly claimed.
- All required targeted regression tests are green.
- Relevant browser/device/physical evidence is green or the unavailable capability is disabled and clearly not claimed.
- Build, typecheck, lint, formatting, dependency/security checks, protocol tests, and database/backend checks are green.
- UI regression and accessibility checks are green.
- The codebase has completed a cleanup/debloat pass and the post-cleanup tests are still green.
- Documentation, code, database, deployed behavior, and public product claims agree.
- Production deployment identity matches the merged main revision.
- Remaining Medium/Small/Minor findings are explicitly recorded with risk/owner and are not silently forgotten.

## Final principle

The agent should keep fixing and retesting until the defined release gates are satisfied or a genuinely owner-only/hardware/legal/payment/signing dependency blocks further proof. It must not stop merely because one tool failed, a context window changed, a rate limit occurred, or one pass was green. It must also not claim mathematical zero bugs; it must produce evidence for no known release blockers within the tested scope.
