/caveman ultra
/ponytail ultra

## Mandatory MCP execution and real-user verification

MCP testing is mandatory throughout the OCADE implementation mission. Do not merely mention the MCPs, inspect their configuration, or substitute ordinary unit tests for them. Actually invoke and use every relevant available MCP repeatedly during implementation, verification, adversarial testing, cleanup, and final release testing.

At the beginning of every implementation session, perform an MCP health check. Verify that the required MCP servers are connected, that each intended browser/device/desktop target is visible, and that the MCP can perform a minimal safe read-only operation. Record unavailable MCPs as BLOCKED with the exact reason, but continue every independent test that remains possible.

Use MCPs as real users would use OCADE. Open the actual UI, click visible controls, type into inputs, navigate between pages, resize windows, refresh, use back/forward, switch accounts, switch conversations, connect/disconnect devices, trigger tasks, interrupt tasks, use Stop, Take Over and Co-work, close/reopen the app, restart relevant processes, and verify the resulting screen, process, file, database and deployment state.

Do not consider a feature verified only because a unit test, source inspection, mocked test or custom script passes. When an applicable MCP exists, that feature must also receive the applicable MCP evidence before it is marked complete.

Use the MCP team frequently during coding, not only once at the end. After each meaningful feature or bug-fix group, run the relevant MCP test, observe the result on-screen, inspect failures, fix the root cause, and run the same MCP test again. Continue this loop until there are no known or reproducible bugs in the tested scope.

Use one active controller for one surface at a time. Other MCPs may observe or verify sequentially, but must never fight over the same browser, Windows desktop, emulator or mobile device.

Use the MCPs at maximum useful depth rather than as ceremonial checks. Exercise normal paths, failure paths, loading states, empty states, stale state, retries, refresh, restart, cancellation, permission revocation, network failure, session expiry, multiple tabs, multiple accounts, multiple devices, repeated actions, rapid actions, malformed state and recovery.

After PLAN.md implementation is complete, perform a dedicated full-product MCP verification wave. After Caveman Ultra and Ponytail Ultra simplify and debloat the codebase, perform the complete MCP verification wave again to prove cleanup introduced no regression.

Never claim that hidden bugs are mathematically zero. The completion target is zero known or reproducible bugs in the tested scope, zero known Critical or Major release blockers, and no unexplained failure from an available required MCP.

## Configured MCP server reference

The expected local MCP server configuration includes these authorities. If they are already connected in Claude, use the connected MCP directly and do not launch duplicate server processes. If a server fails its health check, use these configured launch definitions to diagnose the connection.

`playwright-real-chrome` uses:

`cmd /c npx -y @playwright/mcp@latest --extension`

`chrome-devtools-real-chrome` uses:

`cmd /c npx -y chrome-devtools-mcp@latest --autoConnect`

`playwright-ios-webkit` uses:

`cmd /c npx -y @playwright/mcp@latest --browser webkit --mobile`

`playwright-webkit-desktop` uses:

`cmd /c npx -y @playwright/mcp@latest --browser webkit`

`playwright-android-mobile` uses:

`cmd /c npx -y @playwright/mcp@latest --browser chrome --mobile`

`playwright-firefox` uses:

`cmd /c npx -y @playwright/mcp@latest --browser firefox`

`playwright-edge` uses:

`cmd /c npx -y @playwright/mcp@latest --browser msedge`

`appium-mobile` uses:

`cmd /c npx -y appium-mcp@latest`

with the configured long timeout and `NO_UI=true`.

`mobile-mcp` uses:

`cmd /c npx -y @mobilenext/mobile-mcp@latest`

`physical-computer-use` uses:

`cmd /c npx -y @qwen-code/open-computer-use mcp`

The Filesystem MCP remains the local file/artifact authority using its currently configured allowed directories.

Do not confuse MCP server startup commands with test execution. Starting an MCP server is not evidence that testing occurred. Claude must actually invoke that MCP's tools, interact with the relevant browser/device/desktop surface, capture the resulting evidence, fix failures and rerun the same test.

## Required MCP test matrix

Use `playwright-real-chrome` frequently as the primary real-browser actor. Test the actual OCADE site and JARVIS UI exactly as a customer would use them. Test sign-in, sign-out, account switching, conversations, JARVIS tasks, Devices, Allowed Apps, Settings, Help, usage states, permissions, Stop, Take Over, Co-work, reload, back/forward, multiple tabs, responsive layouts, errors and recovery. Do not limit this MCP to one happy-path journey.

