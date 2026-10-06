# CLAUDE.md — OCADE Engineering Rules Only

This file contains execution rules only. Product requirements, architecture, features, UI decisions, platform scope and roadmap live in `PLAN.md` and the authority documents it references. Do not restate product specifications here.

## 1. Authority and startup

1. Read the Owner's latest instruction first.
2. Read `PLAN.md` completely before implementation.
3. Read `AGENTS.md`, `ToRemove.md`, the current error/debloat/strategy ledgers, and the domain authority for the area being changed.
4. Re-check current `main`, working-tree state and deployment/test baseline before making claims.
5. Newer explicit Owner authority wins over older conflicting text.
6. Historical audits are evidence, not automatic current truth. Reproduce before fixing.
7. Never modify immutable donor/source-original archives or rewrite applied migration history.

## 2. Simplicity rules

### KISS
Keep the solution direct. Prefer a clear linear implementation over layers, registries, factories, agents, wrappers or indirection that do not solve a measured requirement.

### YAGNI
Do not build speculative flexibility. No future-use modules, placeholder systems, unused extension points, generic frameworks or parallel implementations without a current requirement and proof.

### DRY, with low coupling first
Remove duplicated authorities and genuinely repeated mechanics. Do not force two similar implementations into a shared abstraction when doing so increases coupling or obscures ownership.

### WET threshold
Two small local copies may remain when clearer. When the same real logic appears a third time, evaluate one minimal shared helper. Abstract behavior, not superficial syntax.

### One authority per concern
When two active paths own the same state/action/lifecycle, choose the proven authority and retire the redundant path after parity evidence.

### Delete before adding
When changing architecture, first ask whether an obsolete branch/helper/module can be removed instead of adding another router or compatibility layer.

### Data over branches
Prefer compact capability data/configuration to giant conditionals, app-name maps, copied menus and one-off aliases.

## 3. Active code reduction

Treat code size as an engineering constraint.

- Target approximately 50% reduction in active product/control/UI implementation where proof shows equivalent or better behavior with less code.
- Continue below that size when safe; do not stop because a percentage was reached.
- Do not count immutable donor snapshots, historical audits, applied migrations, required generated artifacts, legal/provenance records or still-useful tests as disposable line-count bloat.
- Never delete correctness, security, account isolation, permissions, accessibility, cancellation, recovery, update safety, fidelity, verification or evidence merely to hit a metric.
- Every deletion requires: caller trace -> replacement authority -> targeted proof -> removal -> targeted regression -> nearby integration -> adversarial check -> broader regression.
- Use Ponytail Ultra or equivalent proof-based cleanup after behavior works, and again at final cleanup.
- Use Caveman-style review to challenge unnecessary architecture and reduce moving parts.
- Do not leave commented-out implementations, dead compatibility branches or duplicate fallback systems after replacement is proven.

## 4. No app-specific proliferation

Do not solve a new application by adding a permanent application-name branch, coordinate map, copied menu tree or dedicated controller by default.

Prefer discovery, documented APIs, scripting, structured interfaces, semantic control and validated task-specific execution.

A specialized adapter is allowed only when measured evidence proves a material advantage in reliability, fidelity, safety, performance or platform integration. It must sit behind the canonical authority and must not create a second privileged execution path.

Never store reusable screen coordinates.

## 5. Performance discipline

- Optimize verified completion latency, not click-speed demos.
- Keep deterministic inner loops local.
- Avoid model calls between deterministic sub-actions.
- Prefer event/callback/subscription completion signals over recurring polling when a trustworthy event owner exists.
- Keep bounded polling only for reconnect/recovery/fail-safe use.
- Cache only sanitized stable capability metadata; invalidate narrowly when its assumptions change.
- Send deltas/relevant observations rather than repeatedly transmitting unchanged full state.
- Batch bounded machine-native operations when preconditions remain valid.
- Measure p50/p95/p99 before and after performance changes.
- Never trade away verification, STOP, permissions or data preservation for benchmark speed.

