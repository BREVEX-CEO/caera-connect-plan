/**
 * OCADE Code — applying changes to source, reversibly.
 *
 * This is the mutation contract from the plan, made concrete for code:
 * preconditions (the context must match), expected result, verification (the
 * output is re-read), receipt (what changed, by line), and undo (a real inverse
 * patch, not a backup copy).
 *
 * THE RULE THAT SHAPES ALL OF IT: **no fuzzy matching.**
 *
 * Every patch tool eventually offers to apply a hunk whose context doesn't
 * quite match — shifted by a line, or with whitespace differences. It is
 * enormously convenient and it is how a change lands in the wrong function.
 * The file still compiles. The diff still looks right in review. The bug is
 * found weeks later somewhere nobody was looking.
 *
 * So a hunk applies at exactly the position its context matches, or the whole
 * patch is refused with the mismatch shown. A refused patch changes nothing:
 * application is all-or-nothing, because a half-applied patch leaves source in
 * a state no one designed and the undo is no longer valid.
 */

export type PatchOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export type LineOp =
  | { kind: "context"; text: string }
  | { kind: "add"; text: string }
  | { kind: "remove"; text: string };

export interface Hunk {
  /** 1-based line in the original file where this hunk's context starts. */
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  ops: LineOp[];
}

export interface Patch {
  /** Path as written in the diff header, for the receipt. */
  path: string;
  hunks: Hunk[];
}

/* --------------------------------------------------------------- parsing -- */

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse a unified diff.
 *
 * Counts declared in the `@@` header are checked against the lines that follow.
 * A header claiming five lines over a hunk with four is a corrupted or
 * hand-edited diff, and applying it would silently shift everything after.
 */
