/**
 * The result shape used by every OCADE operation that can honestly refuse.
 *
 * A refusal carries a `reason` a person can act on; a success carries the
 * `evidence` line that says what actually happened, which is what makes a
 * confirmation on screen more than a hopeful "Saved". Neither is optional,
 * because the failure this exists to prevent is the one where an operation
 * returns nothing, the caller assumes it worked, and nobody finds out until
 * the data is missing.
 *
 * It lived in `artifacts/store.ts` and was called `ArtifactOutcome`, which was
 * true when artifacts were the only caller. Memory, citations and the evidence
 * ledger use it too, so it belongs somewhere none of them owns.
 */
export type Outcome<T> = { ok: true; data: T; evidence: string } | { ok: false; reason: string };
