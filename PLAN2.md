# PLAN2 — OCADE Cowork and Jarvis

## Preconditions

Do not start this plan until every `PLAN.md` gate is green and the core product has a verified checkpoint.

`PLAN2.md` builds Cowork. It does not reopen or duplicate the core Chat, auth, usage, Library, Settings or Offline Intelligence authorities.

## There is no donor

Cowork is written for OCADE, in OCADE's own architecture. The `.incoming/` donor archive is deleted and will not return; nothing in this plan waits for it, extracts it, or preserves its structure.

That is a decision, not an omission. A donor tree is a second architecture arriving with its own runtime, its own registries and its own idea of permissions, and the whole point of the `PLAN.md` rebuild was to stop having two of anything. What survives from the original intent is the CAPABILITY LIST below, which is what the owner actually wanted — not the code that once implemented it.

## What Cowork is

One runtime, two presentations:

- **Cowork** — a prompt/task composer that looks related to Chat.
- **Jarvis** — the voice-first, hands-free presentation of the same runtime.

They share session state, permissions and approvals, the action registry, the online intelligence boundary, the usage permit, verification receipts, cancellation state and the Library output path. They must never diverge into two engines.

One successful user request consumes one usage unit. Internal steps do not multiply the charge.

## Capability order

Build in this order, and ship nothing that cannot be proven:

1. **Browser actions** — navigate, read, fill, click, extract, with observation before acting and re-observation after.
2. **Files** — read and write inside scoped, approved locations, into Library where the output is the person's.
3. **Voice** — speech in, speech out, explicit microphone state, text fallback always present.
4. **Computer actions** — only on hardware where they can be genuinely verified, and only behind an explicit capability grant.

Anything not yet built is absent from the interface rather than present and disabled with a promise.

## Phase 1 — One Cowork runtime

Write the runtime: session/task state, a typed action registry, permissions and approvals, bounded execution, postcondition verification, cancellation/pause/takeover, and one path for outputs into Library.

It reaches intelligence through `ocadeIntelligence()` and takes its permit through `beginBilledRequest` — the same two authorities Chat uses, not copies of them.

**Gate:** the same requested operation reaches the same runtime from both presentations.

## Phase 2 — Cowork UI

Cowork uses the same shell language as Chat, with `docs/design-references/grok/` as the sole visual reference.

Empty state:

```text
What should OCADE do?
[ composer ]
Recent work
```

During work show only: a concise goal, a short verified step list, a meaningful approval request, Pause, Take over and Stop. Receipts live behind a contextual Details view, never as permanent panels.

**Gate:** a real browser journey proves start → observe → act → re-observe → verified result, plus pause, take over and stop.

## Phase 3 — Jarvis inside Cowork

Jarvis is a mode inside Cowork, never a separate primary destination.

```text
Cowork
[ Cowork | Jarvis ]
```

For this release Jarvis is online only and uses OCADE's own server boundary. Continuous microphone state is explicit, visible and revocable. A small original OCADE audio indicator is the only visual addition; there is no cinematic scene. Text remains a complete alternative to speech.

**Gate:** voice and text commands produce the same verified semantics.

## Phase 4 — Permissions and safety

Every state-changing action requires a scoped capability permission, observation before acting where applicable, approval at sensitive or destructive boundaries, bounded execution, postcondition re-observation, and a truthful failure when the result cannot be proven.

Stop cancels active work. Take over hands control back and invalidates stale observations.

No desktop or Copilot product UI returns. Native helpers, if any are needed, are infrastructure for Cowork and are never a second product.

**Gate:** unsafe, unapproved and unsupported actions fail closed.

## Phase 5 — Persistence

Cowork outputs flow into the existing Library authority. Persist only the durable Cowork state that recovery, audit or security actually needs; execution detail stays transient.

Do not recreate Tasks, Artifacts or Projects as products because the runtime has internal task concepts.

**Gate:** Cowork outputs appear in Library with no second store.

## Phase 6 — Final verification

Test the exact production build as a real user: Chat, Library, Cowork, Jarvis, Account and Settings; signed out and signed in; desktop, tablet and phone widths; usage shared across every surface and device; browser actions; files; approvals; pause, take over and stop; voice in and out and microphone revocation; provider failures; postcondition verification; Library outputs; reload and recovery; and the security and secret scans.

Run the same tracked-source LOC measurement `PLAN.md` uses, and record the final figure and the reduction from the original baseline.

## Definition of PLAN2 complete

OCADE exposes Chat, Library and Cowork. Cowork and Jarvis are two presentations over one OCADE-written runtime. There is no donor tree, no second control stack and no standalone Code, Tasks or Artifacts product, and the complete final tree is proven before it reaches `main`.
