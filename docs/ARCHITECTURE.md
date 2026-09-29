# OCADE Architecture

## Boundaries

OCADE is one repository with distinct runtime boundaries:

- web product: React/TypeScript under `src/`;
- JARVIS web surface: `src/jarvis/`;
- active local execution runtime: `jarvis-runtime/`;
- immutable donor/provenance: `imports/ocade-jarvis/`;
- Supabase: identity/data/security authority;
- Cloudflare: deployed web/runtime authority.

Python runtime files stay outside React `src/`.

## Product surfaces

Chat and JARVIS are separate.

Chat may use Offline Intelligence according to product rules.

JARVIS is Online-only and never silently routes to Offline.

## Donor-to-runtime architecture

The immutable donor is not executed as production authority.

For each capability:
donor source -> inspect -> copy/adapt to active runtime -> route through OCADE broker -> harden -> test -> cleanup duplicate active code.

Approximately 98% donor capability/logic reuse is the target where safe, but architecture/security authorities may replace donor structure.

## Intelligence boundary

Provider keys remain server-side.

Device runtimes receive validated actions and return results; they do not receive provider API keys.

Primary/secondary/tertiary server capacity is internal implementation detail.

## Action broker

One action broker owns execution validation and cancellation.

Input:

- account;
- conversation/task;
- target device;
- action;
- capability;
- scope;
- confirmation;
- control lease;
- idempotency.

Output:

- verified command/refusal;
- customer-safe activity;
- result verification;
- settlement.

## Browser architecture

No OCADE customer browser add-on is required.

For existing-browser work:

- attach to existing browser when securely possible through CDP/DevTools/Playwright;
- use semantic accessibility;
- OS UI Automation;
- vision;
- fresh PyAutoGUI fallback.

Isolated browser context may be chosen for risky research that does not need personal session state.

Never extract browser password/cookie stores.

## Desktop architecture

Windows/macOS Device Agent is a small trusted local runtime.

Windows:

- one tray;
- dormant autostart;
- app discovery;
- browser/apps/files/terminal/screen/system executors;
- local STOP;
- update/rollback;
- clean uninstall.

Coordinates are observation-bound and stale-safe.

## Android architecture

OCADE mobile installation begins from the website and may use native Android components where the OS requires them for real overlay/accessibility/background functionality.

One OCADE identity exposes PWA/full UI and floating bubble.

## Apple architecture

iPhone/iPad: PWA/Home Screen + Apple-supported integrations + Remote PC.

macOS: Device Agent/menu-bar.

Real Apple evidence is separate from WebKit compatibility.

## Data architecture

Supabase remains durable identity/data authority.

Keep one canonical authority for:

- conversations/messages;
- JARVIS tasks/activity;
- device identity;
- permissions;
- usage;
- roles/permissions;
- staff audit;
- support cases.

Do not revive duplicate historical systems without need.

## Storage

Offline Chat model must not redownload merely because code was merged/deployed.

Browser installations use stable OPFS/release identity/integrity state. Completed ranges persist immediately; repair is targeted.

Explicit Remove/Clear Data deletes local storage according to product/platform rules.

## Owner/staff architecture

Privileged UI is separate at `admin.ocade.in`, but auth uses OCADE identity.

Authorization is server/RLS enforced.

Roles and permission overrides map to stable user UUIDs.

## Security

Treat model/page/file/screenshot/tool output as untrusted.

No prompt/tool output grants permission.

Fail physical execution closed when safety-control state is unreadable.

Sensitive actions use confirmation/strong auth according to policy.

## Observability

Customer Activity is concise and safe.

Detailed diagnostics are redacted and privileged.

Raw screenshots are transient by default.

## Deployment

Main/source/deployed identities must agree before final release claim.

GitHub Actions is optional, not required evidence.

## Master Phase 1–49 authority

Implementation order, phase entry/exit gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting are governed by the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves current working behavior, repairs gaps proven by current evidence, and continues sequentially through Phase 49. This document supplies domain-specific requirements and does not replace a phase gate.
