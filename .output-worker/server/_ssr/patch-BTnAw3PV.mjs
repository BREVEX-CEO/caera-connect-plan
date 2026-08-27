//#region node_modules/.nitro/vite/services/ssr/assets/patch-BTnAw3PV.js
var HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
/**
* Parse a unified diff.
*
* Counts declared in the `@@` header are checked against the lines that follow.
* A header claiming five lines over a hunk with four is a corrupted or
* hand-edited diff, and applying it would silently shift everything after.
*/
function parseUnifiedDiff(text) {
	if (!text.trim()) return {
		ok: false,
		reason: "That patch is empty."
	};
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
	let path = null;
	const hunks = [];
	let current = null;
	const finish = () => {
		if (!current) return null;
		const removed = current.ops.filter((o) => o.kind !== "add").length;
		const added = current.ops.filter((o) => o.kind !== "remove").length;
		if (removed !== current.oldLines) return `A hunk at line ${current.oldStart} declares ${current.oldLines} original lines but contains ${removed}. Applying it would shift everything after it.`;
		if (added !== current.newLines) return `A hunk at line ${current.oldStart} declares ${current.newLines} new lines but contains ${added}.`;
		hunks.push(current);
		current = null;
		return null;
	};
	for (const line of lines) {
		if (line.startsWith("--- ")) continue;
		if (line.startsWith("+++ ")) {
			const err = finish();
			if (err) return {
				ok: false,
				reason: err
			};
			path = line.slice(4).trim().replace(/^b\//, "");
			continue;
		}
		const header = HUNK_HEADER.exec(line);
		if (header) {
			const err = finish();
			if (err) return {
				ok: false,
				reason: err
			};
			current = {
				oldStart: Number(header[1]),
				oldLines: header[2] === void 0 ? 1 : Number(header[2]),
				newStart: Number(header[3]),
				newLines: header[4] === void 0 ? 1 : Number(header[4]),
				ops: []
			};
			continue;
		}
		if (!current) continue;
		if (line.startsWith("+")) current.ops.push({
			kind: "add",
			text: line.slice(1)
		});
		else if (line.startsWith("-")) current.ops.push({
			kind: "remove",
			text: line.slice(1)
		});
		else if (line.startsWith(" ")) current.ops.push({
			kind: "context",
			text: line.slice(1)
		});
		else if (line === "") current.ops.push({
			kind: "context",
			text: ""
		});
		else if (line.startsWith("\\")) continue;
		else return {
			ok: false,
			reason: `Unexpected line in the patch: “${line.slice(0, 40)}”.`
		};
	}
	const err = finish();
	if (err) return {
		ok: false,
		reason: err
	};
	if (!path) return {
		ok: false,
		reason: "This patch has no file header, so OCADE can't tell what it applies to."
	};
	if (hunks.length === 0) return {
		ok: false,
		reason: "This patch contains no changes."
	};
	const changed = hunks.reduce((n, h) => n + h.ops.filter((o) => o.kind !== "context").length, 0);
	return {
		ok: true,
		data: {
			path,
			hunks
		},
		evidence: `${hunks.length} hunk${hunks.length === 1 ? "" : "s"}, ${changed} changed line${changed === 1 ? "" : "s"}, in ${path}.`
	};
}
/**
* Apply a patch, exactly.
*
* Each hunk must match its declared position character for character. On any
* mismatch the WHOLE patch is refused and nothing is written — see the module
* header for why partial application is worse than none.
*/
function applyPatch(original, patch) {
	const hasCrLf = original.includes("\r\n");
	const withoutCrLf = original.replace(/\r\n/g, "");
	if (withoutCrLf.includes("\r") || hasCrLf && withoutCrLf.includes("\n")) return {
		ok: false,
		reason: "This file uses mixed or unsupported line endings. OCADE will not normalize it silently; make the line endings consistent before applying a patch."
	};
	const lineEnding = hasCrLf ? "\r\n" : "\n";
	const hadTrailingNewline = original.endsWith(lineEnding);
	const lines = original.replace(/\r\n/g, "\n").split("\n");
	if (hadTrailingNewline) lines.pop();
	for (let i = 1; i < patch.hunks.length; i++) if (patch.hunks[i].oldStart <= patch.hunks[i - 1].oldStart) return {
		ok: false,
		reason: "This patch's hunks are out of order, so their line numbers can't all be right."
	};
	const out = [];
	const inverseHunks = [];
	let cursor = 0;
	let added = 0;
	let removed = 0;
	let offset = 0;
	for (const hunk of patch.hunks) {
		const start = hunk.oldStart - 1;
		if (start < cursor) return {
			ok: false,
			reason: `A hunk at line ${hunk.oldStart} overlaps the previous one.`
		};
		if (start > lines.length) return {
			ok: false,
			reason: `This patch expects a hunk at line ${hunk.oldStart}, but the file has only ${lines.length} lines.`
		};
		out.push(...lines.slice(cursor, start));
		let read = start;
		const inverseOps = [];
		for (const op of hunk.ops) {
			if (op.kind === "add") {
				out.push(op.text);
				added++;
				inverseOps.push({
					kind: "remove",
					text: op.text
				});
				continue;
			}
			const actual = lines[read];
			if (actual === void 0) return {
				ok: false,
				reason: `The patch expects “${op.text}” at line ${read + 1}, but the file ends at line ${lines.length}.`
			};
			if (actual !== op.text) return {
				ok: false,
				reason: `Line ${read + 1} doesn't match what this patch expects.\n  expected: ${JSON.stringify(op.text)}\n  found:    ${JSON.stringify(actual)}\nOCADE won't apply a patch to a file that has changed underneath it — that's how an edit lands in the wrong place. Nothing was written.`
			};
			if (op.kind === "context") {
				out.push(op.text);
				inverseOps.push({
					kind: "context",
					text: op.text
				});
			} else {
				removed++;
				inverseOps.push({
					kind: "add",
					text: op.text
				});
			}
			read++;
		}
		inverseHunks.push({
			oldStart: hunk.oldStart + offset,
			oldLines: hunk.newLines,
			newStart: hunk.oldStart,
			newLines: hunk.oldLines,
			ops: inverseOps
		});
		offset += hunk.newLines - hunk.oldLines;
		cursor = read;
	}
	out.push(...lines.slice(cursor));
	return {
		ok: true,
		data: {
			content: out.join(lineEnding) + (hadTrailingNewline ? lineEnding : ""),
			inverse: {
				path: patch.path,
				hunks: inverseHunks
			},
			linesAdded: added,
			linesRemoved: removed
		},
		evidence: `+${added} −${removed} in ${patch.path}. Reversible: an undo patch was produced with it.`
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
function applyReversibly(original, patch) {
	const applied = applyPatch(original, patch);
	if (!applied.ok) return applied;
	const undone = applyPatch(applied.data.content, applied.data.inverse);
	if (!undone.ok) return {
		ok: false,
		reason: `The change applied, but its undo patch doesn't work (${undone.reason}). OCADE won't make a change it can't reverse, so nothing was written.`
	};
	if (undone.data.content !== original) return {
		ok: false,
		reason: "The change applied, but undoing it wouldn't restore the original exactly. OCADE won't make a change it can't reverse, so nothing was written."
	};
	return {
		ok: true,
		data: applied.data,
		evidence: `${applied.evidence} Undo verified: reversing it reproduces the original byte for byte.`
	};
}
function buildPatchReceipt(patch, result, undoVerified) {
	return {
		path: patch.path,
		linesAdded: result.linesAdded,
		linesRemoved: result.linesRemoved,
		hunks: patch.hunks.length,
		undoVerified,
		evidence: undoVerified ? `${patch.path}: +${result.linesAdded} −${result.linesRemoved} across ${patch.hunks.length} hunk${patch.hunks.length === 1 ? "" : "s"}, undo verified.` : `${patch.path}: +${result.linesAdded} −${result.linesRemoved} across ${patch.hunks.length} hunk${patch.hunks.length === 1 ? "" : "s"}. NOT CONFIRMED: the undo was produced but never exercised.`
	};
}
//#endregion
export { parseUnifiedDiff as i, applyReversibly as n, buildPatchReceipt as r, applyPatch as t };