Use `chrome-devtools-real-chrome` alongside the browser testing as the browser diagnostic authority. Inspect console errors, failed requests, network timing, storage, cookies, service workers, memory, performance, authentication state and runtime warnings. A visually successful Playwright journey does not override DevTools evidence of errors.

Use `playwright-edge` for an independent Microsoft Edge pass of the important customer journeys and JARVIS/browser workflows.

Use `playwright-firefox` for an independent Firefox compatibility pass of all applicable web functionality.

Use `playwright-webkit-desktop` for desktop WebKit compatibility and use `playwright-ios-webkit` for iPhone/Safari-like web compatibility. These are browser-compatibility tests and must never be falsely reported as physical macOS or physical iPhone evidence.

Use `playwright-android-mobile` repeatedly for Android-class mobile Chromium, responsive layout, PWA/web interaction, touch-sized controls, scrolling, keyboard behavior, viewport changes, permission/error screens and JARVIS Remote PC web behavior.

Use `physical-computer-use` for real Windows on-screen testing. Test the actual Windows desktop rather than only source code. Verify Device Agent launch, duplicate-process prevention, tray presence, tray menu actions, STOP from the tray, mini-control behavior, app discovery, opening classic and Store/UWP apps, File Explorer interactions, selected-workspace behavior, restart/recovery, Exit, process termination and every Windows capability that exists in the shipped scope. Verify the actual physical result after JARVIS says an action succeeded.

The Windows tray must receive dedicated tests. Start the Device Agent, prove exactly one tray instance exists, open the tray menu, test status changes, test STOP while a real action is running, test Exit, restart the agent, verify tray recovery, test duplicate launches, test offline/reconnect states, and confirm tray controls remain responsive while an action is executing.

Use `appium-mobile` as the primary Android OS-level automation authority whenever an Android emulator or device is available. Test install, launch, onboarding, permissions, accessibility where applicable, notification access where applicable, overlay/bubble behavior where implemented, task control, orientation, background/foreground transitions, restart, uninstall and reconnect.

After the Appium pass, release control and use `mobile-mcp` as an independent second Android verification pass. Repeat the critical flows independently instead of merely accepting Appium's result.

Use `filesystem` to verify generated files, workspace boundaries, file content, outputs, cleanup, install artifacts and that OCADE did not write outside permitted locations.

Use `Supabase` tooling for real database/Auth/RLS/backend verification. Test account isolation, device ownership, conversation ownership, task ownership, usage accounting, permissions, stale/revoked sessions and attempts by one test account to access another test account's records.

Use `Cloudflare Developer Platform` tooling to verify the actual deployed Worker/site revision, routes, runtime configuration, headers, production behavior and deployment/source SHA after a release.

Use `Sentry` to inspect production/runtime incidents after major browser/device test waves and before final completion. Investigate new relevant errors rather than simply reporting that Sentry was checked.

Use GitHub as the source-control authority. Confirm exact base SHA, working branch, changed files, tests, commits, merge state and final `main` SHA. Do not overwrite or lose unfinished local work merely to make the branch appear clean.

Use multiple test accounts for authentication and isolation tests. At minimum, test Account A and Account B separately, then switch between them and deliberately attempt cross-account access. Test conversation isolation, device isolation, permissions, cached state, drafts, task results, usage accounting, sign-out cleanup, stale tokens, refresh, multiple tabs and account switching. No state belonging to Account A may become visible or executable under Account B.

When an MCP exposes a failure, do not bypass it or mark it as a test problem without proof. Reproduce the failure, classify it, repair the root cause, rerun the same MCP, run nearby integration tests, attempt to break the repair, then continue the wider regression.

For every major implementation wave, use this sequence: code or repair the feature, run targeted local tests, invoke the applicable MCP on the real interface, inspect on-screen behavior and diagnostics, fix every reproducible defect, rerun the MCP, run an independent verifier where available, and only then move to the next wave.


# OCADE Claude Instructions

## First action of every session

Before reading, planning, editing, debugging, reviewing, testing, resuming after compaction, or continuing an interrupted task, run **/caveman ultra** and **/ponytail ultra** by default. Treat them as the default engineering posture for simplification, cleanup awareness, and unnecessary-complexity detection; destructive cleanup still requires proof that the replaced behavior is working and must obey `ToRemove.md`.

Then read AGENTS.md, the current owner request, PLAN.md, docs/MEMORY.md, and only the relevant canonical documents.

## Active mission

