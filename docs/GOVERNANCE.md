# OCADE — Governance and Process

Register rows: AZ-019 acceptance criteria · AZ-020 dependencies · AZ-022 change control ·
AZ-024 ownership · AZ-048 deprecation · AZ-445 roadmap · AZ-446 feature intake ·
AZ-447 architecture review · AZ-448 safety review · AZ-449 migration · AZ-450 portfolio.

---

## 1. Change control (AZ-022)

Every change reaches `main` through a pull request, and the pull request is gated by
`.github/workflows/ci.yml`. Nothing here is advisory; the workflow is the process.

| Stage                                                                | Enforced by         |
| -------------------------------------------------------------------- | ------------------- |
| Typecheck, lint, tests, build on Linux, Windows, macOS × Node 20/22  | `build` job         |
| Migration set rebuilds an empty database; RLS attacks; type parity   | `database` job      |
| Rust safety core linked and executed on all three desktop platforms  | `rust` job          |
| 22 evidence and honesty gates                                        | `gates` job         |
| Extension manifest and package contents                              | `extension` job     |
| Worker bundle present; deploy controller refuses without credentials | `worker-bundle` job |
| Production dependency advisories                                     | `audit` job         |

**Rules that hold regardless of urgency:**

1. A red gate is not merged around. If a gate is wrong, the gate is fixed and its
   `*-gate-enforces` suite updated to prove the new behaviour.
2. No rule is disabled to make a build pass. No `eslint-disable` added to silence a real
   finding, no test skipped, no file excluded, no assertion weakened to a tautology.
3. Deployment never happens on push. The string `wrangler deploy` is banned from the
   push-triggered workflow and a test enforces the ban — a `--dry-run` flag is one
   deletion away from publishing on every commit.
4. Secrets are never inlined. A test scans the workflow for credential-shaped literals.

## 2. Feature intake (AZ-446)

A capability enters the product through the **feature registry**
(`src/lib/features.ts`), not through a screen. `registerFeature` throws when a
non-active feature has no user-facing reason, which makes the following impossible to
skip:

1. Register the feature with a status: `active`, `beta`, `setup_required`, `planned` or
   `hidden`.
2. A non-active status requires a `reason` the user will actually read. "Coming later —
   not an AI model." is a reason; "TODO" is not.
3. Register every triggerable action in `src/lib/actions.ts`, with its log class, risk
   category, and whether it needs a preview or confirmation.
4. The no-dead-button audit (`npm run controls:check`) scans the rendered JSX and fails
   on any control that neither acts, navigates, opens a setup flow, nor explains itself.

The order matters: a control cannot exist before the thing it triggers is declared.

## 3. Architecture review (AZ-447)

Required when a change would:

- add or alter a **trust boundary** in `boundaries.json`;
- add an **external integration** — the test will fail until it is declared, which is the
  review being forced rather than requested;
- change a **shared type surface** (Supabase types, mobile secure channel, brain adapter);
- introduce a new **runtime** or move code across an existing one;
- change how the **engine is selected**, since that decides whether a request stays on the
  device.

The output is an ADR in [`adr/`](adr/) with Status, Context, Decision and Consequences.
Consequences is not optional — it is the section read two years later by someone deciding
whether the decision still holds.

## 4. Safety review (AZ-448)

Required for anything touching files, accounts, messages, databases, operating-system
controls, or an external service. The standard is set by the Rust safety core and the
control plane:

1. **Explicit permission.** Capability granted per action, not ambient.
2. **A preview.** The user sees what will happen before it happens.
3. **A cancel path** that works mid-flight.
4. **An audit record** with protected content redacted.
5. **A verifier** deriving the outcome from observed postconditions rather than from the
   actor's own report.
6. **No claimed authority.** The plane never asserts an OS capability it does not hold;
   `perceptionRuntimeReadiness` lists what is missing by name.

Safety-relevant refusals are proven by executed tests, and the Rust assertions —
protected-text detection, prohibited typing, path-traversal rejection, unapproved-app
refusal, audit redaction — run on Linux, Windows and macOS in CI.

## 5. Database migration policy (AZ-449)

1. Every migration ships with a **rollback** and a **verification** script. Parity is
   asserted by `db-twin.test.ts`, which counts all three sets.
2. Every migration applies to an **empty database**. Proven by applying all 33 to a real
   PostgreSQL 18.3 (PGlite) in CI — not by reading the SQL.
3. **Row-level security on every public table**, with policies, verified under
   `SET ROLE authenticated`. A superuser bypasses RLS and would pass regardless, so the
   suite also proves the two paths differ.
