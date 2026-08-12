/**
 * Answers you can reproduce, and differences you can see.
 *
 * THE PROBLEM WITH A CLOUD ASSISTANT AS A TOOL OF RECORD. Ask the same question
 * twice and you may get different answers — different sampling, and often a
 * different model, because the vendor upgrades continuously and does not tell
 * you when. Nothing is pinned. If an answer informed a decision in March, there
 * is no way in June to establish what the system actually said, or to show that
 * the change came from the model rather than from you.
 *
 * That rules those tools out of anything that needs a defensible record:
 * clinical notes, compliance review, legal drafting, safety analysis, audit.
 *
 * OCADE holds the weights. The model is a file with a digest, it does not
 * change under you, and the sampler runs locally — so a run can be pinned to a
 * SEED and a MODEL DIGEST and repeated exactly. This module is the bookkeeping
 * that makes that usable: pin a run, repeat it, and get a precise account of
 * what differed if anything did.
 *
 * HONESTY ABOUT DETERMINISM. Identical output needs identical weights, sampler,
 * seed AND numerics. GPU kernels are not always bit-reproducible across drivers
 * or hardware, so `RunPin` records the backend too, and a mismatch is reported
 * as "conditions differed" rather than silently blamed on the model. Claiming
 * determinism we cannot deliver would be the same failure as everything else
 * this codebase refuses to do.
 */

import { sha256OfText, isRealDigest } from "../provenance/digest";

export interface RunPin {
  /** Everything that must match for a repeat to be meaningful. */
  promptSha256: string;
  modelKey: string;
  modelSha256: string;
  seed: number;
  temperature: number;
  topP: number;
  /** "webgpu" | "wasm" | a companion id — numerics differ between them. */
  backend: string;
}

export interface PinnedRun {
  pin: RunPin;
  answer: string;
  answerSha256: string;
  at: string;
}

/**
 * A seed from a prompt, when the caller does not supply one.
 *
 * Derived rather than random so that "run this again" is possible from the
 * pin alone. A random seed nobody recorded is the same as no seed.
 */
export function seedFor(prompt: string): number {
  let hash = 2166136261;
  for (let i = 0; i < prompt.length; i += 1) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Positive 31-bit: sampler seeds are conventionally non-negative.
  return hash >>> 1;
}

export async function pinRun(input: {
  prompt: string;
  answer: string;
  modelKey: string;
  modelSha256: string;
  seed?: number;
  temperature: number;
  topP: number;
  backend: string;
  at?: Date;
}): Promise<PinnedRun> {
  const [promptSha256, answerSha256] = await Promise.all([
    sha256OfText(input.prompt),
    sha256OfText(input.answer),
  ]);
  return {
    pin: {
      promptSha256,
      modelKey: input.modelKey,
      modelSha256: input.modelSha256,
      seed: input.seed ?? seedFor(input.prompt),
      temperature: input.temperature,
      topP: input.topP,
      backend: input.backend,
    },
    answer: input.answer,
    answerSha256,
    at: (input.at ?? new Date()).toISOString(),
  };
}

export type ConditionChange = {
  field: keyof RunPin;
  before: string | number;
  after: string | number;
  /** Whether this alone explains a different answer. */
  explainsDifference: boolean;
};

export interface RepeatVerdict {
  /** True when the answers are byte-identical. */
  identical: boolean;
  /** True when every pinned condition matched. */
  conditionsMatched: boolean;
  changes: ConditionChange[];
  summary: string;
}

/**
 * Compare a repeat against its pin.
 *
 * The order of reporting is deliberate: CONDITIONS FIRST. A different answer
 * under different conditions is not a surprise and should not be presented as
 * one. A different answer under identical conditions is the interesting case,
 * and it is the only one worth alarming about.
 */
