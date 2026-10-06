/**
 * No-Dead-Button audit.
 *
 * The specification requires that every visible control performs a real action,
 * navigates somewhere valid, opens a setup/repair flow, or honestly explains why
 * it is unavailable. The feature registry encodes that policy, but nothing has
 * ever checked the actual JSX against it.
 *
 * This scans every component and route for controls that cannot do anything:
 *
 *   dead-handler      onClick={() => {}}  — an empty arrow body
 *   no-handler        <Button> with no onClick, no type=submit, no asChild,
 *                     and no link wrapper
 *   placeholder-link  href="#" or href="" — goes nowhere
 *   silent-disabled   disabled with no title/aria-label/tooltip explaining why
 *
 * Usage: node scripts/check-dead-controls.mjs [--json]
 * Exit:  0 when no dead control is found; 1 otherwise.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/components", "src/routes", "src/jarvis"];
const jsonOnly = process.argv.includes("--json");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/**
 * Blank out comments and template literals WITHOUT removing newlines, so
 * reported line numbers still match the real file. An earlier version collapsed
 * block comments to a single space and every reported line was wrong.
 */
function stripNoise(source) {
  const keepLines = (text) => text.replace(/[^\n]/g, " ");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, keepLines)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + keepLines(m.slice(p1.length)))
    .replace(/`(?:[^`\\]|\\.)*`/g, keepLines);
}

/**
 * The exact opening tag at `start`. Braces are counted so a `>` inside a JSX
 * expression (`x > 2`, an arrow) does not end the tag early, and nothing past
 * the tag is read: a fixed-width window once let a sibling's onClick mask an
 * inert button beside it.
 */
function openingTag(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === ">" && depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

const findings = [];
const files = ROOTS.flatMap((root) => walk(root));

for (const file of files) {
  const source = stripNoise(readFileSync(file, "utf8"));
  const lineAt = (index) => source.slice(0, index).split("\n").length;

  // 1. Empty handler bodies: onClick={() => {}} / onSubmit={() => {}} etc.
  for (const m of source.matchAll(/on[A-Z]\w+=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/g)) {
    findings.push({ file, line: lineAt(m.index), kind: "dead-handler", detail: m[0].slice(0, 60) });
  }

  // 2. Links that go nowhere.
  for (const m of source.matchAll(/href=\{?["'](#|)["']\}?/g)) {
    findings.push({
      file,
      line: lineAt(m.index),
      kind: "placeholder-link",
      detail: m[0].slice(0, 40),
    });
  }

  // 3. <Button> elements with nothing that could make them act.
  for (const m of source.matchAll(/<Button\b/g)) {
    const attrs = openingTag(source, m.index) ?? "";
    const inert =
      !/\bonClick\b/.test(attrs) &&
      !/\basChild\b/.test(attrs) &&
      !/\btype=\{?["']?submit/.test(attrs) &&
      !/\bonSubmit\b/.test(attrs) &&
      !/\{\.\.\./.test(attrs) && // spread props may carry a handler
      // A DISABLED button is not expected to act. Whether it explains itself is
      // the `silent-disabled` rule's business; demanding a handler as well
      // would flag every honest "unavailable" control.
      !/\bdisabled\b/.test(attrs);
    if (inert) {
      // A Button is NOT dead when its parent supplies the behaviour:
      //  - <Link>/<a> wrapper            -> navigational
      //  - <XTrigger asChild>            -> the trigger clones its own onClick
      //    onto the child (AlertDialogTrigger, DialogTrigger, PopoverTrigger,
      //    TooltipTrigger, DropdownMenuTrigger, SheetTrigger...). Checking only
      //    the Button's own attributes reported every dialog trigger in the
      //    codebase as dead.
      const before = source.slice(Math.max(0, m.index - 200), m.index);
      // NOTE: no leading \b before "Trigger" — "AlertDialogTrigger" is a single
      // word, so \bTrigger never matches inside it and every dialog trigger was
      // reported as dead.
      const navigational =
        /<Link\b[^>]*>\s*$|<a\b[^>]*>\s*$/.test(before) ||
        /[A-Za-z]*Trigger\b[^>]*asChild[^>]*>\s*$/.test(before);
      if (!navigational) {
        findings.push({
          file,
          line: lineAt(m.index),
          kind: "no-handler",
          detail: attrs.slice(0, 57),
        });
      }
    }
  }

  /*
   * 3b. Submit handlers that let the browser submit the form anyway.
   *
   * `preventDefault` after an `await` is too late. The handler has already
   * returned, the browser treats the submit as unhandled, and it navigates to
   * the form's action — a full page load that discards the route's search
   * parameters along with everything the screen was holding.
   *
   * `/auth/verify` did exactly this: entering a code, right or wrong, reloaded
   * the page without the `channel` and `identifier` it needs, so the screen
   * replaced itself with "Something stopped working" and the code could never
   * be entered at all. `reset-password` had the same ordering.
   *
   * A control that undoes itself is a dead control, so it is reported here.
   */
  for (const m of source.matchAll(/function\s+\w+\s*\(\s*(\w+)\s*:\s*React\.FormEvent/g)) {
    const body = source.slice(m.index, m.index + 1200);
    const prevented = body.indexOf(`${m[1]}.preventDefault()`);
    const awaited = body.search(/\bawait\b/);
    if (prevented >= 0 && awaited >= 0 && awaited < prevented) {
      findings.push({
        file,
        line: lineAt(m.index + awaited),
        kind: "late-preventdefault",
        detail: "await runs before preventDefault(); the browser submits the form",
      });
    }
  }

  // 4. PERMANENTLY disabled controls that never say why.
  //
  // Only a CONSTANT `disabled` counts. A reactive one (`disabled={busy}`,
  // `disabled={!draft.trim()}`) is a transient state whose cause is visible in
  // context — flagging those produced 94 false positives and drowned the four
  // findings that mattered. A control hard-wired to `disabled` is the real
  // dead-button case, and it must explain itself.
  for (const m of source.matchAll(/<(Button|button)\b([^>]*)>/g)) {
    const attrs = m[2];
    const permanentlyDisabled =
      /\bdisabled(\s|>|$)/.test(attrs) || /\bdisabled=\{true\}/.test(attrs);
    if (!permanentlyDisabled) continue;
    const explains = /\btitle=|\baria-label=|\baria-describedby=|\bdata-reason=/.test(attrs);
    if (!explains) {
      findings.push({
        file,
        line: lineAt(m.index),
        kind: "silent-disabled",
        detail: `<${m[1]}${attrs.slice(0, 50)}>`,
      });
    }
  }

  /*
   * 5. RAW <button> ELEMENTS, which nothing above ever looked at.
   *
   * Rules 1–4 match `<Button` (the shadcn component) or a disabled control.
   * A plain lowercase `<button>` with no handler at all passed every one of
   * them, and that is not hypothetical: the landing page rendered its eight
   * capability cards as raw `<button>` elements wired only to `onMouseEnter`
   * and `onFocus`. This audit reported "No dead controls found" while the main
   * interactive explanation of the product did nothing when clicked.
   *
   * HOVER-ONLY IS THE WORSE HALF. A control that responds to hover but not to
   * click is not merely unpolished — it is unreachable on a phone. There is no
   * hover on touch, and iOS Safari does not focus a `<button>` on tap, so the
   * `onFocus` fallback does not save it either. Most people meet a landing page
   * on a phone, so "works with a mouse" is the smaller half of the audience.
   */
  for (const m of source.matchAll(/<button\b/g)) {
    const attrs = openingTag(source, m.index) ?? "";
    const acts =
      /\bonClick\b/.test(attrs) ||
      /\bonSubmit\b/.test(attrs) ||
      /\bonPointerDown\b/.test(attrs) ||
      /\bonKeyDown\b/.test(attrs) ||
      /\btype=\{?["']?submit/.test(attrs) ||
      /\{\.\.\./.test(attrs); // a spread may carry the handler

    // Same parent-supplies-behaviour exemptions as rule 3.
    const before = source.slice(Math.max(0, m.index - 200), m.index);
    const navigational =
      /<Link\b[^>]*>\s*$|<a\b[^>]*>\s*$/.test(before) ||
      /[A-Za-z]*Trigger\b[^>]*asChild[^>]*>\s*$/.test(before);
    if (acts || navigational) continue;

    const hoverOnly = /\bonMouseEnter\b|\bonMouseOver\b|\bonFocus\b|\bonPointerEnter\b/.test(attrs);
    const disabled = /\bdisabled\b/.test(attrs);
    if (disabled) continue; // rule 4 owns disabled controls

    findings.push({
      file,
      line: lineAt(m.index),
      kind: hoverOnly ? "hover-only" : "no-handler",
      detail: attrs.slice(0, 57),
    });
  }

  /*
   * 5b. A WAIT WITH NO WAY OUT OF IT.
   *
   * `PLAN.md` Phase 2: every asynchronous surface ends in success, empty, or an
   * error with Retry. Four screens did not. Billing sat on "Reading your
   * allowance…", Advanced rendered nothing at all once its read failed, the
   * second-factor challenge span while holding an error it never displayed, and
   * the reset-password page waited forever if its first `await` threw. A
   * permanent "Loading…" is not a slow screen — it is a screen that has already
   * failed and is not saying so.
   *
   * So a file that shows somebody a WAITING message must also contain an ending
   * for it: an alert region, the shared `Pending` state, or a stated
   * `bounded-state:` reason on the line for the rare screen that genuinely
   * cannot fail.
   */
  const waiting = [
    ...source.matchAll(/(Loading|Reading|Opening|Checking|Preparing|Signing)\b[^<>{}\n]*…/g),
  ].filter((m) => /role="status"/.test(source.slice(Math.max(0, m.index - 400), m.index)));
  if (waiting.length > 0) {
    const ends =
      /role="alert"/.test(source) ||
      /<Pending\b/.test(source) ||
      /\bfailed\b/.test(source) ||
      /bounded-state:/.test(source);
    if (!ends) {
      findings.push({
        file,
        line: lineAt(waiting[0].index),
        kind: "unbounded-wait",
        detail: waiting[0][0].trim().slice(0, 60),
      });
    }
  }

  /*
   * 6. SELECTION STATE CARRIED BY COLOUR ALONE.
   *
   * A button whose className switches on `x === selected` is a selection
   * control, and half of what it does is REPORT which option is chosen. When
   * that report exists only as a background colour, a screen reader announces
   * eight identically-named buttons with no way to tell which one is active,
   * and so does a high-contrast or forced-colours mode that discards the
   * palette. WCAG 1.4.1 and 4.1.2, and the reason the audit found "Operational"
   * pressing to no effect: it was the already-selected tab, and nothing in the
   * accessibility tree said so.
   *
   * `aria-pressed`, `aria-selected`, `aria-checked`, `aria-current` and an
   * explicit tab/radio/option role all answer it; any one is enough.
   */
  for (const m of source.matchAll(/<button\b/g)) {
    const tag = openingTag(source, m.index);
    if (tag === null) continue;

    const isSelection =
      /className=\{[^]*?(===|!==|\bisActive\b|\bisSelected\b|\bselected\b|\bactive\b)/.test(tag);
    if (!isSelection) continue;

    const announcesState =
      /\baria-(pressed|selected|checked|current|expanded)=/.test(tag) ||
      /\brole="(tab|radio|option|switch)"/.test(tag) ||
      /\bdisabled\b/.test(tag);
    if (announcesState) continue;

    findings.push({
      file,
      line: lineAt(m.index),
      kind: "visual-only-state",
      detail: tag.replace(/\s+/g, " ").slice(0, 60),
    });
  }
}

const byKind = findings.reduce((acc, f) => {
  acc[f.kind] = (acc[f.kind] ?? 0) + 1;
  return acc;
}, {});

if (jsonOnly) {
  console.log(JSON.stringify({ scanned: files.length, byKind, findings }, null, 2));
} else {
  console.log(`No-Dead-Button audit: scanned ${files.length} component and route files`);
  if (findings.length === 0) {
    console.log("No dead controls found.");
  } else {
    for (const f of findings) {
      console.log(`  ${f.kind.padEnd(17)} ${f.file}:${f.line}  ${f.detail}`);
    }
    console.log(
      `\n${findings.length} dead control(s): ${Object.entries(byKind)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  }
}

process.exit(findings.length === 0 ? 0 : 1);