4. **Never reconstruct a table from generated types.** They carry columns but not
   policies, and a multi-tenant table rebuilt without RLS converts a loud build failure
   into a silent data exposure. This rule is why DB-01 stood open for so long, and it was
   the correct call.
5. **Platform objects are guarded, not assumed.** `supabase_realtime` is created by
   Supabase's bootstrap, not by any migration here; touching it unconditionally broke
   from-scratch rebuilds (DB-02).
6. **Migrations are not deleted once applied.** The hosted project's ledger recorded
   them; removing a file rewrites history the database already has.

## 6. Deprecation policy (AZ-048)

A capability going away is marked in the feature registry with a non-active status and a
user-facing reason **before** it is removed. Nothing user-visible is deleted while still
reachable from navigation — the failure mode being a live link to a route that no longer
exists.

Currently deprecated: `ficia.placeholder`, `madee.placeholder`, `cania.placeholder`. All
three keep a route and a rail entry so existing links resolve and the names stay
reserved; each shows one sentence. Their sub-routes, dashboards and data are gone, and a
test asserts the navigation offers no path to them.

## 7. Requirement acceptance criteria (AZ-019)

A requirement's status is its acceptance criterion, and the weights are not negotiable:

| Status                       | Weight | Means                                          |
| ---------------------------- | -----: | ---------------------------------------------- |
| NOT STARTED                  |      0 | Nothing exists                                 |
| PARTIAL SOURCE               |    0.2 | Some code, incomplete                          |
| SOURCE COMPLETE              |    0.4 | Written, no executing test                     |
| EXTERNALLY BLOCKED           |    0.4 | Complete as far as this repository can take it |
| UNIT TESTED                  |    0.5 | Executing tests over the owning modules        |
| INTEGRATION TESTED           |    0.6 | Executed across a real seam                    |
| SIMULATED RUNTIME VERIFIED   |    0.7 | Executed against a faithful simulation         |
| REAL TARGET RUNTIME VERIFIED |    1.0 | **Observed working on the real target**        |

Enforced by `scripts/check-evidence-integrity.mjs`:

- evidence must cite files that exist;
- a structural test — one that reads source text rather than executing it — can never
  support a runtime claim;
- an `EXTERNALLY BLOCKED` row may not exceed 0.6, because if the work is genuinely
  blocked then nobody has seen it run;
- a row with positive weight must name the phase that observed the evidence.

Only 1.0 means complete. A row at 0.5 is tested code that has never run where it ships,
and the distance between those two is the honest measure of readiness.

## 8. Requirement dependencies (AZ-020)

Dependencies are structural rather than a hand-maintained graph, which cannot go stale:

- **Evidence tier ordering.** A row cannot claim a tier above what its evidence supports.
- **Blocker records.** An externally blocked row names its exit condition and its owner
  (`ownerKind: "external"`), and the gate fails if either is missing.
- **Gate ordering in CI.** Evidence integrity runs _before_ readiness, because scoring
  dishonest rows accurately is not much use.
- **Build ordering.** Gates reading `.output/` run after the production build.

## 9. Roadmap (AZ-445)

Ordered by what unblocks the most, not by size.

**Now — no external dependency**

1. Consolidate the six overlapping engine-selection layers into one tested decision path.
2. Break up the oversized screens (`ocade.tsx` is 3,936 lines).
3. Raise `SOURCE COMPLETE` rows to executed evidence where a test is possible.

**Next — needs credentials or infrastructure** 4. Apply the Supabase migrations to the hosted project and regenerate types from the live
schema. 5. Observe a green hosted CI run across all three platforms. 6. Staging deployment, so rows can move from unit-tested to integration-tested.

**Later — needs hardware, accounts or people** 7. Signed desktop companion → unblocks process control, window control, clean-machine
install (≈30 rows). 8. Mobile store accounts and devices → unblocks the mobile and pairing rows. 9. Consented stakeholder research → the only route for those rows, whose evidence
contract explicitly excludes synthetic fixtures.

## 10. Portfolio management (AZ-450)

One product ships: **OCADE**. FICIA, MADEE and CANIA are retired product names,
not active destinations or actionable placeholders. The current decision and its
historical reasoning are recorded in
[`DECISIONS.md`](DECISIONS.md#ocade-is-the-only-shipped-product). Three half-built
products made the repository read as further along than it was, carried most of the
lint risk around untyped employee and timesheet data, and displayed placeholder figures
that looked like working software.

A retired product returns only through §2 feature intake and §3 architecture review,
not by restoring deleted screens from Git history.
