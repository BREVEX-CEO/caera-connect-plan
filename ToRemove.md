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

### Windows floating mini-control

Owner direction is tray-only on desktop. The floating Windows mini-control is not part of the final desktop product.

Remove it from active packaging/runtime only after tray status/STOP/Pause-Resume/Open/Exit, active-task visibility and real Windows verification are complete.

The Android floating bubble remains required and is unrelated to this desktop retirement.

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
