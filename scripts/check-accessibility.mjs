/**
 * Accessibility gate (P19.S04).
 *
 * `check-dead-controls.mjs` finds a control nothing happens when you press.
 * This finds a control you cannot press, or cannot tell apart, if you use a
 * keyboard or a screen reader. Both are "the control does not work" — they just
 * fail for different people.
 *
 * Only statically decidable properties are checked. Contrast and focus-visible
 * genuinely need a rendered page with computed styles, so they are NOT asserted
 * here rather than approximated badly — an approximate contrast check that
 * passes is worse than none, because it retires the question.
 *
 * The four rules, each a real defect class:
 *
 *   icon-only-no-name    A control whose only content is an aria-hidden icon
 *                        has NO accessible name. A screen reader announces
 *                        "button" and nothing else.
 *   focusable-aria-hidden  aria-hidden on something focusable puts it in the
 *                        tab order while hiding it from assistive technology —
 *                        the user tabs to something that is not announced.
 *   positive-tabindex    Any tabIndex > 0 overrides natural document order for
 *                        the WHOLE page, not just that element.
 *   unlabelled-input     An input with no accessible name is a box the user
 *                        cannot identify.
 *
 * Usage: node scripts/check-accessibility.mjs [--json]
 * Exit:  0 when nothing is found; 1 otherwise.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";

const root = process.cwd();
const ROOTS = (process.env.OCADE_A11Y_SCAN_ROOTS ?? "src/components,src/routes")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const jsonOnly = process.argv.includes("--json");

const resolveFromRoot = (path) => (isAbsolute(path) ? path : join(root, path));

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(resolveFromRoot(dir));
  } catch {
    return acc;
  }
  for (const name of entries) {
    const path = join(resolveFromRoot(dir), name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.tsx$/.test(name)) acc.push(path);
  }
  return acc;
}

const lineAt = (src, index) => src.slice(0, index).split("\n").length;

/**
 * Attributes of the JSX tag starting at `start`.
 *
 * Cannot be `[^>]*`: JSX attributes routinely contain arrow functions, and the
 * `>` in `=>` truncates the capture — which silently hid every attribute after
 * the first handler, including the aria-label that made the control fine.
 * Scans forward instead, ignoring a `>` that is part of `=>`.
 */
function attributesOf(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === ">" && depth === 0 && src[i - 1] !== "=") {
      return src.slice(start, i);
    }
  }
  return src.slice(start, start + 400);
}

/**
 * Is this element inside a <label> that has not been closed?
 *
 * Walks back counting label opens and closes. An input wrapped in a label is
 * named by the label's text content, with no aria-label needed.
 */
function wrappedInLabel(src, index) {
  const before = src.slice(0, index);
  let open = 0;
  const re = /<(\/?)label\b/g;
  let m;
  while ((m = re.exec(before))) open += m[1] === "/" ? -1 : 1;
  return open > 0;
}

const findings = [];
const files = ROOTS.flatMap((d) => walk(d)).filter(
  // Pass-through primitives forward every prop to the underlying element, so
  // the CALLER supplies aria-label. Flagging the wrapper would demand a label
  // it cannot possibly know, and would be satisfied by a meaningless constant.
  (f) => !/[\\/]src[\\/]components[\\/]ui[\\/]/.test(f),
);

/**
 * Blank out comments before scanning, keeping every byte offset.
 *
 * The scanner matches raw source, so a comment that MENTIONS an element was
 * being read as that element. Documenting a checkbox with the words
 * `<input type="checkbox">` reported an unlabelled input on a file whose
 * checkboxes were correctly wrapped in labels.
 *
 * That is worth fixing rather than working around: a gate that fires on prose
 * teaches people to stop reading it, and the next finding it raises is the
 * real one they will skip.
 *
 * WHY A SCANNER AND NOT A REGEX. The first attempt was
 * `/\/\*[\s\S]*?\*\//` and it was worse than the bug it fixed:
 * `accept="image/*"` contains `/*`, so it opened a "comment" that swallowed
 * the next several hundred characters — including a correctly labelled file
 * input, which the gate then reported as unlabelled. Comment starts have to
 * be recognised outside string and template literals, which needs state.
 *
 * Comment bodies become spaces rather than being deleted, and newlines are
 * preserved, so `lineAt` still reports the right line.
 */
