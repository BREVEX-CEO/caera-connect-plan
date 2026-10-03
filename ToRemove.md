# OCADE Removal and Retirement Inventory

Read this file before destructive cleanup.

No item is removed merely because it looks old. Replacement behavior must be proven first, then targeted tests and the broader regression must pass.

## Never remove or rewrite

- `imports/ocade-jarvis/` preserved ZIP/import provenance.
- `imports/ocade-jarvis/source-original/` immutable donor snapshot.
- Historical audit documents under `docs/audits/`.
- Applied database migrations. Retire behavior with forward migrations.
- Protected Chat/Offline authorities that remain current.

## Active retirement targets

### Legacy browser bridge product path

Owner direction no longer permits a separate customer browser bridge/add-on dependency.

Retire the active browser-bridge directory, packaging/store material, device kind, service-control entries, UI copy, tests and runtime branches only after the replacement existing-browser path is proven with:

- existing Chrome/profile;
- CDP/DevTools/Playwright where available;
- accessibility/UI Automation;
- vision;
- PyAutoGUI fallback;
- STOP/Take Over;
- multi-tab;
- login-state handoff;
- private-network protection;
- regression across Chrome/Edge/Firefox/WebKit.

Use forward schema migration to retire obsolete browser-bridge kinds/controls. Do not rewrite old migrations or historical audits.