## 6. Minimal-code implementation loop

For each change:

1. reproduce;
2. identify the single root cause;
3. identify the current authority;
4. design the smallest correct fix;
5. remove superseded code where safe;
6. run targeted tests;
7. run the real applicable workflow;
8. deliberately try to break it;
9. run nearby/broader regression;
10. measure size/complexity/performance impact;
11. run cleanup only after equivalence is proved;
12. record exact evidence.

Do not fix symptoms by layering retries, sleeps, extra polling, extra state or another controller unless the root cause requires it.

## 7. Error-ledger rule

Read all current ledger findings before implementation.

For each valid finding:

- reproduce on current code;
- fix root cause, not wording;
- add/retain the smallest meaningful regression;
- verify actual behavior;
- update evidence honestly.

Never mark PASS because code "looks correct". Never convert BLOCKED/UNTESTED into PASS.

## 8. UI engineering rules

- Prefer fewer surfaces and fewer controls.
- Do not expose implementation/tool choices to ordinary users.
- One obvious primary action per state.
- Reuse a small design-token system for spacing, typography, radii, motion and states.
- Prefer soft rounded/pill geometry consistently rather than many one-off shapes.
- Avoid duplicate desktop/mobile component trees when responsive composition can share behavior.
- Lazy-mount expensive secondary visuals.
- Every async action needs truthful pending/success/error/blocked behavior.
- Never display a failed read as an empty state.
- Keyboard, focus, touch and reduced-motion behavior are release requirements, not polish.
- Remove obsolete UI only after its policy/security function has a proven replacement.

## 9. Testing rules

- A build starting is not evidence.
- A model/tool saying "success" is not evidence.
- Verify observable outcomes independently.
- Test the actual affected platform when available.
- Emulation/WebKit is compatibility evidence, never physical-device proof.
- Keep tests deterministic and focused; remove brittle source-string tests when stronger behavioral proof replaces them.
- Do not create fake product branches merely to make a test pass.
- Do not weaken a security assertion because the implementation is inconvenient.
- Continue independent tests when one subsystem is blocked.

## 10. Security and destructive changes

- Fail closed on identity, authorization, scope, confirmation, control lease and cancellation ambiguity.
- Do not bypass OS/browser security controls.
- Do not print or commit secrets.
- Keep provider credentials server-side.
- Preserve originals/recovery before destructive file transformations unless explicit overwrite authority exists.
- Read `ToRemove.md` before any deletion, schema retirement, branch cleanup or major simplification.
- Applied migrations are immutable history; use forward changes.

## 11. Dependency and framework rules

Before adding a dependency:

1. prove the standard library/current dependency cannot reasonably solve it;
2. measure the problem;
3. justify maintenance/security/size cost;
4. prefer the smallest mature dependency;
5. remove the dependency if its only consumer is later removed.

Do not add a framework to delete a few duplicated functions.

## 12. Documentation rules

- `PLAN.md` is the master product/work plan.
- Keep this file rules-only.
- Do not duplicate product requirements across rule files.
- Update active authority when a newer Owner decision supersedes stale guidance.
- Preserve historical evidence; distinguish history from current authority.
- Documentation must not claim functionality stronger than current verified behavior.

## 13. Git and release discipline

- Keep unrelated working-tree changes untouched.
- Do not hide failures with generated-output churn.
- Commit coherent verified changes.
- Never equate merge with deployment.
- Build/sign/publish/deploy/update steps require their own evidence.
- Never force-push or rewrite shared history without explicit Owner authorization.
- If Owner requires a stop/read-only/audit phase, obey it exactly.

## 14. Completion standard

A task is not complete until:

- requested behavior exists;
- root-cause defects are fixed;
- superseded code is removed when safely provable;
- targeted and broader evidence passes;
- relevant real workflow is verified or honestly marked blocked;
- no known release-scope Critical/Major defect introduced by the change remains;
- code is as small and understandable as practical;
- documentation matches reality.

Prefer a smaller proven system over a larger impressive-looking system.