export function compareRuns(original: PinnedRun, repeat: PinnedRun): RepeatVerdict {
  const changes: ConditionChange[] = [];
  const fields: Array<{ key: keyof RunPin; explains: boolean }> = [
    { key: "promptSha256", explains: true },
    { key: "modelSha256", explains: true },
    { key: "modelKey", explains: true },
    { key: "seed", explains: true },
    { key: "temperature", explains: true },
    { key: "topP", explains: true },
    // Numerics can differ between a GPU and a CPU path even with identical
    // weights and seed, so this explains a difference without implying fault.
    { key: "backend", explains: true },
  ];

  for (const { key, explains } of fields) {
    if (original.pin[key] !== repeat.pin[key]) {
      changes.push({
        field: key,
        before: original.pin[key],
        after: repeat.pin[key],
        explainsDifference: explains,
      });
    }
  }

  const identical =
    isRealDigest(original.answerSha256) && original.answerSha256 === repeat.answerSha256;
  const conditionsMatched = changes.length === 0;

  return {
    identical,
    conditionsMatched,
    changes,
    summary: summarise(identical, conditionsMatched, changes),
  };
}

function summarise(
  identical: boolean,
  conditionsMatched: boolean,
  changes: ConditionChange[],
): string {
  if (identical && conditionsMatched) {
    return "Reproduced exactly. Same question, same engine, same settings, same answer.";
  }
  if (identical && !conditionsMatched) {
    /*
     * Names the changed conditions here too. "Identical despite changes" is
     * only reassuring if you can see what changed — an identical answer to a
     * DIFFERENT QUESTION is not a reproduction at all, it is a coincidence
     * worth noticing.
     */
    const names = changes.map((c) => readable(c.field)).join(", ");
    return `The answer is identical even though the conditions changed: ${names}.`;
  }
  if (!conditionsMatched) {
    const names = changes.map((c) => readable(c.field)).join(", ");
    // Not "the model changed its mind" — the setup changed, and that is a
    // different and much less alarming statement.
    return `The answer differs, and so did the conditions: ${names}. Match those to compare like for like.`;
  }
  return "The answer differs under identical conditions. On this engine that means sampling is not deterministic here — pin the seed and check the backend.";
}

function readable(field: keyof RunPin): string {
  switch (field) {
    case "promptSha256":
      return "the question";
    case "modelKey":
      return "which engine";
    case "modelSha256":
      return "the engine file";
    case "seed":
      return "the seed";
    case "temperature":
      return "temperature";
    case "topP":
      return "top-p";
    case "backend":
      return "the hardware path";
  }
}

/* ------------------------------------------------------------- diffing -- */

export interface DiffSpan {
  kind: "same" | "added" | "removed";
  text: string;
}

/**
 * A word-level diff of two answers.
 *
 * Word granularity rather than character: a character diff of prose produces
 * unreadable confetti, and the question being asked here is "what did it say
 * differently", not "which bytes moved".
 *
 * Longest-common-subsequence, which is O(n·m). Answers are bounded by the
 * context window, so this is fine — and a heuristic diff that occasionally
 * mis-aligns would undermine the one thing this view is for.
 */
export function diffAnswers(before: string, after: string): DiffSpan[] {
  const a = before.split(/(\s+)/).filter((t) => t.length > 0);
  const b = after.split(/(\s+)/).filter((t) => t.length > 0);

  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const spans: DiffSpan[] = [];
  const push = (kind: DiffSpan["kind"], text: string) => {
    const last = spans[spans.length - 1];
    if (last && last.kind === kind) last.text += text;
    else spans.push({ kind, text });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("removed", a[i]);
      i += 1;
    } else {
      push("added", b[j]);
      j += 1;
    }
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);
  return spans;
}

/** How much of the answer actually changed, 0–1. */
export function driftRatio(spans: readonly DiffSpan[]): number {
  const total = spans.reduce((n, s) => n + s.text.length, 0);
  if (total === 0) return 0;
  const changed = spans.filter((s) => s.kind !== "same").reduce((n, s) => n + s.text.length, 0);
  return changed / total;
}
