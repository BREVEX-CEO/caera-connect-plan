# OCADE — Programme Charter

This document is descriptive, not aspirational. Every claim about what the product
does is a claim about code in this repository, and the machine-checkable ones live in
[`boundaries.json`](boundaries.json) where a test fails when they stop being true.

---

## 1. Vision

**OCADE is an AI assistant that runs on the user's own hardware wherever it can, and
tells the truth about the times it cannot.**

Every general-purpose assistant sends the user's words to somebody else's computer.
That is a reasonable trade for most people most of the time, and it is not a trade
everyone can make: a clinician with patient notes, a solicitor with a client file, an
engineer under an NDA, or anyone who simply does not want their documents to leave the
building.

OCADE's position is that the choice should be explicit and legible rather than assumed.
So the product is built around three commitments:

1. **Local first, and actually local.** A model runs on the device through WebGPU,
   WebAssembly, a paired computer, or a local runtime bound to loopback. When one is
   available it is used.
2. **No silent cloud.** If no local engine can serve a request, OCADE says so and names
   the action that would fix it. It does not quietly upload instead. `brain/router.ts`
   is the module that enforces this, and its own comment is the rule: _"a local-first
   product that silently uploads when things get hard is not a local-first product; it
   is a cloud product with a good mood."_
3. **Say what happened.** Where the request went, how much of a document was read, what
   was searched, what could not be read, and why.

## 2. Personas

Three, in the order the product was designed for.

### P1 — The person with documents they cannot upload

A professional handling material covered by confidentiality, contract, or basic
discretion. Technically competent but not an engineer. Owns a normal laptop — no
dedicated GPU, 8–16 GB RAM.

_What they need:_ to attach a long document and ask about it, and to know the file did
not leave the machine. _What breaks them:_ a product that reads the file, sends it, and
mentions this in a settings page they never opened.

_What OCADE does for them:_ extraction runs on-device; retrieval cuts the document into
sections and sends only matching passages; the answer carries `Searched 61 document
sections and used the best 4.`

### P2 — The person on an ordinary machine who wants a fast answer

Not privacy-motivated. Wants a competent assistant that does not cost anything and does
not feel slow.

_What they need:_ speed and reliability. _What breaks them:_ an eight-minute wait while a
laptop re-reads a document it will use four lines of — the measured failure that
retrieval exists to fix (20,000 characters → 5,654 tokens → 458 seconds of evaluation
for 3.8 seconds of answer).

### P3 — The operator deploying OCADE for other people

Runs it for a team. Needs to know what leaves the network, what credentials exist, and
what happens when a dependency fails.

_What they need:_ declared integrations, a schema that rebuilds from zero, gates that
fail on a false claim. _What breaks them:_ a status document that says "complete" over
code that was never run.

## 3. Outcomes

The product succeeds if:

| Outcome                                                        | Observable as                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A confidential document can be used without leaving the device | Extraction and retrieval run client-side; only selected passages ever reach a server |
| The user always knows where a request went                     | An engine label on every answer; a named refusal when none is available              |
| A long document is usable on a laptop                          | Retrieval sends a bounded budget rather than the whole file                          |
| A failure is legible                                           | Every dependency failure returns a named reason, not a generic error                 |
| A claim in this repository can be checked                      | Every gate fails on a bad input, verified by mutation                                |

## 4. Non-goals

Recorded because a non-goal that is never written down gets built anyway.

- **Not a foundation-model trainer.** CAERA CADANE trains no model. The system prompt
  forbids claiming otherwise.
- **Not an autonomous agent.** Anything touching files, accounts, messages, databases or
  operating-system controls requires explicit permission, a preview, and a cancel path.
  The Director/Hands/Eyes/Verifier plane holds no OS authority of its own.
- **Not a social or collaborative product.** No feeds, no sharing, no multiplayer.
- **Not free cloud inference.** Cloud is metered and the meter is visible. The landing
  page says "never called free" because an unmetered promise would be broken later.
- **Not a replacement for a browser or an operating system.** Computer control is scoped,
  permissioned and observable, not ambient.
- **Not FICIA, MADEE or CANIA.** Three products were started and are not shipping. Their
  routes say so in one sentence rather than showing half-built dashboards.

## 5. Ethical boundaries

These are enforced in code. The trust boundaries in
[`boundaries.json`](boundaries.json) are the mechanisms; these are the commitments.

1. **Never misrepresent where data went.** The privacy badge reflects the resolved
   storage mode, not the requested one. A vault-backed conversation refuses cloud
   transfer with HTTP 428 until the user approves that specific turn.
2. **Never claim work that did not happen.** OCADE does not say it searched a document
   when retrieval did not run, does not present unmatched passages as relevant, and
   reports a weak match as weak.
3. **Never fabricate a citation.** A citation marker that does not resolve to an indexed
   source is discarded rather than rendered.
4. **Never bill for a failure.** The cloud allowance is charged only on a completed
   answer.
5. **Never expose a local engine to the network.** A runtime that cannot be bound to
   loopback is not started.
6. **Never obey a document.** Attachment content is wrapped as untrusted data with role
   markers defanged before any engine sees it.
7. **A refusal must name the remedy.** "Unavailable" without a next step is a dead end
   wearing an error message.

### Where the ethics are genuinely in tension

The system prompt instructs the model not to name the provider behind OCADE Cloud, and
replies are redacted before storage. This is presented as product identity, and it sits
uneasily beside commitment 1. The resolution the product has chosen: **capability
labels are used everywhere, and the exact runtime is disclosed in advanced settings** —
those pages are listed by name in the identity test's exemption list, and
`OnlineProvidersPanel` names each provider plainly because a user connecting an account
must know whose account it is. Anyone reviewing this should know the tension exists
rather than discover it.

## 6. Governance

- **The repository is the authority.** Where a planning document and the code disagree,
  the code wins and the document is corrected.
- **A declared status is not evidence.** A capability may be called real working only
  when a retained real-target receipt proves the production path it names.
- **Gates must fail.** Every gate has a paired `*-gate-enforces` suite proving it rejects
  a bad input. A gate that cannot fail is decoration.
- **External blockers are named, not absorbed.** Signing certificates, store accounts,
  physical devices and consented human research remain `BLOCKED` with one owner action.
- **Process is in [`GOVERNANCE.md`](GOVERNANCE.md).**

## 7. Success metrics

Measured, with the current value where one exists. Sources are the test suite, gates and
retained runtime receipts—no metric here is inferred from a weighted checklist.

| #   | Metric                                             | Target | Current                    |
| --- | -------------------------------------------------- | ------ | -------------------------- |
| M1  | Test failures on `main`                            | 0      | 0                          |
| M2  | TypeScript errors                                  | 0      | 0                          |
| M3  | Lint errors and warnings                           | 0      | 0                          |
| M4  | Development and release gates passing              | all    | measured in CI             |
| M5  | Migration set rebuilds an empty database           | yes    | yes, 34/34                 |
| M6  | Public tables without row-level security           | 0      | 0                          |
| M7  | Database type bypasses (`pendingFrom`-style `any`) | 0      | 0                          |
| M8  | Capability states without proof or a blocker       | 0      | 0                          |
| M9  | Real-target capabilities with retained receipts    | rising | categorical report         |
| M10 | Document context sent, as a share of the document  | < 25%  | ~20% on the reference case |

The authoritative release view is [`OCADE_CAPABILITY_STATUS.json`](../release/OCADE_CAPABILITY_STATUS.json):
`REAL WORKING`, `PARTIAL`, `BLOCKED`, or `NOT IMPLEMENTED`, with no score or percentage.
