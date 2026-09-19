/ponytail ultra
/caveman ultra

# OCADE Claude Instructions

## First action of every session

Before reading, planning, editing, debugging, reviewing, testing, continuing after compaction, or resuming interrupted work, **run these two commands first**:

```text
/ponytail ultra
/caveman ultra
```

After any new session, resumed session, context-compacted session, Auto Continue restart, or other fresh execution context, run them again before proceeding.

Then read `AGENTS.md`, the current task, `PLAN.md`, `docs/MEMORY.md`, and only the relevant canonical documents under `docs/`.

## Working rule

`AGENTS.md` is the permanent agent handbook. `PLAN.md` is the active mission authority and must not be rewritten unless the owner explicitly asks. Follow the owner-approved product decisions in the canonical docs.

Work independently. Trace the repository and live authority, reproduce safely, fix root causes, add regression coverage, test, deliberately try to break the fix, simplify with YAGNI/KISS, and continue. Ask the owner only for a genuinely owner-only credential, payment, legal/business choice, destructive approval, or hardware/account interaction that the available environment cannot perform.

Keep progress concise. Never hide a failed test, blocker, security/privacy risk, deployment mismatch, or the difference between live proof and simulation.

## Product invariants

- Company: **CARCC**. Product: **OCADE**. No current CADANE branding.
- Current product: website-only, Chat-first. Chat, Library, Settings, Offline Intelligence, usage/limits, Pricing, auth and public/legal surfaces come before any separate future mission.
- Customer selector: **Auto | Online | Offline**.
- Provider/model/vendor/runtime identities never appear in normal customer surfaces or client-visible diagnostics.
- Offline model bytes/chunks/checkpoints/model metadata are stored **only in OPFS**.
- A verified compatible Offline release must not redownload merely because the website was updated.
- Explicit Remove suppresses automatic reinstall until the customer explicitly chooses Install Offline.
- Manual Offline makes zero Online provider requests and does not accept image input.
- One successful logical answer is one use; failure is zero; retries/fallback do not double-charge.
- Free 28/6h28m; Pro 140/6h28m + 700/week; Max 1,400/6h28m + 7,000/week.
- Paid checkout is closed. Do not add/revive Paddle.
- GitHub Actions is optional; run equivalent verification locally/through available direct authorities.

## Engineering doctrine

Use one canonical authority per responsibility. Prefer deletion/reuse over new abstractions. Use native/platform primitives before new dependencies. Remove dead, duplicate, stale and unreachable code when safe. Never remove required security, validation, accessibility, reliability, evidence, or tests merely to reduce line count.

Customer-facing success must always be real. Never fake authentication, AI output, Offline readiness, synchronization, upload, payment, hardware acceleration, deployment or external integration.

Before completion, run the relevant targeted tests and full verification on the exact reconciled tree, then perform an adversarial browser/QA pass that tries to break the real customer flows. Never claim external or hardware proof that was not actually performed.
