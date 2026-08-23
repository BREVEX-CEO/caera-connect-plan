# OCADE — Programme Charter

Register rows: AZ-001 vision · AZ-002 personas · AZ-003 outcomes · AZ-004 non-goals ·
AZ-005 ethical boundaries · AZ-007 governance · AZ-008 success metrics.

This document is descriptive, not aspirational. Every claim about what the product
does is a claim about code in this repository, and the machine-checkable ones live in
[`boundaries.json`](boundaries.json) where a test fails when they stop being true.

---

## 1. Vision (AZ-001)

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
   is the module that enforces this, and its own comment is the rule: *"a local-first
   product that silently uploads when things get hard is not a local-first product; it
   is a cloud product with a good mood."*
3. **Say what happened.** Where the request went, how much of a document was read, what
   was searched, what could not be read, and why.

## 2. Personas (AZ-002)

Three, in the order the product was designed for.

### P1 — The person with documents they cannot upload

A professional handling material covered by confidentiality, contract, or basic
discretion. Technically competent but not an engineer. Owns a normal laptop — no
dedicated GPU, 8–16 GB RAM.

*What they need:* to attach a long document and ask about it, and to know the file did
not leave the machine. *What breaks them:* a product that reads the file, sends it, and
mentions this in a settings page they never opened.

*What OCADE does for them:* extraction runs on-device; retrieval cuts the document into
sections and sends only matching passages; the answer carries `Searched 61 document
sections and used the best 4.`

### P2 — The person on an ordinary machine who wants a fast answer

Not privacy-motivated. Wants a competent assistant that does not cost anything and does
not feel slow.

*What they need:* speed and reliability. *What breaks them:* an eight-minute wait while a
laptop re-reads a document it will use four lines of — the measured failure that
retrieval exists to fix (20,000 characters → 5,654 tokens → 458 seconds of evaluation
for 3.8 seconds of answer).

### P3 — The operator deploying OCADE for other people

Runs it for a team. Needs to know what leaves the network, what credentials exist, and
what happens when a dependency fails.

*What they need:* declared integrations, a schema that rebuilds from zero, gates that
fail on a false claim. *What breaks them:* a status document that says "complete" over
code that was never run.

## 3. Outcomes (AZ-003)

The product succeeds if:

| Outcome | Observable as |
|---|---|
| A confidential document can be used without leaving the device | Extraction and retrieval run client-side; only selected passages ever reach a server |
| The user always knows where a request went | An engine label on every answer; a named refusal when none is available |
| A long document is usable on a laptop | Retrieval sends a bounded budget rather than the whole file |
| A failure is legible | Every dependency failure returns a named reason, not a generic error |
| A claim in this repository can be checked | Every gate fails on a bad input, verified by mutation |

## 4. Non-goals (AZ-004)

Recorded because a non-goal that is never written down gets built anyway.

- **Not a foundation-model trainer.** CAERA CADANE trains no model. The system prompt
  forbids claiming otherwise.
- **Not an autonomous agent.** Anything touching files, accounts, messages, databases or
  operating-system controls requires explicit permission, a preview, and a cancel path.
  The Director/Hands/Eyes/Verifier plane holds no OS authority of its own.
- **Not a social or collaborative product.** No feeds, no sharing, no multiplayer.
- **Not public-cloud inference.** Normal Chat, planning, summarization and image
  understanding run through reviewed local engines or refuse. Network access remains
  available for authentication, private sync, current information and connected services.
- **Not a replacement for a browser or an operating system.** Computer control is scoped,
  permissioned and observable, not ambient.
- **Not FICIA, MADEE or CANIA.** Three products were started and are not shipping. Their
  routes say so in one sentence rather than showing half-built dashboards.

## 5. Ethical boundaries (AZ-005)

These are enforced in code. The trust boundaries in
[`boundaries.json`](boundaries.json) are the mechanisms; these are the commitments.

1. **Never misrepresent where data went.** The privacy badge reflects the resolved
   storage mode, not the requested one. No storage mode creates a path to public-cloud
   AI inference.
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

The system prompt asks the model not to expose raw runtime or model identifiers in
ordinary answers, while advanced settings disclose the exact local runtime, weights and
licence. Capability labels preserve a stable product identity; technical settings remain
the evidence surface. Public-cloud AI providers are not an inference option.

## 6. Governance (AZ-007)

- **The repository is the authority.** Where a planning document and the code disagree,
  the code wins and the document is corrected.
- **A declared status is not evidence.** The readiness engine publishes two numbers — a
  declared score and an evidence-bound score — and a row with no requirement-specific
  evidence carries no weight.
- **Gates must fail.** Every gate has a paired `*-gate-enforces` suite proving it rejects
  a bad input. A gate that cannot fail is decoration.
- **External blockers are named, not absorbed.** 99 register rows are owned externally
  (signing certificates, store accounts, physical devices, consented human research).
  They are recorded as `EXTERNALLY BLOCKED` and capped below "proven" weight, because if
  work is genuinely blocked then nobody has seen it run.
- **Process is in [`GOVERNANCE.md`](GOVERNANCE.md).**

## 7. Success metrics (AZ-008)

Measured, with the current value where one exists. Sources are the test suite, the
gates, and the requirement register — no metric here is self-reported prose.

| # | Metric | Target | Current |
|---|---|---|---|
| M1 | Test failures on `main` | 0 | 0 |
| M2 | TypeScript errors | 0 | 0 |
| M3 | Lint errors and warnings | 0 | 0 |
| M4 | Gates passing | all | 24/24 |
| M5 | Migration set rebuilds an empty database | yes | yes, 33/33 |
| M6 | Public tables without row-level security | 0 | 0 |
| M7 | Database type bypasses (`pendingFrom`-style `any`) | 0 | 0 |
| M8 | Open defects in the register | 0 | 0 |
| M9 | Requirements with executed test evidence | rising | 388/510 |
| M10 | Requirements verified on their real target | rising | 27/510 |
| M11 | Document context sent, as a share of the document | < 25% | ~20% on the reference case |
| M12 | Unverified positive-weight requirement claims | 0 | 0 |

M9 and M10 are deliberately separate. M9 says the code is tested; M10 says it has been
observed working on the thing it ships to. The gap between them is the honest measure of
how far this product is from production, and collapsing them into one number is the
specific dishonesty the register exists to prevent.