function blankComments(text) {
  let out = "";
  let i = 0;
  let quote = null; // ' " ` when inside a string
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];

    if (quote) {
      out += c;
      if (c === "\\") {
        // Escaped character: copy both so a \" cannot close the string.
        out += text[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }

    if (c === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      const stop = close === -1 ? text.length : close + 2;
      for (let k = i; k < stop; k += 1) out += text[k] === "\n" ? "\n" : " ";
      i = stop;
      continue;
    }

    if (c === "/" && next === "/") {
      const nl = text.indexOf("\n", i);
      const stop = nl === -1 ? text.length : nl;
      for (let k = i; k < stop; k += 1) out += " ";
      i = stop;
      continue;
    }

    out += c;
    i += 1;
  }
  return out;
}

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const src = blankComments(raw);
  const reportFile = relative(root, file).replaceAll("\\", "/");

  // --- positive tabIndex -------------------------------------------------
  for (const m of src.matchAll(/tabIndex=\{?\s*(\d+)\s*\}?/g)) {
    if (Number(m[1]) > 0) {
      findings.push({
        file: reportFile,
        line: lineAt(src, m.index),
        kind: "positive-tabindex",
        detail: m[0],
      });
    }
  }

  // --- aria-hidden on something focusable --------------------------------
  for (const m of src.matchAll(/<(button|Button|a|select|input|textarea)\b/g)) {
    const attrs = attributesOf(src, m.index);
    if (/aria-hidden=\{?["']?true/.test(attrs)) {
      findings.push({
        file: reportFile,
        line: lineAt(src, m.index),
        kind: "focusable-aria-hidden",
        detail: m[0].slice(0, 70),
      });
    }
  }

  // --- inputs without an accessible name ---------------------------------
  for (const m of src.matchAll(/<(input|select|textarea)\b/g)) {
    const attrs = attributesOf(src, m.index);
    const staticId = /\bid=["']([^"']+)["']/.exec(attrs)?.[1];
    const escapedId = staticId?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasMatchingLabel =
      escapedId !== undefined && new RegExp(`<label\\b[^>]*htmlFor=["']${escapedId}["']`).test(src);
    const hidden =
      /type=\{?["']hidden/.test(attrs) ||
      /\bhidden(?:\s|$|=)/.test(attrs) ||
      /aria-hidden=\{?["']?true/.test(attrs) ||
      /className=["'][^"']*\bhidden\b/.test(attrs);
    const named =
      /aria-label=/.test(attrs) ||
      /aria-labelledby=/.test(attrs) ||
      hasMatchingLabel ||
      hidden ||
      /type=\{?["'](hidden|submit|button)/.test(attrs) ||
      // An input WRAPPED in a <label> takes its name from the label's text.
      // This is valid HTML and the dominant pattern in this codebase; flagging
      // it would push people to add a redundant aria-label, which makes screen
      // readers announce the control twice.
      wrappedInLabel(src, m.index);
    if (!named) {
      findings.push({
        file: reportFile,
        line: lineAt(src, m.index),
        kind: "unlabelled-input",
        detail: attrs.replace(/\s+/g, " ").slice(0, 70),
      });
    }
  }

  // --- pointer-only custom controls --------------------------------------
  // Native buttons and links already have keyboard semantics. A div/span/li
  // with onClick must explicitly become an operable control: role, tab stop,
  // and an Enter/Space keyboard handler.
  for (const m of src.matchAll(/<(div|span|li)\b/g)) {
    const attrs = attributesOf(src, m.index);
    if (!/\bonClick=/.test(attrs)) continue;
    const role = /\brole=["'](button|link|menuitem|tab)["']/.test(attrs);
    const focusable = /\btabIndex=\{?\s*0\s*\}?/.test(attrs);
    const keyboard = /\bonKey(?:Down|Up|Press)=/.test(attrs);
    if (!role) {
      findings.push({
        file: reportFile,
        line: lineAt(src, m.index),
        kind: "pointer-only-control",
        detail: attrs.replace(/\s+/g, " ").slice(0, 70),
      });
    } else {
      if (!focusable) {
        findings.push({
          file: reportFile,
          line: lineAt(src, m.index),
          kind: "custom-control-not-focusable",
          detail: attrs.replace(/\s+/g, " ").slice(0, 70),
        });
      }
      if (!keyboard) {
        findings.push({
          file: reportFile,
          line: lineAt(src, m.index),
          kind: "custom-control-no-keyboard",
          detail: attrs.replace(/\s+/g, " ").slice(0, 70),
        });
      }
    }
  }

  // --- icon-only controls with no accessible name ------------------------
  // Matches a control whose entire body is a single self-closing component
  // marked aria-hidden — the classic icon button.
  const ICON_ONLY =
    /<(button|Button)\b([^>]*)>\s*<[A-Z][A-Za-z0-9]*\b[^>]*aria-hidden[^>]*\/>\s*<\/(?:button|Button)>/g;
  for (const m of src.matchAll(ICON_ONLY)) {
    const attrs = m[2] ?? "";
    const named = /aria-label=|aria-labelledby=|title=/.test(attrs);
    if (!named) {
      findings.push({
        file: reportFile,
        line: lineAt(src, m.index),
        kind: "icon-only-no-name",
        detail: m[0].replace(/\s+/g, " ").slice(0, 80),
      });
    }
  }
}

const byKind = findings.reduce((acc, f) => {
  acc[f.kind] = (acc[f.kind] ?? 0) + 1;
  return acc;
}, {});

const report = {
  generatedAt: new Date().toISOString(),
  scanned: files.length,
  notChecked: [
    "colour contrast — needs computed styles from a rendered page",
    "focus-visible appearance — needs a real focus event and computed styles",
    "screen-reader announcement order — needs an actual assistive technology",
  ],
  findings,
  byKind,
};

/**
 * Zero baseline, not amnesty.
 *
 * P19 repaired every finding discovered when the gate was introduced. The
 * tracked baseline is therefore zero; keeping the comparison machinery makes
 * the failure mode explicit and allows a temporary zero baseline to be used by
 * the enforcement tests without mutating the repository.
 */
const BASELINE_PATH = process.env.OCADE_A11Y_BASELINE ?? "release/OCADE_A11Y_BASELINE.json";
let baseline = { total: 0, byKind: {} };
try {
  // An override is an ABSOLUTE temp path in the enforcement tests. Joining it
  // to cwd yields a path that exists nowhere, so the gate would fall back to an
  // empty baseline and report a regression for the wrong reason — the same bug
  // the test-kind gate had, which is why it is worth fixing the same way twice.
  baseline = JSON.parse(
    readFileSync(isAbsolute(BASELINE_PATH) ? BASELINE_PATH : join(root, BASELINE_PATH), "utf8"),
  );
} catch {
  /* no baseline yet — treated as zero, so a first run reports everything */
}

const regressions = [];
if (findings.length > (baseline.total ?? 0)) {
  regressions.push(`accessibility findings rose from ${baseline.total ?? 0} to ${findings.length}`);
}
for (const [kind, n] of Object.entries(byKind)) {
  const was = baseline.byKind?.[kind] ?? 0;
  if (n > was) regressions.push(`${kind}: ${was} -> ${n}`);
}

if (jsonOnly) {
  console.log(JSON.stringify({ ...report, baseline, regressions }, null, 2));
} else {
  console.log(`Accessibility audit: scanned ${files.length} component and route files`);
  console.log(
    `  ${findings.length} finding(s) against a baseline of ${baseline.total ?? 0}: ${
      Object.entries(byKind)
        .map(([k, n]) => `${n} ${k}`)
        .join(", ") || "none"
    }`,
  );
  if (regressions.length > 0) {
    console.log(`\nREGRESSION — new accessibility defects were introduced:`);
    for (const r of regressions) console.log(`  ${r}`);
    for (const f of findings.slice(0, 15)) {
      console.log(`    ${f.file}:${f.line}  ${f.kind}`);
    }
  } else if (findings.length > 0) {
    console.log("  No new defects. Existing ones are recorded in the baseline and still owed.");
  } else {
    console.log("  No statically decidable keyboard or screen-reader defects found.");
  }
  console.log(`\nNot checked here (needs a rendered page): ${report.notChecked.join("; ")}`);
}

process.exit(regressions.length === 0 ? 0 : 1);