The active mission is the OCADE JARVIS web integration defined in PLAN.md.

OCADE Chat remains protected and must keep working. OCADE JARVIS is a separate Online-only product surface at /ocade-jarvis.

The original JARVIS ZIP and immutable extracted source are preservation artifacts. Never delete, rewrite, rename, format, dependency-upgrade, or Ponytail-debloat them.

The working extracted JARVIS runtime is the primary engine. Preserve its useful functionality, replace the active old GUI with the new OCADE JARVIS web GUI, remove active manual provider-key entry/plaintext provider-key configuration, and wire the runtime to OCADE's approved Online intelligence authority.

## Execution doctrine

Work independently from evidence. Inventory and continue directly into implementation rather than stopping after documentation unless a real owner-only action is required.

Use one authority per responsibility. Prefer wiring and reuse over duplicate implementations. Apply Ponytail/YAGNI/KISS aggressively to new production integration code only after behavior is proven.

Keep browser control as the first deep JARVIS control capability. Integrate Playwright/Playwright-MCP capability, use structured DOM/accessibility information before visual/coordinate fallback, re-observe after layout or viewport changes, and never trust stale coordinates.

Do not claim deep computer/mobile control as complete until later phases are actually implemented and tested.

## Product invariants

- CARCC is the company and OCADE is the product.
- Chat and JARVIS are separate experiences.
- JARVIS is Online-only.
- JARVIS has separate usage accounting from Chat.
- Signed-out users may view JARVIS, but execution requires sign-in.
- Normal questions may be answered normally; explicit work requests become tasks.
- Purchases are prohibited.
- Sensitive submissions require confirmation.
- The orb GUI is data-driven, responsive, accessible, and minimal.
- Voice provides explicit Interrupt, Pause, Continue, and End controls.
- The original generic plugin subsystem remains preserved but unused.
- The old phone dashboard remains preserved but is not the final active remote-control architecture.

## Completion rule

Run targeted tests and the full OCADE verification matrix on the exact reconciled tree. Perform an adversarial browser pass. Report live proof, browser proof, local proof, database proof, blocked cases, and untested cases separately.

Never hide a failure, deployment mismatch, untested capability, security risk, or regression.


## Current JARVIS continuation authority

For any JARVIS work after the completed web/browser mission, read `docs/JARVIS_DEVICE_ROADMAP.md` and PLAN.md Phases 13–23 before editing.

Preserve the proven Phases 0–12 baseline. The latest UI reference is `imports/UI OCADE JARVIS.zip` and must remain untouched.

Do not guess unsupported mobile/desktop capability. Implement, test and label evidence honestly.

## Owner-approved continuation — 2026-09-28

Read the new authorities before making product changes:

- `docs/COMPANY_PRODUCT_AUTHORITY.md` defines the company-scale product direction.
- `docs/JARVIS_DESIGN_SYSTEM.md` defines the clean Claude/ChatGPT/Grok-inspired OCADE design system and JARVIS orb identity.
- `docs/OWNER_ADMIN_BACKEND.md` defines owner/admin/staff operations.
- `docs/BILLING_AND_GLOBAL_COMMERCE.md` defines plans, payment, country, refund, and global-commerce behavior.
- `docs/MOBILE_DEVICE_CONTROL.md` defines Windows/macOS/Android/iPhone/iPad execution boundaries.
- `docs/TESTING_TOOLCHAIN.md` defines the current zero-extra-cost MCP/test team and how tools must coordinate.
- `docs/SUPPORT_LEGAL_SECURITY.md` defines Help, error handling, legal/privacy surfaces, and security UX.
- `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-01.md` is the detailed error ledger and Error Audit 02 is its executive summary.

Do not add a separate Code page or Projects page under the current direction. Keep the customer UI intentionally small and allow JARVIS to do complex work through conversation and device execution.

For the next implementation mission, reproduce current audit findings first, fix root causes, test with the strongest available runtime evidence, use Caveman and Ponytail only after replacements are proven, and merge product code only when Critical/Major release blockers are cleared for shipped capabilities.

Use each MCP/tool for its strongest evidence class. Playwright drives browser flows; DevTools diagnoses browser internals; Physical Computer Use handles native Windows UI; Appium and Mobile MCP run independent mobile passes; WebKit checks Apple-browser compatibility; GitHub/Supabase/Cloudflare/Sentry tools verify source/backend/deployment/incident state. Never have competing UI-control tools act simultaneously.

