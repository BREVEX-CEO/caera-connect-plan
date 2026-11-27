/** OFFLINE-02, OFFLINE-06: Offline Mode is Chat only and never reaches a provider; JARVIS has no offline engine. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const files = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !name.includes(".test.") ? [path] : [];
  });
const imports = (path: string) =>
  [...readFileSync(path, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map(
    (m) => m[1]!,
  );

test("the offline engine and its setup never import a provider client or JARVIS", () => {
  const offline = [...files("src/lib/brain"), ...files("src/components/offline")];
  assert.ok(offline.length > 10);
  const found: string[] = [];
  for (const path of offline) {
    for (const target of imports(path)) {
      if (
        /intelligence\/(online|ocade|gateway|router|edge)|ocade-intelligence|\bjarvis\b/i.test(
          target,
        )
      ) {
        found.push(`${path} -> ${target}`);
      }
    }
  }
  assert.deepEqual(found, []);
});

test("JARVIS has no offline engine to fall back on", () => {
  const found: string[] = [];
  for (const path of [...files("src/lib/jarvis"), ...files("src/jarvis")]) {
    for (const target of imports(path))
      if (/lib\/brain|\/brain\//.test(target)) found.push(`${path} -> ${target}`);
  }
  assert.deepEqual(found, []);
});

test("no offline engine file names the online function endpoint", () => {
  for (const path of files("src/lib/brain")) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /functions\/v1\/ocade-intelligence/, path);
  }
});
