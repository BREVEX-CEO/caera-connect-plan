# ADR 0003 — Refuse honestly rather than fall back to cloud

## Status

Accepted. Predates this record; written down here because it is the decision the whole
product rests on and it was enforced in code with no document behind it.

## Context

OCADE routes between engines: WebGPU and WebAssembly in the browser, a paired computer, a
local runtime on loopback, and cloud. Engines become unavailable constantly and for
ordinary reasons — no GPU, a model not downloaded, the desktop asleep, the user offline.

The convenient behaviour is to fall back to cloud. The user gets an answer, nothing looks
broken, and the product feels reliable.

It also means a person who chose OCADE **because** their document should not leave the
building has it uploaded at the moment their laptop was busy. They are not told. The
product's central promise fails silently, exactly when it mattered.

## Decision

When no permitted engine can serve a request, **OCADE says so and offers something the
user can do**. It does not quietly reach for the cloud, and it does not produce an answer
from nowhere.

Mechanically:

- `brain/router.ts` returns either a chosen adapter or a refusal carrying a reason and a
  list of remedies to render as buttons.
- The refusal sentence is written **per device mode**, because the useful next step
  genuinely differs: a browser on a laptop can install the desktop app, a phone should
  pair with a computer, a machine with OCADE installed probably needs its engine started.
  One generic "no engine available" would be true everywhere and useful nowhere.
- Cloud is a routing outcome the user can switch off, and when it is off the refusal says
  so rather than overriding it.
- The same rule governs the relay path: `direct_only` refuses rather than routing through
  the relay, and the refusal names the setting.
- Dependency failures follow it too. Every failed read in the chat endpoint returns a
  named 503 rather than answering with partial context — OCADE would rather not answer
  than answer from a conversation it could not fully load.

## Consequences

**Good**

- The privacy claim is structural rather than a policy sentence.
- Refusals are actionable, so the failure teaches the user how to fix it.
- The rule generalises: no silent substitution anywhere, including the relay, memory
  context and document retrieval.

**Costs**

- **OCADE visibly fails more often than a product that falls back.** This is the trade,
  and it is the right one, but it is real: a user who does not care about privacy
  experiences a worse product on a bad day.
- Every refusal path needs its own sentence and remedies, which is more work than one
  generic error and is why the refusal text lives in one tested module rather than being
  written at each call site.
- Testing requires every device mode to be reachable from a unit test, which is why
  device mode, tier policy and routing all take their inputs as arguments — a rule that
  can only be exercised on the device it describes is a rule nobody has tested.
