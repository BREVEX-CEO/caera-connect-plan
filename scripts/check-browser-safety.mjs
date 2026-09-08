/**
 * Node globals in code that runs in a browser.
 *
 * THE DEFECT THIS EXISTS FOR. `src/lib/skills/benchmark/tasks.ts` built a PNG
 * fixture with `Buffer.from(..., "base64")` at module scope. `Buffer` is a Node
 * global and does not exist in a browser, so importing that module threw
 * `ReferenceError: Buffer is not defined` before the first line of the page
 * could render — and took `/settings/skills` down to the generic "This page
 * didn't load" boundary.
 *
 * Every one of the 5,184 tests passed throughout, and they always would have:
 * vitest runs under Node, where `Buffer` is defined. Adding jsdom does not help
 * either — jsdom supplies a DOM, not a Node-free global scope, so the same
 * module imports cleanly in a jsdom test too. That was confirmed by injecting
 * the identical bug into a route and watching the browser-interaction audit
 * pass 46/46.
 *
 * A runtime test cannot see this class of defect, so a static check has to.
 *
 * WHAT IS EXEMPT, and why each is safe:
 *   - `*.node.ts` / `*.server.ts` — server-only by filename convention.
 *   - `scripts/`, tests, config — never shipped to a browser.
 *   - `process.env` — replaced at build time by Vite, so it is not a runtime
 *     global reference at all.
 *   - a reference guarded by `typeof X !== "undefined"` in the same file, which
 *     is the correct way to use one of these when a fallback exists.
 *
 * Usage: node scripts/check-browser-safety.mjs [--json] [--root=<source-directory>]
 * Exit:  0 when clean; 1 otherwise.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import ts from "typescript";

const requestedRoots = process.argv
  .filter((arg) => arg.startsWith("--root="))
  .map((arg) => arg.slice("--root=".length))
  .filter(Boolean);
const ROOTS = requestedRoots.length > 0 ? requestedRoots : ["src"];
const jsonOnly = process.argv.includes("--json");

/** Server-only by convention, or never shipped. */
function isExempt(path) {
  const p = path.replace(/\\/g, "/");
  return (
    // Both spellings are in use: `detect.node.ts` and `generated-sandbox-node.ts`.
    /[.-](node|server)\.[cm]?tsx?$/.test(p) ||
    // TanStack Start extracts createServerFn handlers from these modules into
    // the server graph. The suffix is an existing repository boundary, not a
    // generic exemption: feature modules may call the exported functions but
    // may not import their Node dependencies directly.
    /\.functions\.[cm]?tsx?$/.test(p) ||
    // Framework-owned server entries that predate the suffix convention.
    /\/routes\/api\//.test(p) ||
    /\/integrations\/supabase\/auth-middleware\.ts$/.test(p) ||
    /\/lib\/commercial\/entitlement-resolver\.ts$/.test(p) ||
    /\/__tests__\//.test(p) ||
    /\.test\.[cm]?tsx?$/.test(p) ||
    /\/routeTree\.gen\./.test(p)
  );
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.[cm]?tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Blank comments and strings without moving line numbers. */
function stripNoise(source) {
  const keep = (t) => t.replace(/[^\n]/g, " ");
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, keep)
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + keep(m.slice(p1.length)))
      .replace(/`(?:[^`\\]|\\.)*`/g, keep)
      .replace(/"(?:[^"\\\n]|\\.)*"/g, keep)
      .replace(/'(?:[^'\\\n]|\\.)*'/g, keep)
      /*
       * JSX TEXT IS PROSE, NOT CODE.
       *
       * This audit reported `src/routes/company.tsx:94` as a Node `process`
       * reference. Line 94 reads "...for the current investor-enquiry process."
       * — an English sentence between two tags. The word is not the global and
       * never was.
       *
       * A safety check that fires on prose is one people learn to scroll past,
       * which is exactly how a real finding gets missed. Text between `>` and
       * `<` with no braces in it cannot be an expression, so it is blanked along
       * with the comments and the string literals.
       */
      .replace(/>[^<>{}]+</g, (t) => `>${keep(t.slice(1, -1))}<`)
      /*
       * AND TEXT THAT FOLLOWS AN EXPRESSION, WHICH THE RULE ABOVE MISSES.
       *
       * The same sentence came back, from the same file, one line further down:
       *
       *     for the current investor-enquiry process.
       *     </p>
       *
       * It sits between a `{" "}` spacer and the closing tag, so it begins
       * after a `}` rather than after a `>` and the first rule never saw it.
       * Prose does not stop being prose because a JSX space precedes it.
       */
      .replace(/\}[^<>{}]+</g, (t) => `}${keep(t.slice(1, -1))}<`)
  );
}

const GLOBALS = [
  { name: "Buffer", pattern: /\bBuffer\s*\./g },
  { name: "process", pattern: /\bprocess\s*\.(?!env\b)/g },
  { name: "__dirname", pattern: /\b__dirname\b/g },
  { name: "__filename", pattern: /\b__filename\b/g },
  { name: "setImmediate", pattern: /\bsetImmediate\s*\(/g },
  { name: "require", pattern: /(^|[^.\w])require\s*\(/g },
];

const findings = [];
const files = ROOTS.flatMap((root) => walk(root)).filter((f) => !isExempt(f));
const builtins = new Set(
  builtinModules.flatMap((name) => [
    name,
    name.replace(/^node:/, ""),
    `node:${name.replace(/^node:/, "")}`,
  ]),
);

function nodeBuiltinImports(raw, file) {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, raw, ts.ScriptTarget.Latest, true, kind);
  const imports = [];
  const inspectSpecifier = (value, node, typeOnly = false) => {
    const nodeBuiltin = builtins.has(value);
    const serverBoundary =
      !typeOnly &&
      (/(?:^|\/)server(?:\/|$)/.test(value) ||
        /(?:^|\/)[^/]+\.(?:node|server)(?:\.[cm]?[jt]sx?)?$/.test(value));
    if (!nodeBuiltin && !serverBoundary) return;
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    imports.push({
      file: file.replace(/\\/g, "/"),
      line: position.line + 1,
      global: nodeBuiltin ? `Node import ${value}` : `Server-only import ${value}`,
    });
  };
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      inspectSpecifier(
        node.moduleSpecifier.text,
        node.moduleSpecifier,
        (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly === true) ||
          (ts.isExportDeclaration(node) && node.isTypeOnly),
      );
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      inspectSpecifier(node.arguments[0].text, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return imports;
}

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const source = stripNoise(raw);

  findings.push(...nodeBuiltinImports(raw, file));

  for (const { name, pattern } of GLOBALS) {
    pattern.lastIndex = 0;
    for (const m of source.matchAll(pattern)) {
      /*
       * A `typeof X !== "undefined"` anywhere in the file counts as a guard.
       * Deliberately generous: the point is to catch the UNGUARDED case that
       * takes a page down, not to police how carefully a guard is scoped. A
       * file that has thought about the browser at all is not the bug.
       */
      const guardedByOwnTypeof = new RegExp(`typeof\\s+${name}\\s*[!=]==?\\s*["']`).test(raw);

      /*
       * The other legitimate shape is a browser-first fallback:
       *
       *   typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes)...
       *
       * The guard names the BROWSER API, not the Node one, so looking for
       * `typeof Buffer` never finds it. `src/lib/vision3d/gltf.ts` does exactly
       * this and is correct. Accepting a `typeof ... ?` on the same line keeps
       * that pattern usable instead of pushing people to suppress the check.
       */
      const line = source.slice(0, m.index).split("\n").length;
      const lineText = raw.split(/\r?\n/)[line - 1] ?? "";
      const guardedByFallback =
        /typeof\s+\w+\s*[!=]==?\s*["']/.test(lineText) && /\?/.test(lineText);

      if (guardedByOwnTypeof || guardedByFallback) continue;

      findings.push({
        file: file.replace(/\\/g, "/"),
        line: source.slice(0, m.index).split("\n").length,
        global: name,
      });
      break; // one finding per global per file is enough to act on
    }
  }
}

if (jsonOnly) {
  console.log(JSON.stringify({ scanned: files.length, findings }, null, 2));
} else {
  console.log(`Browser-safety audit: scanned ${files.length} browser-reachable source files`);
  if (findings.length === 0) {
    console.log("No Node-only globals reachable from the browser.");
  } else {
    for (const f of findings) {
      console.log(`  ${f.global.padEnd(12)} ${f.file}:${f.line}`);
    }
    console.log(
      `\n${findings.length} Node-only global reference(s) in browser code. ` +
        `These throw at import time in a browser and no test can see them.`,
    );
  }
}

process.exit(findings.length === 0 ? 0 : 1);