The design goal is a major debloat/rebuild where needed: minimal options, clean spacing, soft corners, skeleton loading, restrained glass, strong JARVIS orb/graph identity, truthful task progress, simple settings, first-party Help, and no visible implementation clutter.

## MCP team operating protocol — 2026-09-28

Before using any MCP or external control tool, read `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.

Act as a coordinated engineering team rather than launching every MCP at once. Assign one actor to each controlled surface and use other tools as observers or later independent verifiers. Playwright owns browser interaction, DevTools diagnoses it, Physical Computer Use owns real Windows native interaction, Appium owns the first Android pass, and Mobile MCP owns an independent second Android pass. Never let two active controllers fight over the same UI.

For long missions, checkpoint durable state before context compaction, restart, model fallback, or rate limits. Resume from the exact next unfinished item rather than restarting completed work. Continue independent tests when one MCP is blocked.

Every reproduced bug must enter the fix loop: reproduce, isolate root cause, add/update regression coverage, fix, targeted retest, integration retest, real browser/device/physical verification, adversarial break attempt, and broader regression. Keep iterating until the applicable release gates are green.

Do not stop after the first successful test. Continue testing, fixing, retesting, adversarial testing, cross-device checking, visual QA, restart/recovery testing, and performance validation until all discovered and reproducible bugs in the tested scope are removed, no known Critical or Major release blocker remains, and the product behaves consistently and feels extremely smooth, responsive, stable, and "liquid" in normal use.

After the functionality and safety gates are proven, run **/caveman ultra** and **/ponytail ultra** again to simplify ownership, consolidate duplicate systems, remove proven dead code, reduce unnecessary files/dependencies/branches/abstractions, improve naming and structure, and make the active production codebase leaner. This cleanup must never weaken UI quality, performance, security, accessibility, device control, or verified behavior. Immediately rerun the affected targeted tests and the broader regression matrix after cleanup.

Visual QA is mandatory. A DOM test cannot approve a visually clipped, crowded, badly spaced, overflowing, slow, or confusing interface.

Do not ask the owner to perform work that the connected tools can safely perform. Ask only for genuinely owner-only credentials, MFA/passkeys, OS security prompts, destructive approvals, signing/payment/legal decisions, or unavailable physical hardware interaction.

## Final default finish sequence

Before declaring any implementation mission complete, run **/caveman ultra** and **/ponytail ultra** again by default after the product behavior is proven.

Then perform the final sequence: verify every repaired bug, hunt for additional hidden/reproducible failures, test real browser/device/physical behavior where available, verify visual smoothness and loading/recovery states, simplify and debloat the active codebase, remove only proven dead/duplicate code, and rerun all affected regression gates.

Do not finish merely because the build passes. Finish only when the shipped scope has no known Critical or Major release blocker, all discovered/reproducible bugs in the tested scope have been resolved or explicitly blocked by a genuine owner-only/platform/hardware dependency, the UI and device-control flows are smooth and stable, cleanup has not caused regressions, and the production/deployment evidence matches the final source.
## Final mandatory MCP release gate

Do not declare OCADE complete immediately after PLAN.md implementation finishes.

First run the complete applicable MCP matrix against the finished implementation. Exercise OCADE on-screen as a hostile and ordinary real user, not only through source assertions. Search deliberately for visual bugs, interaction bugs, race conditions, stale states, account leaks, device-control failures, broken tray behavior, hidden errors, browser inconsistencies, responsive failures, recovery failures and security-boundary failures.

Fix every reproducible defect discovered by the MCP wave and repeat the affected MCP test until it passes. Then rerun the broader MCP regression because one repair may break another surface.

After this verification is green, run `/caveman ultra` and `/ponytail ultra` again. Simplify architecture, consolidate duplicate authorities, remove proven dead code, reduce unnecessary abstractions and dependencies, improve naming and structure, and make the production codebase substantially leaner without weakening behavior.

After Caveman/Ponytail cleanup, run the complete applicable MCP matrix again from the beginning. Test the real browser UI, DevTools diagnostics, cross-browser behavior, mobile web, real Windows desktop and tray, Android where available, filesystem effects, Supabase boundaries, Cloudflare production state and Sentry incidents.

Continue the cycle of MCP test → discover defect → root-cause fix → targeted MCP retest → adversarial test → regression until there are zero known or reproducible bugs in the tested scope and zero known Critical or Major release blockers.

A build passing, unit tests passing, one browser journey passing, or source inspection passing is never by itself sufficient to finish OCADE when stronger connected MCP evidence is available.