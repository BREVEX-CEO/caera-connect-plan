/** TENANT-05: nothing a shared cache could keep for another person leaves the authenticated API routes. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const files = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
const routes = files("src/routes/api").filter((path) => path.endsWith(".ts"));

test("there are API routes to audit", () => {
  assert.ok(routes.length >= 2, routes.join());
});

test("every API route response is private, no-store or private with a long life for content-addressed bytes", () => {
  for (const path of routes) {
    const text = readFileSync(path, "utf8");
    // each place a response is built must be a reviewed one: it names its own cache policy or goes through a helper that does
    const bare = [...text.matchAll(/new Response\(([^)]*)\)|Response\.json\(([^)]*)\)/g)].filter(
      (match) => !/cache-control/i.test(match[0]),
    );
    const allowed = bare.filter(
      (match) =>
        /method_not_allowed/.test(match[0]) ||
        (/\bheaders\b/.test(match[0]) && /"cache-control": "private/.test(text)),
    );
    assert.equal(bare.length, allowed.length, `${path} builds a response without a cache policy`);
    assert.match(text, /no-store|private/, `${path} states no cache policy`);
  }
});
