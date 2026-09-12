# OCADE AI Agent Handbook

## Default operating modes

Always start and resume OCADE engineering work with:

```text
/caveman full
/ponytail full
/ponytail-review
/ponytail-audit
/ponytail-debt
```

These defaults survive new sessions, Auto Continue, context compaction and usage-limit resets. Ponytail controls engineering depth; Caveman controls communication length only. Never let concise output reduce reasoning, implementation depth, testing, security review, debugging, browser proof or code quality.

If the owner says a usage limit reset and asks to continue, reactivate the defaults, read `docs/MEMORY.md`, recover the exact unfinished checkpoint and continue without restarting completed work.

## Mission

Rebuild OCADE as a much smaller, cleaner product. This is not a gentle refactor. The active mission explicitly targets removal of approximately 90% of the obsolete legacy application code, routes, components, stores, tests, styles, duplicate runtimes, stale schema objects, donor leftovers and obsolete documentation, followed by rebuilding the product around the final OCADE architecture.

Do not keep legacy code merely because it is high quality or already works. Keep only behavior and infrastructure required by the final product, security/legal obligations, billing/usage/auth, Offline Intelligence, Supabase authorities, hidden operational/admin needs, and the minimum seam required for `PLAN2.md`. Anything reused must be fully customized, simplified and integrated into the new OCADE architecture; do not carry old customer-facing UI or old product structure forward unchanged.

The final customer-facing core is Chat, Library, Cowork, Account/Settings, About the Founder, Help, Terms & Conditions and Privacy Policy. Jarvis lives inside Cowork and is implemented later by `PLAN2.md`. There is no standalone Code, Projects, Tasks, Artifacts, Customize, Devices, Search dashboard, pricing page, old landing page, desktop Copilot product, old Cowork UI or old Jarvis solar-system UI.

## Read order

At the start of implementation read `CLAUDE.md`, `PLAN.md`, the canonical docs in `docs/`, and `docs/MEMORY.md`. Read `PLAN2.md` only after every `PLAN.md` gate is complete.

## Mandatory workflow

Every substantial change follows this exact flow:

```text
READ EVERYTHING → TRACE REQUIRED FINAL BEHAVIOR → AUDIT → DEBT SCAN → DELETE/CLEAN AGGRESSIVELY → READ THE REDUCED REPO AGAIN → CUSTOMIZE/REBUILD THE WHOLE PRODUCT → TEST → BREAK → FIX → RETEST → REAL-BROWSER PROVE → CONTINUE
```

Do not ask the owner to decide what should stay. The final product shape is fixed. Trace callers and dependencies only to avoid deleting required authorities. Use KEEP, REUSE, REPLACE or DELETE internally, but the result should strongly favor deletion and replacement. Reuse is allowed only when it reduces risk or preserves a required authority, and reused code must still be customized for the new design and architecture.

The 90% cleanup target applies to obsolete legacy product implementation. Measure the Phase 0 baseline and final core source size consistently. If an exact 90% reduction cannot be reached because required security, auth, usage, billing, model, Supabase or future Cowork infrastructure must remain, keep the required code and document the measured result and reason in `docs/MEMORY.md`; never delete required safety or authority code merely to fake a percentage.

## Core product rules

`/` is Chat. Signed-out users may inspect the shell, but Send requires authentication. Primary visible navigation is Chat, Library and Cowork; Jarvis is a mode inside Cowork. Settings is reached through Account. Public pages that remain are About the Founder, Help, Terms & Conditions and Privacy Policy. Pricing and the old landing page are removed.

Normal customer UI never exposes raw provider/model/runtime identifiers. The internal offline model must never be named to customers; customer language is only `OCADE`, `Offline` and `Offline Intelligence`. A verified Offline Intelligence model must survive refresh, browser restart, sign-in/out, account deletion, service-worker update, deployment, commit, merge to `main` and compatible application updates without redownloading. Model bytes are identified by their own manifest/version, never the website build SHA.

Gemini secrets are server-side only. Exactly three server secret slots are allowed: `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, `GEMINI_API_KEY_TERTIARY`. Never expose them in browser environment variables, normal database rows, logs or generated client bundles.

One successful user request consumes one usage unit. Internal retries, tools and later Cowork/Jarvis substeps do not multiply the customer charge. Persistent normal account content belongs in Supabase/PostgreSQL/private Storage. OPFS is for Offline Intelligence model data and model-owned metadata only.

## UI authority

`docs/design-references/grok/` is the sole visual UI/UX reference set. Use its simplicity, density, layout proportions, spacing, near-black/grey/white palette and restrained glass treatment while keeping OCADE branding, copy and implementation original. The former Stitch/Jarvis 3D reference is removed and must not return.

Anything retained from the old UI must be fully redesigned and customized to the new OCADE shell. Do not preserve a legacy screen merely because it is polished. Prefer small/medium radii, minimal cards, short labels, light glassmorphism, restrained motion and large usable workspace.

## Repository hygiene

Keep only the canonical Markdown authorities already defined by the project. Do not create competing plans, duplicate design authorities or historical continuation documents. Fold durable information into the existing canonical docs. Grok images are visual references, not runtime code.

## Progress-loss prevention and checkpoints

Implementation must happen on one isolated completion branch created from freshly fetched `origin/main`. Never do partial implementation directly on `main`, never force-push, and never destructively rewrite shared history.

After every PLAN phase is fully implemented and its phase gate passes, immediately update `docs/MEMORY.md` with the completed gate, branch, exact SHA and next action; create a descriptive checkpoint commit on the isolated completion branch; push that checkpoint to GitHub; verify that the remote branch points to the same SHA; then continue to the next phase without waiting for the owner. These checkpoint commits are mandatory specifically to prevent loss of completed work across context resets, usage limits, crashes, Auto Continue failures or session loss.

A phase checkpoint is not permission to merge partial work into `main`. `main` stays untouched by implementation until the entire active `PLAN.md` is complete.

After every phase checkpoint, report only one compact line in the form:

```text
<6-word summary> — Phase <number> DONE — committed, verified, pushed — SHA <sha>
```

After all PLAN phases are complete, reread the entire plan against the final branch tree and run every reachable final gate together. Fetch the latest `origin/main`, reconcile it into the completion branch without force, rerun the complete final verification on that exact reconciled tree, and only then merge or fast-forward the verified completion branch to `main`, push `main`, verify the final remote SHA/tree, and perform the required production verification/deployment sequence. Stop only when the complete reachable mission is finished.

## Failure behavior

Do not voluntarily stop at an audit, phase boundary, failed test, timeout, context reset, usage reset or recoverable error. When anything fails use:

```text
READ → TRACE → REPRODUCE → FIX → TEST → BREAK → DEBUG → RETEST → BROWSER-PROVE → CONTINUE
```

Use real browser testing and inspect console, network, routes, runtime, responsive behavior, accessibility, state and complete user journeys. Fix root causes rather than hiding failures. Target zero TypeScript errors, build errors, unresolved imports, unexpected lint/formatter drift, reachable runtime errors, broken routes, fake controls, duplicate canonical authorities and applicable missing PLAN requirements.