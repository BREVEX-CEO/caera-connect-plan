/**
 * OCADE Shadow Execution (master plan §23.9).
 *
 * "For high-risk tasks, compare planned changes against a temporary copy,
 * sandbox, preview, or dry-run before touching the real state."
 *
 * The pattern: apply the change to a COPY, check the copy satisfies what the
 * change was supposed to achieve, and only then report it safe to apply for
 * real. The real state is never touched here — this function cannot mutate it,
 * because it is never given it. It is given the current content and returns a
 * verdict; committing is the caller's separate, gated step.
 *
 * WHY POSTCONDITIONS, NOT JUST "DID IT APPLY". A patch can apply cleanly and
 * still be wrong: it lands, the file compiles, and it did the opposite of what
 * was intended. So the caller states what the result must be true of — a string
 * that must now be present, one that must be gone, a size bound — and shadow
 * execution refuses to bless a change whose shadow doesn't satisfy it. "It
 * applied" is not "it worked", and conflating them is how a confident wrong
 * edit ships.
 *
 * Built on the patch engine's reversible apply, so a shadow that passes is also
 * proven undoable before it is ever recommended for the real file.
 */
import { applyReversibly, type Patch } from "../code/patch";

export type ShadowOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export interface Postconditions {
  /** Substrings that MUST appear in the result. */
  mustContain?: string[];
  /** Substrings that must NOT appear (e.g. the bug being removed). */
  mustNotContain?: string[];
  /** Result byte length must not exceed this, if given. */
  maxBytes?: number;
  /** Result must differ from the original — a no-op change is usually a mistake. */
  mustChange?: boolean;
}

export interface ShadowResult {
  /** The content the real file WOULD have, if applied. Not yet written anywhere. */
  preview: string;
  /** True only when the patch applied AND every postcondition held. */
  safeToApply: boolean;
  /** Postconditions that failed, in the user's words. Empty when safe. */
  failures: string[];
  linesAdded: number;
  linesRemoved: number;
}

/**
 * Run a patch against a copy and check the result before recommending it.
 *
 * Returns `safeToApply: false` with named failures rather than throwing, so the
 * caller can show exactly why the real file was left untouched.
 */
export function shadowApplyPatch(
  original: string,
  patch: Patch,
  postconditions: Postconditions = {},
): ShadowOutcome<ShadowResult> {
  // applyReversibly does NOT mutate `original` — it returns a new string and
  // proves the change can be undone. This is the "temporary copy".
  const applied = applyReversibly(original, patch);
  if (!applied.ok) {
    // The patch didn't even apply to the copy. The real file is safe by
    // construction — nothing was attempted against it.
    return {
      ok: true,
      data: {
        preview: original,
        safeToApply: false,
        failures: [`The change doesn't apply cleanly: ${applied.reason}`],
        linesAdded: 0,
        linesRemoved: 0,
      },
      evidence: "Shadow apply failed; the real file was never touched.",
    };
  }

  const preview = applied.data.content;
  const failures: string[] = [];

  for (const needle of postconditions.mustContain ?? []) {
    if (!preview.includes(needle)) {
      failures.push(`The result should contain “${truncate(needle)}”, but it doesn't.`);
    }
  }
  for (const needle of postconditions.mustNotContain ?? []) {
    if (preview.includes(needle)) {
      failures.push(
        `The result should no longer contain “${truncate(needle)}”, but it still does.`,
      );
    }
  }
  if (postconditions.maxBytes !== undefined) {
    const bytes = new TextEncoder().encode(preview).length;
    if (bytes > postconditions.maxBytes) {
      failures.push(
        `The result is ${bytes} bytes, over the ${postconditions.maxBytes}-byte limit.`,
      );
    }
  }
  if (postconditions.mustChange && preview === original) {
    failures.push(
      "The change made no difference to the file — it was expected to change something.",
    );
  }

  const safeToApply = failures.length === 0;
  return {
    ok: true,
    data: {
      preview,
      safeToApply,
      failures,
      linesAdded: applied.data.linesAdded,
      linesRemoved: applied.data.linesRemoved,
    },
    evidence: safeToApply
      ? `Shadow run clean: +${applied.data.linesAdded} −${applied.data.linesRemoved}, every check held. Safe to apply, and reversible.`
      : `Shadow run held the real file back: ${failures.length} check${failures.length === 1 ? "" : "s"} failed. First: ${failures[0]}`,
  };
}

function truncate(s: string): string {
  const oneLine = s.replace(/\n/g, " ");
  return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine;
}

/**
 * The rule the caller must honour, stated so it cannot be lost.
 *
 * A shadow verdict of `safeToApply: false` means the real state must not be
 * changed. This constant exists so a UI or orchestrator that shows the preview
 * also shows what a failed shadow means.
 */
export const SHADOW_RULE =
  "A change is applied to a copy and checked before the real file is touched. If the shadow fails any check, the real file is left exactly as it was — OCADE does not apply a change it couldn't prove correct on the copy.";
