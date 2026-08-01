/**
 * OCADE master-document processor — PASS 1 (structure, chunks, line coverage).
 *
 * The source document is ~110k lines / 13.3 MB. That cannot fit in an AI
 * context window, so nothing here asks it to: the file is streamed line by
 * line, and every artifact this writes is small enough to be read back
 * selectively. The document is held on disk and in this process, never in a
 * model's memory.
 *
 * The output that matters most is the LINE COVERAGE PROOF. Any audit of a file
 * this size can claim to have "processed" it; this one has to demonstrate that
 * chunks tile the document exactly — first line covered, last line covered, no
 * gap, no unintended overlap, and the sum of chunk line counts equal to the
 * document's own line count. Those are asserted, and a failure is fatal rather
 * than a warning, because a coverage claim that can silently degrade is worth
 * nothing.
 *
 * Read-only: reads the source, writes only into out/.
 *
 * Usage: node audit/ocade-master-audit/process-document.mjs <path-to-md>
 */

import { createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const SOURCE = process.argv[2];
if (!SOURCE) {
  console.error("usage: node process-document.mjs <path-to-markdown>");
  process.exit(2);
}

/** Chunk sizing. A requirement block is never split unless it alone exceeds MAX. */
const TARGET_MIN = 800;
const TARGET_MAX = 2000;

const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/* ------------------------------------------------------------------ pass 1 */

const headings = [];
/** Every line, kept only as length + hash material; the text is not retained. */
let totalLines = 0;
let totalChars = 0;
const fileHash = createHash("sha256");

/** Buffered lines for the chunk currently being assembled. */
let chunkLines = [];
let chunkStart = 1;
const chunks = [];

/** Task/requirement headings, with the body accumulated for hashing. */
const requirements = [];
let currentReq = null;

function headingOf(line) {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  return m ? { level: m[1].length, text: m[2].trim() } : null;
}

/** A heading strong enough to close a chunk. */
const isBoundary = (h) => h && h.level <= 3;

function flushChunk(endLine) {
  if (chunkLines.length === 0) return;
  const body = chunkLines.join("\n");
  const first = chunkLines.find((l) => headingOf(l));
  const lastHeading = [...chunkLines].reverse().find((l) => headingOf(l));
  chunks.push({
    chunkId: `C${String(chunks.length + 1).padStart(4, "0")}`,
    sourceFile: SOURCE,
    startLine: chunkStart,
    endLine,
    firstHeading: first ? first.replace(/^#+\s*/, "") : null,
    lastHeading: lastHeading ? lastHeading.replace(/^#+\s*/, "") : null,
    lineCount: chunkLines.length,
    charCount: body.length,
    sha256: sha(body),
    status: "STRUCTURE PARSED",
  });
  chunkLines = [];
  chunkStart = endLine + 1;
}

function closeRequirement(endLine) {
  if (!currentReq) return;
  currentReq.endLine = endLine;
  currentReq.bodySha256 = sha(currentReq._body.join("\n"));
  // Normalised form: drop the lifecycle verb, digits and the task number so
  // that the ten lifecycle variants of one subject collapse together.
  const norm = currentReq.heading
    .replace(/^Task\s+[\d.]+\s*—\s*/i, "")
    .replace(
      /^(Inventory|Specify|Design|Implement|Wire|Test|Verify|Secure|Document|Establish)\s+/i,
      "",
    )
    .replace(/\d+/g, "N")
    .trim()
    .toLowerCase();
  currentReq.normalised = norm;
  currentReq.lifecycleStage =
    /^Task\s+[\d.]+\s*—\s*(\w+)/i.exec(currentReq.heading)?.[1]?.toLowerCase() ?? null;
  // Structural hash: body with digits normalised, so templated bodies that
  // differ only by phase number group together.
  currentReq.structuralSha256 = sha(currentReq._body.join("\n").replace(/\d+/g, "N").toLowerCase());
  delete currentReq._body;
  requirements.push(currentReq);
  currentReq = null;
}

const rl = createInterface({
  input: createReadStream(SOURCE, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

const headingPath = [];

for await (const line of rl) {
  totalLines += 1;
  totalChars += line.length;
  fileHash.update(line + "\n");

  const h = headingOf(line);

  if (h) {
    headingPath.length = Math.max(0, h.level - 1);
    headingPath[h.level - 1] = h.text;
    headings.push({ line: totalLines, level: h.level, text: h.text });

    // A new heading closes the previous requirement block.
    closeRequirement(totalLines - 1);

    // Requirement blocks are H3 task headings; H2s are phases/sections.
    if (h.level === 3) {
      currentReq = {
        heading: h.text,
        headingPath: headingPath.filter(Boolean).slice(0, 3),
        startLine: totalLines,
        _body: [],
      };
    }
  } else if (currentReq) {
    currentReq._body.push(line);
  }

  chunkLines.push(line);

  // Close a chunk at a boundary heading once past the minimum, or on overflow.
  const atBoundary = isBoundary(h) && chunkLines.length >= TARGET_MIN;
  if (atBoundary || chunkLines.length >= TARGET_MAX) {
    // Keep the boundary heading with the NEXT chunk when it opened this line.
    if (atBoundary && chunkLines.length > 1) {
      const held = chunkLines.pop();
      flushChunk(totalLines - 1);
      chunkLines.push(held);
      chunkStart = totalLines;
    } else {
      flushChunk(totalLines);
    }
  }
}
closeRequirement(totalLines);
flushChunk(totalLines);

/* ------------------------------------------------- line-coverage assertions */

const problems = [];
let expected = 1;
let covered = 0;
for (const c of chunks) {
  if (c.startLine !== expected) {
    problems.push(`gap or overlap at ${c.chunkId}: expected start ${expected}, got ${c.startLine}`);
  }
  if (c.endLine < c.startLine) problems.push(`${c.chunkId} ends before it starts`);
  covered += c.lineCount;
  expected = c.endLine + 1;
}
const firstCovered = chunks.length > 0 && chunks[0].startLine === 1;
const lastCovered = chunks.length > 0 && chunks[chunks.length - 1].endLine === totalLines;
if (!firstCovered) problems.push("first source line is NOT covered");
if (!lastCovered) problems.push("final source line is NOT covered");
if (covered !== totalLines) {
  problems.push(`covered lines ${covered} != document lines ${totalLines}`);
}

/* ------------------------------------------------------ duplicate grouping */

const byBody = new Map();
const byStructure = new Map();
for (const r of requirements) {
  if (!byBody.has(r.bodySha256)) byBody.set(r.bodySha256, []);
  byBody.get(r.bodySha256).push(r);
  if (!byStructure.has(r.structuralSha256)) byStructure.set(r.structuralSha256, []);
  byStructure.get(r.structuralSha256).push(r);
}

const canonicalBySubject = new Map();
for (const r of requirements) {
  if (!canonicalBySubject.has(r.normalised)) canonicalBySubject.set(r.normalised, []);
  canonicalBySubject.get(r.normalised).push(r);
}

const duplicateGroups = [];
let gid = 0;
for (const [hash, members] of byBody) {
  if (members.length > 1) {
    gid += 1;
    duplicateGroups.push({
      groupId: `EXACT-${String(gid).padStart(4, "0")}`,
      kind: "exact-body",
      sha256: hash,
      occurrences: members.length,
      canonicalHeading: members[0].heading,
      // Every occurrence's line range is preserved: deduplicated, never ignored.
      sourceLineRanges: members.map((m) => [m.startLine, m.endLine]),
    });
  }
}
let sid = 0;
for (const [hash, members] of byStructure) {
  if (members.length > 1) {
    sid += 1;
    duplicateGroups.push({
      groupId: `STRUCT-${String(sid).padStart(4, "0")}`,
      kind: "normalised-structural",
      sha256: hash,
      occurrences: members.length,
      canonicalHeading: members[0].heading,
      distinctHeadings: [...new Set(members.map((m) => m.heading))].length,
      sourceLineRanges: members.map((m) => [m.startLine, m.endLine]),
    });
  }
}

/* ----------------------------------------------------------------- outputs */

const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

writeFileSync(
  join(OUT, "OCADE_DOCUMENT_STRUCTURE.json"),
  JSON.stringify(
    {
      sourceFile: SOURCE,
      totalLines,
      totalChars,
      sha256: fileHash.digest("hex"),
      headingCount: headings.length,
      headingsByLevel: headings.reduce((a, h) => ((a[h.level] = (a[h.level] || 0) + 1), a), {}),
      chunkCount: chunks.length,
      requirementBlocks: requirements.length,
      canonicalSubjects: canonicalBySubject.size,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(join(OUT, "OCADE_CHUNK_MANIFEST.jsonl"), jsonl(chunks));
writeFileSync(
  join(OUT, "OCADE_LINE_COVERAGE.jsonl"),
  jsonl(
    chunks.map((c) => ({
      chunkId: c.chunkId,
      startLine: c.startLine,
      endLine: c.endLine,
      lineCount: c.lineCount,
      sha256: c.sha256,
    })),
  ),
);
writeFileSync(
  join(OUT, "OCADE_CANONICAL_REQUIREMENTS.jsonl"),
  jsonl(
    [...canonicalBySubject.entries()].map(([subject, members], i) => ({
      canonicalId: `REQ-${String(i + 1).padStart(4, "0")}`,
      normalisedSubject: subject,
      occurrences: members.length,
      lifecycleStages: [...new Set(members.map((m) => m.lifecycleStage).filter(Boolean))],
      headingPath: members[0].headingPath,
      sourceLineRanges: members.map((m) => [m.startLine, m.endLine]),
      representativeHeading: members[0].heading,
      distinctBodyHashes: [...new Set(members.map((m) => m.bodySha256))].length,
    })),
  ),
);
writeFileSync(join(OUT, "OCADE_DUPLICATE_GROUPS.jsonl"), jsonl(duplicateGroups));

const coverage = {
  totalLines,
  coveredLines: covered,
  firstLineCovered: firstCovered,
  lastLineCovered: lastCovered,
  gapsOrOverlaps: problems.length,
  problems,
  verdict: problems.length === 0 ? "COMPLETE LINE COVERAGE PROVEN" : "COVERAGE INCOMPLETE",
};
writeFileSync(join(OUT, "OCADE_COVERAGE_PROOF.json"), JSON.stringify(coverage, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      totalLines,
      coveredLines: covered,
      verdict: coverage.verdict,
      chunks: chunks.length,
      headings: headings.length,
      requirementBlocks: requirements.length,
      canonicalSubjects: canonicalBySubject.size,
      exactDuplicateGroups: duplicateGroups.filter((d) => d.kind === "exact-body").length,
      structuralDuplicateGroups: duplicateGroups.filter((d) => d.kind !== "exact-body").length,
    },
    null,
    2,
  ),
);

if (problems.length > 0) process.exit(1);
