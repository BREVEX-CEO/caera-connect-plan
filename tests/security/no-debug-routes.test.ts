/**
 * SEC-10: no public debug route, verbose stack trace or unprotected diagnostics. Every route file
 * is on a reviewed list (a new one fails this test until reviewed); none is named for debugging,
 * testing or internals; no page or API renders an error's stack; the only API routes are the
 * signed device door and the offline model bytes.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const root = new URL("../../src/routes/", import.meta.url).pathname;
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [relative(root, path)];
  });
}

test("every route is reviewed and none exposes debugging or diagnostics", () => {
  const routes = files(root).sort();
  assert.deepEqual(
    routes.filter((route) => route.startsWith("api/")),
    ["api/jarvis.device.ts", "api/offline/bytes.$release.ts"],
    "a new API route needs a security review before it is added here",
  );
  for (const route of routes) {
    assert.doesNotMatch(route, /debug|test|diagnos|internal|phpinfo|graphql|swagger/i, route);
    const text = readFileSync(join(root, route), "utf8");
    assert.doesNotMatch(
      text,
      /\berror\.stack\b|\.stack\s*\}|componentStack/,
      `${route} shows a stack`,
    );
  }
});
