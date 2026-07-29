/**
 * OCADE Learning Replay (master plan §23.10).
 *
 * "Turn completed work into a private tutorial with steps, decisions,
 * mistakes, recovery, and final proof."
 *
 * A replay is built from a finished Evidence Ledger, so it can only narrate
 * what actually happened — it has no way to invent a smoother story than the
 * receipt records.
 *
 * THE RULE: the mistakes stay in. A tutorial that quietly drops the step that
 * failed, or the retry, or the recovery, teaches a path that never existed and
 * hides the part a reader most needs — what went wrong and how it was put
 * right. So failed and recovered steps are narrated explicitly, and the final
 * "proof" section reports the ledger's derived outcome verbatim: a partial task
 * produces a replay that says it was partial, never one that reads like a
 * success.
 */
import type { TaskLedger, LedgerStep } from "./evidence-ledger";
import { saveArtifact, type Artifact, type ArtifactOutcome } from "./store";

export interface ReplayStep {
  number: number;
  intent: string;
  /** What happened, in plain language, including a mistake if there was one. */
  narration: string;
  /** True when this step went wrong (whether or not it was recovered). */
  wasMistake: boolean;
}

export interface Replay {
  title: string;
  intro: string;
  steps: ReplayStep[];
  /** Honest closing statement derived from the ledger outcome. */
  proof: string;
  /** How many steps went wrong — surfaced, not hidden. */
  mistakes: number;
}

/**
 * Build a replay from a completed ledger.
 *
 * Skipped steps (ones that never ran because an earlier step halted the task)
 * are noted rather than narrated as work — pretending they happened would be
 * the same dishonesty in a smaller form.
 */
export function buildReplay(ledger: TaskLedger): Replay {
  const steps: ReplayStep[] = [];
  let number = 0;

  for (const step of ledger.steps) {
    if (step.status === "skipped") {
      number++;
      steps.push({
        number,
        intent: step.intent,
        narration: "Not reached — an earlier step stopped the task before this one.",
        wasMistake: false,
      });
      continue;
    }
    number++;
    steps.push({
      number,
      intent: step.intent,
      narration: narrate(step),
      wasMistake:
        step.status === "failed" || (step.recovery && step.recovery.action !== "none") === true,
    });
  }

  return {
    title: `How OCADE handled: ${ledger.intent || ledger.taskId}`,
    intro: `Starting point: ${ledger.initialState}`,
    steps,
    proof: proofFor(ledger),
    mistakes: steps.filter((s) => s.wasMistake).length,
  };
}

function narrate(step: LedgerStep): string {
  const parts: string[] = [];

  if (step.attempts > 1) {
    parts.push(`Took ${step.attempts} attempts.`);
  }

  if (step.status === "done") {
    parts.push(
      step.receipt?.verified
        ? `Done, and confirmed: ${step.receipt.evidence}`
        : `Done, but not independently confirmed: ${step.receipt?.evidence ?? "no evidence recorded"}.`,
    );
  } else if (step.status === "failed") {
    parts.push(
      step.receipt
        ? `Failed: ${step.receipt.evidence}`
        : "Failed before it could run, so nothing was changed by it.",
    );
    if (step.recovery && step.recovery.action !== "none") {
      parts.push(`Recovered by ${step.recovery.action}: ${step.recovery.evidence}`);
    }
  }

  return parts.join(" ");
}

function proofFor(ledger: TaskLedger): string {
  switch (ledger.outcome) {
    case "succeeded":
      return `Final proof: every step completed and was verified. Ending state — ${ledger.finalState}.`;
    case "partial":
      return `Honest ending: the task did NOT fully succeed. ${ledger.headline} Ending state — ${ledger.finalState}. Don't treat this replay as a recipe for a guaranteed result.`;
    case "failed":
      return `Honest ending: the task failed. ${ledger.headline} Ending state — ${ledger.finalState}.`;
    case "empty":
      return "Nothing ran, so there is nothing to replay.";
  }
}

/** Render the replay as Markdown — a tutorial is read by people. */
export function serialiseReplay(replay: Replay): string {
  const lines: string[] = [`# ${replay.title}`, "", replay.intro, ""];
  for (const step of replay.steps) {
    lines.push(`## Step ${step.number}: ${step.intent}${step.wasMistake ? " ⚠" : ""}`);
    lines.push(step.narration);
    lines.push("");
  }
  if (replay.mistakes > 0) {
    lines.push(
      `_${replay.mistakes} step${replay.mistakes === 1 ? "" : "s"} went wrong along the way; they are kept above on purpose._`,
    );
    lines.push("");
  }
  lines.push(`> ${replay.proof}`);
  return lines.join("\n");
}

/**
 * Persist a replay as a text artifact.
 *
 * Its verified flag follows the ledger outcome: a replay of a partial or failed
 * task is stored NOT CONFIRMED, so it can never be mistaken for a proven recipe.
 */
export async function saveReplayArtifact(ledger: TaskLedger): Promise<ArtifactOutcome<Artifact>> {
  const replay = buildReplay(ledger);
  return saveArtifact({
    name: `Replay — ${ledger.intent || ledger.taskId}`,
    kind: "text",
    content: serialiseReplay(replay),
    provenance: {
      producedBy: `ocade.replay:${ledger.taskId}`,
      verified: ledger.outcome === "succeeded",
      evidence: `Replay of a ${ledger.outcome} task, ${replay.mistakes} mistake(s) kept in.`,
    },
  });
}
