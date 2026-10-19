# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.


## 5. Session Start: Caveman + Ponytail + OCADE

- **First in Claude Code, if both plugins are installed:** activate `/caveman ultra`, then `/ponytail full`. These are **Claude Code chat commands**, not terminal commands. Reading this file cannot execute slash commands; do not claim either mode is active unless confirmed. If unavailable, follow the principles below without blocking work or installing anything unapproved.
- Caveman Ultra shortens **chat replies**, never code, identifiers, commands, evidence, security warnings or persistent documentation. Use complete sentences whenever compression could be ambiguous.
- Ponytail Full means **the smallest complete, readable implementation**; not code golf, skipped requirements or reduced verification.
- **OCADE authority:** read [`AGENTS.md`](AGENTS.md), the *relevant* current [open-work entry](BLOCKED_TESTS.md) and [owner decisions](docs/DECISIONS.md), and only its owning domain document. Recheck `main` and the exact SHA; continue the first unfinished dependency-ready package. Never create competing plans or reread unchanged files without need.

## 6. Extreme Debloat: Smallest Complete Change

For every requested change, use the first option that **fully** solves it:

1. **Omit:** reject speculative features, unused settings, premature generality, and unnecessary compatibility layers.
2. **Reuse:** search the affected callers and existing implementation owner before creating anything. Prefer established project components and patterns.
3. **Built-ins:** use supported native APIs, language/standard-library facilities, or existing dependencies; avoid new packages for trivial code.
4. **Simplify:** prefer direct control flow, minimal state, small interfaces, and clear expressions. Use one line **only if immediately readable**.
5. **Implement:** add only the remaining essential code, including all necessary callers, integration points, tests and failure handling.

- **One owner per concern.** No duplicate state stores, validators, executors, planners, registries, wrappers, helpers or app-specific branches without proven need.
- **Do not micro-modularise.** Group related operations in the existing domain file; split functions/files only when clarity, true reuse, testing, or ownership improves. No arbitrary function-length limit.
- **Readable beats shortest.** Descriptive names, obvious control flow, consistent project style; no dense clever one-liners, unnecessary comments, or hidden side effects.
- **Dependencies are liabilities.** Prefer existing capabilities. Introduce a new package only with a demonstrated gap, licence/security review, and measurable maintenance benefit.
- **Debloat means removing code.** Actively identify and **delete** proven duplicate, dead, unused, obsolete and unnecessary production code—not merely shorten new code. Treat the owner's cleanup request and `ToRemove.md` as explicit permission to assess existing candidates, but remove each only after tracing all callers, demonstrating replacement/behaviour parity, preserving required safeguards and tests, and rerunning regressions. Do not delete useful, undocumented-but-live, or unrelated code based solely on file size or search results.
- **No bloat in fixes.** Reproduce a defect; repair the shared root cause instead of stacking sleeps, retries, polling, flags, fallbacks, or duplicate error handlers.
- **Avoid repeat context scans.** Reuse SHA-bound prior evidence; inspect changed, uncovered and directly affected files only. Report concise results, not repeated transcripts.

## 7. Never Minimise Safety or Verified Behaviour

- Preserve OCADE's local-first execution, scoped permissions, STOP/Take Over, account isolation, authentic task-result receipts, original-file safety, durable recovery, Offline Chat isolation, and online-only JARVIS planning.
- Never eliminate trust-boundary validation, crash/data-loss handling, accessibility, authorisation, auditability, security, required compatibility, or meaningful regression tests just to reduce lines.
- Never reimport donor sources (removed 11 October 2026). Preserve migration history, licences, signed update checks, and mandatory legal/commercial constraints.
- Keep essential edge cases correct; fewer lines are a benefit **only when outputs, correctness, security and maintenance are at least as good**.
- Never invent 0 bugs, 100% performance or guaranteed correctness. Treat any missing evidence as UNTESTED or BLOCKED, not PASS.

## 8. Proof-Gated Simplification and Delivery

1. Establish the exact requested outcome and current observable baseline. Trace affected code, callers, state and existing tests.
2. Make the smallest safe diff. Remove only proven orphans and redundancies inside the authorised scope.
3. Run regression and negative-path tests; verify real output and relevant STOP, privacy, restart and failure behaviour. Try to break the fix.
4. For performance claims, measure before/after latency, memory, startup, bundle, requests, and applicable cost; report regressions, not imagined improvements.
5. Commit only with real evidence. No source/security/billing/deployment changes beyond authorised scope, and no production promotion without the separate owner gate.
6. Report briefly: **changed**, **removed**, **tests/results**, **measured gain**, **BLOCKED/UNTESTED**. Mention shortcuts only when they have a real limit and a clear trigger to revisit.

**Definition of success:** the smallest maintainable codebase that preserves every approved feature and safety invariant, with zero **known** unaddressed critical regressions in the verified scope—not an impossible promise of zero bugs everywhere.