export function parseUnifiedDiff(text: string): PatchOutcome<Patch> {
  if (!text.trim()) return { ok: false, reason: "That patch is empty." };

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  /*
   * A diff file conventionally ends with a newline, which `split` turns into a
   * trailing empty element. That element is the file terminator, not a line of
   * the patch — counting it as an empty context line inflates every final hunk
   * by one and makes the header counts disagree. A genuine empty context line
   * is written as a single space, so it survives this.
   */
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  let path: string | null = null;
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;

  const finish = (): string | null => {
    if (!current) return null;
    const removed = current.ops.filter((o) => o.kind !== "add").length;
    const added = current.ops.filter((o) => o.kind !== "remove").length;
    if (removed !== current.oldLines) {
      return `A hunk at line ${current.oldStart} declares ${current.oldLines} original lines but contains ${removed}. Applying it would shift everything after it.`;
    }
    if (added !== current.newLines) {
      return `A hunk at line ${current.oldStart} declares ${current.newLines} new lines but contains ${added}.`;
    }
    hunks.push(current);
    current = null;
    return null;
  };

  for (const line of lines) {
    if (line.startsWith("--- ")) continue;
    if (line.startsWith("+++ ")) {
      const err = finish();
      if (err) return { ok: false, reason: err };
      // Strip the conventional a/ b/ prefix.
      path = line.slice(4).trim().replace(/^b\//, "");
      continue;
    }

    const header = HUNK_HEADER.exec(line);
    if (header) {
      const err = finish();
      if (err) return { ok: false, reason: err };
      current = {
        oldStart: Number(header[1]),
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        ops: [],
      };
      continue;
    }

    if (!current) continue; // preamble before the first hunk

    if (line.startsWith("+")) current.ops.push({ kind: "add", text: line.slice(1) });
    else if (line.startsWith("-")) current.ops.push({ kind: "remove", text: line.slice(1) });
    else if (line.startsWith(" ")) current.ops.push({ kind: "context", text: line.slice(1) });
    else if (line === "") {
      // A bare empty line inside a hunk is an empty context line in most
      // real-world diffs; treated as such only while a hunk is open.
      current.ops.push({ kind: "context", text: "" });
    } else if (line.startsWith("\\")) {
      continue; // "\ No newline at end of file"
    } else {
      return { ok: false, reason: `Unexpected line in the patch: “${line.slice(0, 40)}”.` };
    }
  }

  const err = finish();
  if (err) return { ok: false, reason: err };

  if (!path)
    return {
      ok: false,
      reason: "This patch has no file header, so OCADE can't tell what it applies to.",
    };
  if (hunks.length === 0) return { ok: false, reason: "This patch contains no changes." };

  const changed = hunks.reduce((n, h) => n + h.ops.filter((o) => o.kind !== "context").length, 0);
  return {
    ok: true,
    data: { path, hunks },
    evidence: `${hunks.length} hunk${hunks.length === 1 ? "" : "s"}, ${changed} changed line${changed === 1 ? "" : "s"}, in ${path}.`,
  };
}

/* ------------------------------------------------------------- applying -- */

export interface ApplyResult {
  content: string;
  /** The patch that undoes this one, ready to apply. */
  inverse: Patch;
  linesAdded: number;
  linesRemoved: number;
}

/**
 * Apply a patch, exactly.
 *
 * Each hunk must match its declared position character for character. On any
 * mismatch the WHOLE patch is refused and nothing is written — see the module
 * header for why partial application is worse than none.
 */
export function applyPatch(original: string, patch: Patch): PatchOutcome<ApplyResult> {
  const hasCrLf = original.includes("\r\n");
  const withoutCrLf = original.replace(/\r\n/g, "");
  if (withoutCrLf.includes("\r") || (hasCrLf && withoutCrLf.includes("\n"))) {
    return {
      ok: false,
      reason:
        "This file uses mixed or unsupported line endings. OCADE will not normalize it silently; make the line endings consistent before applying a patch.",
    };
  }
  const lineEnding = hasCrLf ? "\r\n" : "\n";
  const hadTrailingNewline = original.endsWith(lineEnding);
  const lines = original.replace(/\r\n/g, "\n").split("\n");
  // A trailing newline produces a final empty element that isn't a line.
  if (hadTrailingNewline) lines.pop();

  // Hunks must be in ascending order, or the offsets they describe overlap.
  for (let i = 1; i < patch.hunks.length; i++) {
    if (patch.hunks[i].oldStart <= patch.hunks[i - 1].oldStart) {
      return {
        ok: false,
        reason: "This patch's hunks are out of order, so their line numbers can't all be right.",
      };
    }
  }

  const out: string[] = [];
  const inverseHunks: Hunk[] = [];
  let cursor = 0; // 0-based index into `lines`
  let added = 0;
  let removed = 0;
  let offset = 0; // running difference between old and new line numbers

  for (const hunk of patch.hunks) {
    const start = hunk.oldStart - 1;
    if (start < cursor) {
      return { ok: false, reason: `A hunk at line ${hunk.oldStart} overlaps the previous one.` };
    }
    if (start > lines.length) {
      return {
        ok: false,
        reason: `This patch expects a hunk at line ${hunk.oldStart}, but the file has only ${lines.length} lines.`,
      };
    }

    // Copy the untouched run before this hunk.
    out.push(...lines.slice(cursor, start));

    let read = start;
    const inverseOps: LineOp[] = [];

    for (const op of hunk.ops) {
      if (op.kind === "add") {
        out.push(op.text);
        added++;
        inverseOps.push({ kind: "remove", text: op.text });
        continue;
      }

      const actual = lines[read];
      if (actual === undefined) {
        return {
          ok: false,
          reason: `The patch expects “${op.text}” at line ${read + 1}, but the file ends at line ${lines.length}.`,
        };
      }
      if (actual !== op.text) {
        // The precondition. No fuzz, no whitespace tolerance, no nearby search.
        return {
          ok: false,
          reason: `Line ${read + 1} doesn't match what this patch expects.\n  expected: ${JSON.stringify(op.text)}\n  found:    ${JSON.stringify(actual)}\nOCADE won't apply a patch to a file that has changed underneath it — that's how an edit lands in the wrong place. Nothing was written.`,
        };
      }

      if (op.kind === "context") {
        out.push(op.text);
        inverseOps.push({ kind: "context", text: op.text });
      } else {
        removed++;
        inverseOps.push({ kind: "add", text: op.text });
      }
      read++;
    }

    inverseHunks.push({
      // The inverse runs against the NEW file, so its start is shifted.
      oldStart: hunk.oldStart + offset,
      oldLines: hunk.newLines,
      newStart: hunk.oldStart,
      newLines: hunk.oldLines,
      ops: inverseOps,
    });

    offset += hunk.newLines - hunk.oldLines;
    cursor = read;
  }

  out.push(...lines.slice(cursor));

  const content = out.join(lineEnding) + (hadTrailingNewline ? lineEnding : "");
  return {
    ok: true,
    data: {
      content,
      inverse: { path: patch.path, hunks: inverseHunks },
      linesAdded: added,
      linesRemoved: removed,
    },
    evidence: `+${added} −${removed} in ${patch.path}. Reversible: an undo patch was produced with it.`,
  };
}

/**
 * Apply a patch and prove the result can be undone.
 *
 * The inverse is applied to the result and compared with the original, in
 * memory, before anything is reported as done. An undo that is merely *derived*
 * is not an undo that *works*, and the difference only shows up when someone
 * needs it.
 */
export function applyReversibly(original: string, patch: Patch): PatchOutcome<ApplyResult> {
  const applied = applyPatch(original, patch);
  if (!applied.ok) return applied;

  const undone = applyPatch(applied.data.content, applied.data.inverse);
  if (!undone.ok) {
    return {
      ok: false,
      reason: `The change applied, but its undo patch doesn't work (${undone.reason}). OCADE won't make a change it can't reverse, so nothing was written.`,
    };
  }
  if (undone.data.content !== original) {
    return {
      ok: false,
      reason:
        "The change applied, but undoing it wouldn't restore the original exactly. OCADE won't make a change it can't reverse, so nothing was written.",
    };
  }

  return {
    ok: true,
    data: applied.data,
    evidence: `${applied.evidence} Undo verified: reversing it reproduces the original byte for byte.`,
  };
}

/* ---------------------------------------------------------------- receipt -- */

export interface PatchReceipt {
  path: string;
  linesAdded: number;
  linesRemoved: number;
  hunks: number;
  /** True only when the undo was actually exercised, not merely produced. */
  undoVerified: boolean;
  evidence: string;
}

export function buildPatchReceipt(
  patch: Patch,
  result: ApplyResult,
  undoVerified: boolean,
): PatchReceipt {
  return {
    path: patch.path,
    linesAdded: result.linesAdded,
    linesRemoved: result.linesRemoved,
    hunks: patch.hunks.length,
    undoVerified,
    evidence: undoVerified
      ? `${patch.path}: +${result.linesAdded} −${result.linesRemoved} across ${patch.hunks.length} hunk${patch.hunks.length === 1 ? "" : "s"}, undo verified.`
      : `${patch.path}: +${result.linesAdded} −${result.linesRemoved} across ${patch.hunks.length} hunk${patch.hunks.length === 1 ? "" : "s"}. NOT CONFIRMED: the undo was produced but never exercised.`,
  };
}
