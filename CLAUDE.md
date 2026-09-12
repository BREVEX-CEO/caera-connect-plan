# OCADE AI Agent Handbook

## Mission

Rebuild OCADE into a small, fast product with maximum capability behind minimum visible UI.

Customer-facing product:

- Chat
- Library
- Cowork, with Cowork and Jarvis modes over one runtime
- Account, with Settings inside it
- About, Help, Terms and Privacy

There is no standalone Code, Projects, Tasks, Artifacts, Customize, Devices, Search dashboard, pricing page, desktop Copilot product, old Cowork UI or old Jarvis solar-system UI.

A feature is not preserved because its implementation is impressive. Preserve only behavior required by the final product, legal/security obligations or an active final runtime dependency.

The core rebuild is intentionally destructive to obsolete legacy product structure. `PLAN.md` targets approximately 90% removal of legacy product code, routes, duplicate runtimes, stale UI, obsolete tests/dependencies/docs and retired Supabase objects where safe. Required final authorities remain, but anything retained must be cleaned, customized and made native to the final OCADE architecture rather than carried forward unchanged.

## Read order

At the start of any implementation session read, in order:

1. `CLAUDE.md`
2. `PLAN.md`
3. `docs/PRD.md`
4. `docs/TRD.md`
5. `docs/APP_FLOW.md`
6. `docs/UI UX Brief.md`
7. `docs/DESIGN.md`
8. `docs/UI_REFERENCE_CHECKLIST.md`
9. `docs/ARCHITECTURE.md`
10. `docs/Backend Schema.md`
11. `docs/RULES.md`
12. `docs/TESTING.md`
13. `docs/MEMORY.md`
14. `docs/DECISIONS.md`

Read `PLAN2.md` only after every `PLAN.md` gate is complete. `PLAN.md` rebuilds the core product first. `PLAN2.md` then replaces Cowork/Jarvis with the OCADE JARVIS donor runtime.

## Mandatory workflow

Every substantial change follows this order:

```text
READ → TRACE → SCAN → CLASSIFY → DELETE/CLEAN → READ AGAIN → BUILD → TEST → BREAK → FIX → RETEST → BROWSER-PROVE
```

Before editing:

- read the relevant old implementation and every reachable caller;
- determine what final behavior must survive;
- classify code as KEEP, REUSE, REPLACE or DELETE;
- prefer deletion over compatibility layers for retired product surfaces;
- never create a second authority when one final authority can own the behavior.

The first implementation activity is a repository-wide read and dependency map. The second is aggressive cleanup. After cleanup, read the smaller repository again before rebuilding.

Do not ask the owner to decide routine KEEP/DELETE choices that are already fixed by `PLAN.md`. Preserve only the explicitly required final product behavior and infrastructure. If old implementation is reused, fully customize, simplify, rename where necessary, rewire and test it so the final system does not remain a disguised copy of the old broad architecture.

## Plan separation

### `PLAN.md` — core OCADE first

Finish and prove:

- simple Grok-like shell;
- Chat;
- authentication;
- account-wide usage;
- Gemini online intelligence;
- browser Offline Intelligence;
- model download/reuse/repair lifecycle;
- Library;
- Settings and Data Controls;
- billing hooks and required hidden Admin/security authorities;
- About, Help, Terms and Privacy;
- Supabase cleanup for the reduced product.

Do not integrate OCADE JARVIS while `PLAN.md` is incomplete.

### `PLAN2.md` — Cowork/Jarvis second

Only after `PLAN.md` passes:

- extract `.incoming/OCADE_JARVIS.zip`;
- make its runtime the canonical Cowork/Jarvis implementation;
- preserve its donor feature set;
- wire normal Cowork and voice-first Jarvis as two presentations over one runtime;
- remove superseded old Cowork/Jarvis/computer-control implementations;
- prove browser/computer/file/voice execution and permissions.

## Non-negotiable product rules

- `/` is Chat. Signed-out people can see the shell; attempting to send requires authentication.
- Primary visible navigation is Chat, Library and Cowork. Jarvis is a mode inside Cowork.
- Settings is reached from Account.
- Public pages retained: About, Help, Terms and Privacy. Pricing and the old landing page are removed.
- Normal customer UI never exposes raw provider/model/runtime identifiers.
- The internal offline model is never named to customers; customer language is `OCADE`, `Offline` and `Offline Intelligence`.
- A verified offline model is not redownloaded because of refresh, sign-in/out, account deletion, service-worker update, deploy, commit, merge to main or compatible app update.
- Model bytes are identified by their own content manifest/version, never the website build SHA.
- Gemini secrets are server-side only. Never put them in browser environment variables, logs, normal database rows or generated client bundles.
- One successful user request is one usage unit. Internal Cowork/Jarvis tool/model steps do not multiply the charge.
- Persistent normal account content belongs in Supabase/PostgreSQL/private Storage. OPFS is for Offline Intelligence binaries and model-owned metadata.
- Do not fake success, connectivity, installation, control, payment, security or verification.

## UI rule

`docs/design-references/grok/` is the sole visual UI/UX reference set. Use its simplicity, density, layout proportions, spacing and light glass treatment while keeping OCADE branding, copy and implementation original.

The former Stitch/Jarvis 3D reference is removed and must not be used or recreated as a design authority.

The target is near-black, grey and white, small/medium radii, very light glassmorphism, minimal cards, short labels, restrained motion and large usable workspace. Do not reproduce proprietary logos/assets or pixel-copy trade dress.

## Repository hygiene

The only Markdown authorities allowed are:

- `CLAUDE.md`
- `PLAN.md`
- `PLAN2.md`
- `docs/PRD.md`
- `docs/TRD.md`
- `docs/APP_FLOW.md`
- `docs/UI UX Brief.md`
- `docs/DESIGN.md`
- `docs/UI_REFERENCE_CHECKLIST.md`
- `docs/ARCHITECTURE.md`
- `docs/Backend Schema.md`
- `docs/RULES.md`
- `docs/TESTING.md`
- `docs/MEMORY.md`
- `docs/DECISIONS.md`

Do not create additional Markdown. Fold durable information into the correct authority instead.

Generated evidence may use JSON or machine-readable formats. Design references use Grok images/assets only, not extra prose documents or alternate visual reference systems.

## Git and checkpoints

Use one isolated implementation branch. Never force-push or destructively rewrite shared history.

After every `PLAN.md` phase is fully implemented and its phase gate passes:

1. update `docs/MEMORY.md` with the completed gate, branch, checkpoint SHA and exact next unfinished action;
2. make a clean descriptive checkpoint commit on the isolated completion branch;
3. push that checkpoint to GitHub;
4. verify the remote branch points to the exact same SHA;
5. continue immediately to the next phase.

These checkpoints are mandatory progress protection against context loss, usage resets, crashes, Auto Continue failures or session loss.

Keep `main` untouched while implementation is incomplete. Never merge partial phases to `main`.

After the full relevant plan passes, fetch and reconcile latest `origin/main`, rerun all final gates on the exact reconciled tree, fast-forward/merge without force, push `main`, and verify the final remote SHA/tree.

If a session is resumed after interruption or usage reset, read `docs/MEMORY.md`, verify the last pushed checkpoint SHA, recover the exact unfinished step and continue rather than repeating completed phases.

## Chat output

Be concise. After a completed verified phase, report one short checkpoint line such as:

```text
Core Chat complete — Phase 6 DONE — committed, verified, pushed — SHA <sha>
```

Do not narrate every command. Concise status output must never reduce implementation depth, testing, security review, debugging or verification.