**Status 2026-10-01: removed.** Replacement proven: the Device Agent drives the person's own Chrome through Chrome's remote debugging (`ocade_existing_browser.py`, no add-on; proven on the owner's running Chrome in wave 1), JARVIS's own isolated browser otherwise, STOP/Take Over and multi-tab in the jarvis journey, private-network refusal, and the browsers matrix (Chromium, Firefox, WebKit). Removed: `extension/`, the `extension` device kind and its stop (migration `20261001092000_retire_browser_extension`; the stop now pauses phones, which had none), every UI branch, the Help answer and the Privacy wording. Production had no extension device.

### Windows floating mini-control

Owner direction is tray-only on desktop. The floating Windows mini-control is not part of the final desktop product.

Remove it from active packaging/runtime only after tray status/STOP/Pause-Resume/Open/Exit, active-task visibility and real Windows verification are complete.

The Android floating bubble remains required and is unrelated to this desktop retirement.

**Status 2026-09-29: removed.** Replacement proven on real Windows with the installed agent: one tray icon with truthful status (Ready/Working/Waiting for you/Paused/Stopping/Offline), STOP (command tree killed in under a second), Pause/Resume, work folder, Exit, autostart, duplicate-launch refusal, removal mid-action and uninstall/reinstall. `jarvis-runtime/ocade_mini.py` deleted and dropped from the package.

### Donor generic plugin product path

Do not expose or maintain a customer plugin marketplace/system from the donor.

Preserve immutable donor plugin files, but remove any duplicate active customer-facing plugin routing/configuration if it exists after proving all required first-party capabilities are routed directly through OCADE.

### Old donor GUI/runtime entry

Do not ship old donor desktop GUI/avatar/dashboard as the active product.

Preserve original files in the immutable snapshot. Remove duplicate active GUI entry points only after the OCADE web/tray/mobile replacements are proven.

### Direct provider-key/config handling

Remove active donor-style manual provider-key entry, plaintext provider-key configuration and direct provider-client dependence from device/runtime execution.

OCADE intelligence authority is server-side and provider identity remains hidden.

### Duplicate execution authorities

After donor consolidation, remove duplicate computer/browser/file/action implementations that are no longer authoritative.

One action broker must own validation/cancellation/dispatch. Keep specialized executors only where they provide real capability.

## Known cleanup candidates requiring explicit proof

- duplicate app discovery or alias authorities;
- duplicate file/path validation;
- obsolete task retry paths;
- stale protocol fields;
- old browser-bridge device/service-control state;
- dead mini-control assets/tests;
- prototype JARVIS GUI scaffolding;
- unused provider clients/config;
- duplicate reminder/background systems after OCADE Tasks owns them;
- unused plugin-loader paths;
- stale docs that conflict with `PLAN.md`.

## Legacy operator rows (remove after the new console is live on production)

`public.user_roles` rows with `role = 'admin'` are inert after migration `20260930093000_one_staff_authority`: `has_role` and the support-admin check read `public.ocade_staff`. They are kept only because the release still on production opens its admin screen by reading that row. Migration `20261001090000_staff_authority_only_in_the_console` is applied in the same release window (it makes the old screen's site session a customer session). Once the Owner/Staff Console release is deployed to production, a follow-up migration deletes them (`DELETE FROM public.user_roles WHERE role = 'admin'`) and drops the `has_role` non-admin branch if nothing uses `moderator`/`user` roles by then.

## Cleanup proof sequence

For each removal:

1. identify replacement authority;
2. reproduce old behavior or prove it is no longer desired;
3. prove replacement with targeted tests;
4. prove real MCP/device/browser behavior where applicable;
5. remove only the obsolete path;
6. rerun targeted tests;
7. run nearby integration tests;
8. run adversarial regression;
9. run broader product regression;
10. record the result in the implementation ledger.

Do not use cleanup as permission to weaken security, accessibility, UI quality or evidence.

## Master Phase 1–49 authority

Implementation order, phase entry/exit gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting are governed by the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves current working behavior, repairs gaps proven by current evidence, and continues sequentially through Phase 49. This document supplies domain-specific requirements and does not replace a phase gate.
---

# Owner cleanup addendum — 2026-10-02

This section adds new cleanup targets created by the universal-control architecture. It does not authorize immediate deletion. Every removal still requires the proof sequence above.

## Per-application controller proliferation

Search the active production runtime for application-specific controllers, aliases, branches, action types, scripts, duplicated selectors, duplicated permission logic, and UI code that exist only because a specific application was hard-coded instead of using the universal OCADE execution engine.

Do not remove a specialized path merely because it is application-specific. First identify the exact capability it provides, reproduce the behavior, prove that the universal planner/action broker plus dynamic documentation/API discovery, accessibility, vision, direct file manipulation, scripting, or fresh-coordinate fallback can deliver equal or better behavior, and prove STOP, permission, scope, verification, and recovery. Only then remove the redundant application-specific path.

Keep specialized adapters that still provide measurable reliability, fidelity, safety, performance, or platform integration that the universal engine cannot yet match. Route those adapters through the same canonical action broker rather than allowing them to become separate execution authorities.

## Duplicate browser-control infrastructure

Development MCP configuration is not product runtime architecture. Remove or avoid any active customer-facing requirement that asks customers to install or configure Playwright MCP, Chrome DevTools MCP, browser extensions, Appium MCP, or other developer tooling.

Keep the product-owned Device Agent/browser executor and whatever signed bundled runtime components it legitimately requires. If old runtime code exists solely to expose developer-style remote-debugging setup to customers, retire it after the replacement product-owned browser-control path is proven across existing authenticated Chrome, normal browser launch, browser restart, multi-tab/window, upload/download, STOP/Take Over, accessibility/vision fallback, and security boundaries.

Do not remove the MCP test configuration itself when it remains useful for development evidence. Test tooling and product runtime are separate concerns.

## Wake-model download remnants

The final wake model is bundled inside the signed OCADE Windows companion and Android application. After the bundled model path is proven, remove obsolete active runtime logic that downloads `Hey OCADE`, `Hey Jarvis`, openWakeWord model assets, or equivalent wake artifacts after customer installation.

Preserve immutable donor wake files in `source-original/`. Preserve provenance/licensing/build evidence. Remove only active duplicate download/install/check paths that conflict with the bundled OCADE-owned wake manifest.

The final active authority should use one model manifest/version/hash path for install, health, update, rollback, and wake startup. Do not retain a second donor installer that can claim readiness for a different phrase/model.

## Redundant app knowledge and static maps

Review giant application-name maps, per-app click coordinates, stale menu trees, copied documentation fragments, and one-off aliases. Keep compact safe aliases and capability metadata when they materially help discovery, but retire brittle static knowledge that duplicates what the universal app discovery/documentation/live-observation system can determine more reliably.

Never preserve stored screen coordinates as reusable application knowledge. Coordinates belong to one fresh observation only.

## Duplicate action and permission paths

The universal tool plane must have one validated action broker. Remove per-app or per-feature paths that perform direct mouse/keyboard/browser/files/command execution without the canonical account, device, task, permission, confirmation, control lease, cancellation, STOP, idempotency, scope, and result-verification checks.

If an older helper is still useful, adapt it behind the canonical broker rather than keeping an independent privileged entry point.

## Redundant customer tool-selection UI

Customers should not need to select MCPs, PyAutoGUI, Playwright, Appium, scripts, APIs, accessibility, vision, or other internal implementation methods. Remove UI that exposes implementation plumbing solely because earlier prototypes required manual tool choice, after proving the universal planner chooses the right method automatically and truthful capability/error states remain available.

Do not remove user-facing controls that express real product policy, such as device selection, Wake Mode, STOP, Pause/Resume, task target, allowed capability, privacy setting, or high-impact confirmation.

## Legacy “download wake model” and “browser developer setup” documentation

Once the new bundled wake path and product-owned browser-control path are proven, update active product documentation that tells ordinary customers to separately download a wake model or configure developer remote debugging. Preserve historical audits and older implementation evidence; only active customer docs should be retired or superseded.

## File indexing bloat

Do not build or retain a system that continuously uploads, parses, embeds, or duplicates all customer files merely to make JARVIS aware of the machine. Prefer lightweight local metadata discovery and on-demand content reads for authorized tasks. If an experimental full-content indexing path exists without a proven product requirement, mark it for retirement after file discovery/search tasks are proven on the lighter authority.

## Learned-recipe privacy cleanup

Any learned app-control recipe store must contain only sanitized reusable operational knowledge. Remove or migrate recipe fields that retain raw private screenshots, customer file contents, cookies, tokens, credentials, OTPs, MFA secrets, or unnecessary personal data. Device-local machine metadata should remain scoped to the correct device/account authority.

## Final cleanup timing

Do not perform the cleanup in this addendum before the universal-control implementation and its frozen testing-only wave have completed. The required order is:

1. prove universal control while old specialized paths still exist;
2. run the frozen whole-product testing-only matrix without writing app-specific fixes during the evidence pass;
3. repair all reproduced defects and rerun the matrix;
4. identify redundant paths using this file and `/ponytail ultra`;
5. remove only proven-obsolete production code/dependencies;
6. rerun the complete acceptance matrix on the cleaned tree;
7. run the second independent attack pass;
8. run the final real-user pass;
9. prepare the final release report;
10. leave the branch unmerged until explicit owner approval.

Cleanup must reduce code and attack surface without reducing the universal engine's ability to operate unfamiliar software, preserve user data, recover from failure, honor STOP, or verify real results.

## Cleanup record — 2026-10-03

- **Donor browser controller (`jarvis-runtime/actions/browser_control.py`, 1556 → 605 lines): removed.** OCADE drives browsers only through `_BrowserSession` in the "isolated" and "real" modes (start, act, observe, frame, close). Removed after checking no product code or test reaches them: the donor entry point and session registry, the "native" launch mode (real-profile launch with `--disable-blink-features=AutomationControlled`, Firefox/Safari/Opera profile finders, browser maps), 17 unused action methods and the donor tool schema. Kept: the default-browser and executable lookups the existing-browser path uses. Proof: runtime suite 155 passed; jarvis, carry-on, bubble and controls journeys passed; installed agent 0.3.7 built and healthy.
- **Stale tracked build output** `jarvis-runtime/packaging/windows/Output/OCADE-Device-Agent-0.2.0-Setup.exe` (51.7 MB): untracked and the folder ignored.
- **Unused exports** (knip): seven file-local constants and helpers no longer exported. Knip found no unused dependency.
- Kept on purpose: Excel/Word adapters (measured fidelity: Excel's own calculation, number formats and conditional formatting, Word styles; the universal engine routes through them via `sheet_edit`/`doc_edit`), the Linux confinement branch (about 30 lines, security), manual live-proof scripts (`scripts/e2e/live-usage-journey.mjs`).
- **`admin.ocade.in` (retired 2026-10-03, after the integrated console passed the admin journey and the PostgreSQL suites):** `src/lib/admin/console-host.ts`, `console.functions.ts`, `open-console.ts`, `src/routes/auth.console.tsx`, the Worker's console-origin redirect, the `admin.ocade.in` custom-domain route, `console-host.test.ts`, `console-sessions.test.ts`, the stub's console sessions, and the account-menu entry. Kept: migrations `20261001090000`/`095100` (history; superseded by `20261003090000`, applied with it at release).
- **Final cleanup wave (2026-10-03, after the integrated console and the real-task fixes):** `DatabaseTwin`'s row-planting family (`plantRow`, the catalogue readers and `filler`; 457 lines, no caller since the isolation sweep moved to explicit fixtures), `src/ffprobe-static.d.ts` (types for a package OCADE no longer depends on), and three exports used only inside their own files (`enrollInput`, the assurance middleware's `readSessionAssurance`, `SecondFactorRequired`). Checked with knip in normal and production mode; kept on purpose: test-only exports that unit tests import, the per-class account-data deletion module (a data-rights capability, not dead duplication), the Excel/Word adapters, the stub's SQL mirror and the journeys' repeated helpers (test tooling, not product), and the legacy `user_roles` admin row until the console release is live in production.
