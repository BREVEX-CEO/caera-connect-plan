# ADR 0002 — Retrieve document passages with BM25, not embeddings

## Status

Accepted, 2026-08-06.

## Context

OCADE sent the whole of every attachment to the engine. On a datacentre GPU that is
merely wasteful; on the hardware this product targets it is the difference between usable
and not.

Measured on the reference machine (16 GB RAM, integrated graphics, no dedicated GPU),
from the engine's own counters:

|                   |                   |
| ----------------- | ----------------- |
| Document          | 20,000 characters |
| Tokens            | 5,654             |
| Prompt evaluation | **458.4 seconds** |
| Answer generation | 3.8 seconds       |

Eight minutes of waiting for a machine to re-read a document it will use four lines of.

The obvious fix is semantic retrieval with embeddings, and on a server that is what you
would reach for. Here it is self-defeating: embedding a document costs the same prompt
evaluation the retrieval exists to avoid — measured at 12.3 tokens per second — so
embedding 5,654 tokens to save reading 5,654 tokens saves nothing. It also requires a
second model resident in memory this machine does not have.

## Decision

Rank passages with **BM25**. No model, no download, no memory, no network. It runs in
milliseconds on any machine OCADE will meet, and it is deterministic.

Supporting choices, each of which is a defect avoided:

- **Cut on line boundaries, never mid-line.** A cut inside a line splits a table row or a
  statement and both halves become unmatchable.
- **Overlap by one line.** A fact straddling a cut is otherwise in neither passage well
  enough to be found.
- **Carry line numbers through.** A passage that has lost its position can only be cited
  as "somewhere in this file", which is the same as not citing it.
- **A line longer than the whole budget becomes its own passage.** Minified JSON and
  one-line CSV exports look like this, and dropping them silently is the worst failure —
  the document appears to have been read.
- **Digits are terms.** `742913`, `Q4-2026` and `v2.1.3` are exactly what people search
  their own documents for.
- **Short documents are sent whole.** Below the budget, searching can only lose
  information.
- **Zero matches means say so.** Handing over the top-scoring passage of a set that all
  scored zero presents an unrelated paragraph as the relevant one.

## Consequences

**Good**

- ~20% of the document is sent on the reference case, so roughly a fifth of the wait.
- Deterministic and debuggable: a user can be told which sections were used.
- Works fully offline, with no second model.

**Costs**

- **Genuinely weaker at "find the part that MEANS X in other words."** BM25 matches
  words, not concepts. This is not hidden: when fewer than half the question's terms are
  found, the result is reported as a weak match and the missing terms are named.
- Retrieval can drop the answer. The first test in the suite is therefore the needle
  test — given the same document and question, the line that answers it must survive the
  cut. A retriever that is fast and drops the answer is worse than none, because the model
  then answers confidently from the wrong lines.

**Revisit when** the target hardware can hold a small embedding model alongside the chat
model without swapping. The passage-splitting and citation work is reusable; only the
ranking function would change.
