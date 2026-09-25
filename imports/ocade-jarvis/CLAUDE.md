/ponytail ultra
/caveman ultra

# OCADE JARVIS Intake — Claude Preservation Rules

## Scope

These instructions apply to `imports/ocade-jarvis/` and the original JARVIS
ZIP/source placed here.

This is an owner-approved new OCADE JARVIS mission, but the first phase is
**preservation, extraction, inventory, and architecture understanding**.

The original ZIP is considered valuable source provenance and donor/runtime
code. Do not treat it as ordinary dead-code cleanup.

## First actions

Before touching the JARVIS source:

1. Run `/ponytail ultra`.
2. Run `/caveman ultra`.
3. Read root `AGENTS.md`, root `CLAUDE.md`, the current owner request,
   `PLAN.md`, `docs/MEMORY.md`, and this file.
4. Read the intake `README.md` and `LICENSE`.
5. Inventory the complete ZIP before planning edits.

## Immutable-source rule

The following are **never deletion or rewrite targets** during intake:

- the uploaded original ZIP;
- the exact extracted original-source snapshot;
- original README files;
- original `requirements.txt` and setup files;
- original source modules;
- original assets;
- original prompt/config templates with secrets removed or absent;
- original directory structure.

Extract the ZIP to a clearly marked source-preservation location such as:

`imports/ocade-jarvis/source-original/`

Preserve the exact archive separately beside it.

Do not run formatters, autofixers, renamers, bulk rewrites, dependency
upgraders, or Ponytail deletions against the immutable source snapshot.

## Ponytail Ultra — preservation mode

Ponytail Ultra is required, but in this directory its first job is to
**understand and classify**, not delete.

For every original subsystem classify it as one of:

- REUSE DIRECTLY
- ADAPT / WRAP
- REPLACE IN PRODUCTION
- SECURITY REVIEW REQUIRED
- ENVIRONMENT-DEPENDENT
- PLACEHOLDER / TEMPLATE
- README CLAIM WITHOUT MATCHING SOURCE
- PRESERVE FOR PROVENANCE

Ponytail may report duplicate, dead, unsafe, or obsolete code in the original
snapshot, but must not remove it there.

If an original implementation should not ship, preserve the original source and
build the clean replacement in the production JARVIS code.

Only newly adapted/production JARVIS code is eligible for aggressive
Ponytail/YAGNI/KISS deletion after tests prove the replacement.

## No line-count target for the original ZIP

Do not reduce LOC, file count, modules, comments, or dependencies in the
original source merely to make it smaller.

The owner explicitly wants the original JARVIS source preserved.

Minimum LOC and maximum debloat apply later to the **production integration**,
not to the immutable donor snapshot.

## Integration boundaries

Do not blindly copy the Python files into the React `src/` tree.

Before production integration:

1. map every original entry point and action;
2. map voice, browser, desktop, files, memory, dashboard, plugin, confirmation,
   undo, and developer-agent behavior;
3. identify current provider/API-key handling;
4. identify local memory/config authorities;
5. identify all network listeners and remote-control paths;
6. identify arbitrary code-execution paths;
7. identify OS-specific behavior and permissions;
8. identify dependencies and optional dependencies;
9. identify actual implemented capabilities versus README-only claims;
10. identify anything that conflicts with current OCADE auth, security,
    Supabase, usage, memory, provider-secrecy, or customer-UI authorities.

Then design the production JARVIS architecture.

## Product direction already decided

Treat these as owner decisions for the JARVIS mission:

- Product name: **OCADE JARVIS**.
- JARVIS is a new main OCADE section beside Chat.
- Chat and JARVIS are separate product experiences.
- JARVIS uses its own plan allowance, separate from Chat.
- Initial JARVIS intelligence is **Online-only**.
- Use OCADE's approved server-side Gemini intelligence authority; customers do
  not paste provider API keys.
- Browser control is a primary v1 objective.
- Integrate Playwright / Playwright MCP capability as an internal JARVIS tool
  where appropriate.
- Browser automation may combine structured DOM/accessibility control, browser
  tooling, vision, and coordinate fallback.
- Support isolated automation browsing and explicitly authorized real-browser
  interaction.
- Windows and macOS are first desktop targets.
- Android deeper automation comes before deep iOS automation.
- JARVIS may work with user-approved applications including editors, creative
  tools, engineering/CAD/CAE software, browsers, and other allowed apps.
- Smart autonomy is default; Autonomous mode is optional.
- Purchases/final payment actions remain disallowed.
- Voice must support interrupt, pause, continue, and end.
- The final web GUI is a clean professional black/white-first experience with
  a live configurable orb/graph, not a cluttered sci-fi/game dashboard.
- The graph may represent conversations, memories, tasks, devices, and allowed
  apps, with real navigation to the represented object.
- Registered desktop/mobile devices and allowed apps must be visible and
  permission-controlled.
- Generic arbitrary user Python plugins are not the final product model;
  CARCC-controlled tools/capabilities are preferred.

## Security rule

Do not preserve unsafe behavior in production merely because it exists in the
original ZIP.

Preserve the original code for provenance, then replace or wrap unsafe behavior
behind explicit permissions, typed actions, audit logging, confirmations,
workspace boundaries, device/session authentication, and other OCADE security
authorities.

Never expose provider keys, service-role keys, private tokens, customer
credentials, saved passwords, or secret configuration to the browser or source
repository.

## Completion of intake phase

Do not claim the ZIP is integrated merely because it extracted successfully.

The intake phase is complete only when Claude can provide:

- the full source inventory;
- the real entry-point/runtime map;
- a capability matrix of implemented / partial / absent features;
- dependency and OS-support map;
- security-sensitive-path inventory;
- browser-control inventory;
- voice/task flow map;
- memory/config/provider-authority map;
- remote/device-control map;
- reuse/adapt/replace decisions for every major module;
- a clean proposed production repository layout;
- a list of exact OCADE files/services that must later be connected.

No destructive integration is allowed during this intake phase.
