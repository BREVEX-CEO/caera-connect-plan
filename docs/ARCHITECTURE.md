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

Privileged UI is the Owner/Staff Console inside `ocade.in` (`/admin`, shown only to staff); `admin.ocade.in` was retired on 2026-10-03.

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

## Simplified target architecture — 2026-10-06

The commercial architecture converges on three visible runtime surfaces: the OCADE website/PWA, the existing authenticated server control plane, and one small trusted local broker on each supported device that requires native control. Do not create a second desktop product, separate app-specific agents or parallel task authorities.

Online intelligence owns high-level reasoning and recovery, while deterministic inner-loop execution stays local. The canonical route is native/application API first, then local scripting or CLI/object model, then verified direct project/file transformation, then browser DOM/CDP or equivalent structured control, then OS accessibility/semantic control, and finally live vision with fresh coordinates only when the faster routes cannot represent the task.

The architecture should be event-driven wherever an authoritative completion or state-change event exists. Durable server state remains the recovery truth, while recurring polling is retained only as a bounded reconnect or failure fallback. Cached capability metadata must be sanitized, version-scoped and invalidated when its assumptions change.

One task lifecycle, one validated action broker, one selected-device executor and one verification contract should own execution. Specialized adapters may remain only when measured evidence proves a material advantage, and even then they must sit behind the same broker instead of becoming a second execution system.

## Current execution authority — 2026-10-06

This document remains the domain authority for system architecture, while `PLAN.md` is the single current execution roadmap. Older phase-range wording in this file is historical context only and must not be used to limit or restart the current mission. Newer Owner decisions in `PLAN.md` supersede older conflicting implementation detail. Implementation must preserve proven behavior, fix reproduced defects, simplify aggressively, and remove as much obsolete or duplicate active code as safely possible without weakening security, permissions, STOP, recovery, accessibility, fidelity, verification, or real platform support.
