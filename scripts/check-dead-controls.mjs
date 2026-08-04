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

const ROOTS = ["src/components", "src/routes"];
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
  //
  // `[^>]*` alone is not enough: a JSX expression attribute can itself contain
  // a ">" (a comparison, an arrow), which truncates the captured attribute list
  // early. src/components/ui/calendar.tsx was reported as handler-less because
  // its `{...props}` sits after such an attribute. Scan a window past the match
  // as well, so a spread or handler further down the tag is still seen.
  for (const m of source.matchAll(/<Button\b([^>]*)>/g)) {
    // 2500 chars: shadcn's calendar day button carries a long run of data-*
    // attributes before its `{...props}`, and a short window missed it.
    const attrs = m[1] + source.slice(m.index, m.index + 2500);
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
          detail: `<Button${attrs.slice(0, 50)}>`,
        });
      }
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
