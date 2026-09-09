# OCADE — Governance and Process

Register rows: AZ-019 acceptance criteria · AZ-020 dependencies · AZ-022 change control ·
AZ-024 ownership · AZ-048 deprecation · AZ-445 roadmap · AZ-446 feature intake ·
AZ-447 architecture review · AZ-448 safety review · AZ-449 migration · AZ-450 portfolio.

This is a supporting governance record. Current product/technical decisions are owned by the canonical documentation set, especially `PLAN.md`, `CLAUDE.md`, `docs/RULES.md` and `docs/DECISIONS.md`. Where an older statement here conflicts with those authorities, the canonical documents win.

---

## 1. Change control (AZ-022)

Changes to `main` must preserve published history and pass the verification appropriate to their scope. The current ordinary GitHub CI authority is `.github/workflows/ci.yml`.

| Stage | Current authority |
| --- | --- |
| Portable install, route stability, readiness, typecheck, lint, format, tests, deterministic build, performance, Supabase types, release/integration/mission/browser/extension checks | `npm run verify:full` in the `portable-core` Ubuntu/Node 22 job |
| Production dependency advisory check | `npm audit --omit=dev` in the same portable job |
| Platform/hardware-specific proof | `.github/workflows/platforms.yml`, `.github/workflows/windows-proof.yml` and the owning scripts |
| Final production acceptance and deployment sequence | `PLAN.md` and `docs/TESTING.md` |

**Rules that hold regardless of urgency:**

1. Do not merge around a real red gate. Fix the defect or, if the gate itself is wrong, repair the gate and prove the corrected invariant.
2. Do not disable rules, skip shipped behavior, weaken assertions, add blanket suppressions or hand-edit generated evidence merely to obtain green output.
3. Production deployment follows the controlled release sequence in `PLAN.md`; a push alone is not release authority.
4. Secrets are never inlined in workflows, source, logs or generated evidence.
5. Externally unavailable hardware/provider proof remains unavailable rather than being converted into a pass.

## 2. Feature intake (AZ-446)

A capability must have one canonical product/runtime owner before UI is added. Search the existing feature/capability/tool authorities first and follow `CLAUDE.md`/`docs/RULES.md` rather than creating a parallel registry.

A new or materially changed capability must define:

1. customer-visible availability state and truthful unavailable reason where applicable;
2. owning canonical subsystem and data/runtime boundary;
3. required permissions, risk and approval behavior;
4. usage/entitlement behavior when AI or commercial capacity is involved;
5. tests/evidence appropriate to the capability;
6. real reachable UI only after the authority exists.

A decorative card, route, icon or source file never makes a capability available.

## 3. Architecture review (AZ-447)

Architecture review is required when a change would:

- add or alter a trust boundary;
- add an external integration/provider;
- change a shared type/data surface;
- introduce or move a runtime boundary;
- change intelligence/model/provider selection;
- change persistent-data, usage/entitlement, task, permission or remote-execution authority;
- create a new canonical subsystem or replace an existing one.

The durable decision is recorded in [`DECISIONS.md`](DECISIONS.md) with context, decision, reasoning/trade-offs and consequences. The former standalone `docs/adr/*` files were consolidated into `DECISIONS.md` on 2026-09-09 and removed; do not recreate a competing ADR folder merely for document-count symmetry.

## 4. Safety review (AZ-448)

Required for anything touching files, accounts, messages, databases, billing, operating-system controls or external services.

1. **Explicit permission.** Capability is granted at the correct scope rather than ambiently assumed.
2. **A meaningful preview/approval** where the side effect or risk requires it.
3. **A cancel/stop path** that works during execution.
4. **An audit/receipt record** with protected content and secrets excluded/redacted.
5. **A verifier** deriving the result from observed postconditions rather than the actor's own success claim.
6. **No claimed authority.** OCADE never presents unavailable OS/browser/provider capability as working.

Protected inputs such as passwords, OTPs, CAPTCHAs, CVV/PIN and recovery codes remain user-controlled as defined by the canonical security rules.

## 5. Database migration policy (AZ-449)

`docs/Backend Schema.md`, `docs/ARCHITECTURE.md`, `docs/RULES.md` and the current source/live Supabase state own migration behavior.

1. Reconcile source and live schema **semantically**, not by migration filename alone.
2. Preserve already-applied migration history; do not delete or rewrite published migrations merely to make the folder look clean.
3. Use reviewed forward-only corrective migrations for production changes.
4. Regenerate/check Supabase types after schema changes.
5. RLS/Storage policies and privileged functions must be tested under adversarial user/tenant roles.
6. Add indexes only from real query patterns/query-plan evidence.
7. Never reconstruct production tables from generated TypeScript types alone.
8. Backup/restore/rollback readiness is part of final production acceptance.

## 6. Deprecation policy (AZ-048)

A capability is removed only after callers/navigation are migrated and required data/evidence/provenance is preserved. A removed route must have an intentional redirect or not-found behavior when required by `docs/APP_FLOW.md`; dead implementation must not stay shipped solely to preserve a historical URL.

FICIA, MADEE and CANIA are retired product names, not active product destinations or actionable placeholder products. Historical deep links may redirect or resolve to an intentional not-found state according to the canonical flow. Their old product bundles must not remain reachable merely to reserve the names.

## 7. Requirement acceptance criteria (AZ-019)

Evidence strength must match the claim being made. Source inspection, compilation, unit tests, integration tests, simulated runtime and real-target runtime are distinct proof levels. A stronger product/runtime claim cannot be supported by weaker evidence merely because a checker accepts a file path.

Current completion criteria and release gates are defined by `PLAN.md` and `docs/TESTING.md`. Generated/evidence ledgers remain supporting records and must be regenerated from their owning sources rather than manually edited.

## 8. Requirement dependencies (AZ-020)

Dependencies are enforced through canonical architecture and executable gates rather than an independently maintained duplicate roadmap graph:

- a feature cannot bypass its data/runtime/permission/usage authority;
- security and persistence foundations precede dependent commercial or automation behavior;
- generated evidence cannot claim a tier stronger than its observed proof;
- external blockers retain an owner/exit condition where the active evidence system requires one;
- build/runtime-dependent checks run only after the required build/environment exists.

## 9. Roadmap (AZ-445)

`PLAN.md` is the sole ordered production-completion roadmap. Historical phase/block roadmaps in supporting evidence do not override it. New work is inserted by updating the owning canonical documents and `PLAN.md` when implementation order changes; this file does not maintain a second competing feature roadmap.

## 10. Portfolio management (AZ-450)

One product ships: **OCADE**. FICIA, MADEE and CANIA are retired product names, not active destinations or actionable placeholders. The current decision and historical reasoning are recorded in [`DECISIONS.md`](DECISIONS.md#ocade-is-the-only-shipped-product).

A retired product returns only through normal product intake, architecture/security review and an explicit owner decision—not by restoring deleted screens from Git history.

## 11. Ownership and documentation maintenance (AZ-024)

The current documentation roles are indexed in `docs/README.md`. `PLAN.md` is the only implementation sequence and `CLAUDE.md` is the single AI-agent handbook. Product requirements, technical requirements, flow, experience intent, detailed design, architecture, backend schema, rules, testing, memory and durable decisions each have their own canonical document.

Supporting audit/readiness/legal/provenance/runbook/evidence documents are retained when they still have operational, legal, provenance or checker value. They may be deleted only after unique value and inbound references are safely retired. Cross-reference canonical authorities rather than copying a second specification into supporting documents.
