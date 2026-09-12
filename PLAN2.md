# PLAN2 — OCADE Cowork + Jarvis Replacement

## Preconditions

Do not start this plan until every `PLAN.md` gate is green and the core product has a verified checkpoint.

`PLAN2.md` replaces Cowork/Jarvis. It does not reopen or duplicate the core Chat, auth, usage, Library, Settings or Offline Intelligence authorities.

## Source donor

Canonical donor archive:

```text
.incoming/OCADE_JARVIS.zip
```

The archive is preserved as donor provenance. Extract its implementation into the repository only when this plan begins.

The donor currently contains the OCADE JARVIS capability set, including voice/wake-word, Gemini Live, browser/computer actions, screen/camera, files, memory, reminders, monitoring, messaging, search, weather, flight lookup, YouTube/system actions, plugins/actions, code-helper/dev-agent capabilities, undo/confirmation, audio devices, remote dashboard and proactive behavior.

The owner wants the donor feature set retained. Standalone Code product UI remains removed; coding/dev features may exist only as Cowork/Jarvis capabilities.

## Phase 0 — Extract and inspect

- Extract `.incoming/OCADE_JARVIS.zip` into one canonical source area, preferably `src/ocade-jarvis/`, preserving donor structure and provenance.
- Inventory all donor files, imports, Python/runtime requirements, action registration, secrets, network calls, filesystem/process access and platform assumptions.
- Scan for hard-coded credentials, unsafe command construction, unrestricted filesystem/process access, unbounded loops and duplicate authority.
- Map each donor capability to the final Cowork permission/runtime contract.
- Do not create parallel OCADE and donor Cowork engines.

**Gate:** complete donor map with no unknown reachable action.

## Phase 1 — One Cowork runtime

Make OCADE JARVIS the canonical Cowork execution runtime.

Both presentations use the same:

- session/task state;
- permissions/approvals;
- browser/computer/file tools;
- action/plugin registry;
- Gemini online intelligence boundary;
- usage permit;
- receipts/postcondition verification;
- cancellation/pause/takeover state;
- Library output path.

Normal Cowork and Jarvis must not diverge into separate engines.

One successful user request consumes one usage unit; internal donor steps do not multiply usage.

**Gate:** identical requested operation reaches the same runtime from normal and Jarvis modes.

## Phase 2 — Delete superseded runtime

After donor-equivalent paths are proven, delete the old OCADE Cowork/Jarvis/desktop-Copilot/computer-control implementations that are no longer canonical.

Keep only minimal native/browser helpers actually required by the new runtime. There must be one authority per action type.

Remove the old moon/solar-system Jarvis UI completely.

**Gate:** no caller can reach an old competing runtime.

## Phase 3 — Normal Cowork UI

Cowork uses the same calm shell language as Chat and `docs/design-references/grok/` is the sole visual reference set. Do not introduce a separate Stitch/3D design language.

Empty state:

```text
Cowork
What should OCADE do?
[ composer ]
Recent work
```

During work show only:

- concise goal;
- short verified step/checklist;
- meaningful approval request;
- Pause;
- Take over;
- Stop.

Detailed logs/receipts are behind a contextual Details/Advanced view, not permanent panels.

Cowork can use browser, computer/device actions and files according to permissions and platform availability.

**Gate:** real browser journey proves start → observe → act → re-observe → verified result, plus pause/takeover/stop.

## Phase 4 — Jarvis inside Cowork

Jarvis is a mode inside Cowork, never a separate primary navigation destination.

```text
Cowork
[ Cowork | Jarvis ]
```

Jarvis is the voice-first/hands-free presentation of the same runtime and inherits the same simplified OCADE/Grok-derived visual system.

For this release:

- Jarvis is online-only;
- Jarvis uses OCADE's Gemini server boundary;
- preserve donor wake-word/hands-free behavior where safe and supported;
- continuous microphone state is explicit and user-controlled;
- show a small original OCADE audio/orb indicator only;
- no giant moon, solar system, Stitch-style 3D scene or empty cinematic dashboard;
- text fallback is always available;
- permission/recording state is visible and revocable.

**Gate:** voice/hands-free and text commands produce the same verified Cowork semantics.

## Phase 5 — Permissions and control safety

Every state-changing browser/computer/file action requires:

- scoped capability permission;
- observation before action where applicable;
- approval for sensitive/destructive boundaries;
- bounded execution;
- postcondition re-observation;
- truthful failure if the action cannot be proven.

Emergency Stop cancels active work. Take over hands control back to the user and invalidates stale observations.

Do not expose a desktop/Copilot product UI. Native helpers exist only as infrastructure for Cowork/Jarvis.

**Gate:** unsafe, unapproved and unsupported actions fail closed.

## Phase 6 — Library and persistence

Cowork/Jarvis generated files/images/outputs flow into the existing Library authority.

Persist only required durable Cowork state in Supabase. Do not recreate old Tasks/Artifacts/Projects products merely because the donor has internal task concepts.

Temporary execution details remain transient unless needed for audit/recovery/security.

**Gate:** Cowork outputs appear in Library without a second artifact store.

## Phase 7 — Final cleanup

- Remove unused donor adapters only if doing so does not remove a donor capability the owner required.
- Keep the original donor archive under `.incoming/`.
- Remove obsolete old runtimes, dependencies, routes, tests and build scripts.
- Ensure no standalone Code/Task/Artifact/Project product returns through donor wiring.
- Re-run dead-code/reachability scans.
- Update `docs/MEMORY.md` and `docs/DECISIONS.md` with proven final authority.

**Gate:** one small customer UI, one Cowork runtime, no competing control paths.

## Phase 8 — Full product verification

Test the exact production build as a real user:

- Chat, Library, Cowork normal, Jarvis, Account/Settings;
- signed-out and signed-in;
- desktop/mobile/tablet widths;
- usage accounting shared across Chat/Cowork/Jarvis and devices;
- browser control;
- native computer control on supported real hardware;
- files;
- approvals;
- Pause/Take over/Stop;
- voice input/output;
- wake-word/hands-free state and microphone revocation;
- Gemini failures;
- permissions and postcondition verification;
- Library outputs;
- recovery/reload;
- security/no-secret scans.

Run the same tracked source LOC measurement used in `PLAN.md`, record the final whole-product LOC and the reduction from the original Phase 0 baseline.

## Definition of PLAN2 complete

OCADE exposes only Chat, Library and Cowork in its primary product shell. Cowork and Jarvis are two simple presentations over the OCADE JARVIS runtime. The old broad product and duplicate control/runtime stacks are removed, and the complete final tree is proven before integration to main.
