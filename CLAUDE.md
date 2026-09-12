# OCADE AI Agent Handbook

## Default operating modes

Always start and resume OCADE engineering work with:

```text
/ponytail full
/caveman full
```

These defaults survive new sessions, Auto Continue, context compaction and usage-limit resets.

The two modes have different jobs and must never fight each other:

- **Ponytail Full controls engineering work.** Read deeply, trace callers, scan dependencies, remove obsolete code, implement the smallest final architecture, test it, break it, repair it and prove it.
- **Caveman Full controls chat verbosity only.** Keep status/output compact. It must never reduce reasoning, implementation depth, testing, security review, debugging or verification.
- **Precedence:** safety and correctness → `PLAN.md`/`PLAN2.md` → Ponytail Full execution discipline → Caveman Full response compression.
- If compression would hide a safety warning, irreversible consequence or required clarification, say the minimum necessary, then immediately return to Caveman Full.

If the owner says that a usage limit reset and asks to continue, reactivate both defaults, read `docs/MEMORY.md`, recover the exact unfinished step and continue. Do not restart completed work.

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

## Read order

At the start of any implementation session read, in order:

1. `CLAUDE.md`
2. `PLAN.md`
3. `docs/PRD.md`
4. `docs/TRD.md`
5. `docs/APP_FLOW.md`
6. `docs/UI UX Brief.md`
7. `docs/DESIGN.md`
8. `docs/ARCHITECTURE.md`
9. `docs/Backend Schema.md`
10. `docs/RULES.md`
11. `docs/TESTING.md`
12. `docs/MEMORY.md`
13. `docs/DECISIONS.md`

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
- Public pages retained: About, Help, Terms, Privacy. Pricing and the old landing page are removed.
- Normal customer UI never exposes raw provider/model/runtime identifiers.
- The internal offline model is never named to customers; customer language is `OCADE`, `Offline` and `Offline Intelligence`.
- A verified offline model is not redownloaded because of refresh, sign-in/out, account deletion, service-worker update, deploy, commit, merge to main or compatible app update.
- Model bytes are identified by their own content manifest/version, never the website build SHA.
- Gemini secrets are server-side only. Never put them in browser environment variables, logs, normal database rows or generated client bundles.
- One successful user request is one usage unit. Internal Cowork/Jarvis tool/model steps do not multiply the charge.
- Persistent normal account content belongs in Supabase/PostgreSQL/private Storage. OPFS is for Offline Intelligence binaries and model-owned metadata.
- Do not fake success, connectivity, installation, control, payment, security or verification.

## UI rule

The files under `design/reference/` are visual references. Use their simplicity, density, layout proportions, spacing and light glass treatment while keeping OCADE branding, copy and implementation original.

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
- `docs/ARCHITECTURE.md`
- `docs/Backend Schema.md`
- `docs/RULES.md`
- `docs/TESTING.md`
- `docs/MEMORY.md`
- `docs/DECISIONS.md`

Do not create additional Markdown. Fold durable information into the correct authority instead.

Generated evidence may use JSON or machine-readable formats. Design references use images/assets, not extra prose documents.

## Git and checkpoints

Use one isolated implementation branch. Never force-push or destructively rewrite shared history.

After a major plan phase is completely verified:

1. update `docs/MEMORY.md`;
2. make a clean checkpoint commit;
3. push it;
4. verify the remote SHA;
5. continue immediately.

Keep `main` untouched while implementation is incomplete. After the full relevant plan passes, reconcile the latest `main`, rerun final gates on the exact integration tree, fast-forward/merge without force, push and verify the remote SHA/tree.

## Chat output

Be concise. Normal progress output should be one short checkpoint line, for example:

```text
Core Chat complete — Phase 6 DONE — committed, verified, pushed
```

Do not narrate every command. Do not let concise chat output become shallow engineering.
