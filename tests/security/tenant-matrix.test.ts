/**
 * O-10 / TENANT-01: the static half of the two-tenant route matrix. Every server function in the
 * website (every route a browser can call) must name an authenticating middleware before its
 * handler, and only staff functions may take another person's id as input; everything else
 * acts on the account the verified session names. Row-level security on every table is checked
 * separately (`tests/jarvis/db/injection-privilege.test.sql`).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const AUTHENTICATING = /^(requireSession|requireAssurance\(|requireSupabaseAuth)/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Each server function's chain, from `createServerFn(` up to its `.handler(`. */
function serverFunctions(): { file: string; chain: string }[] {
  return sources("src").flatMap((file) =>
    readFileSync(file, "utf8")
      .split("createServerFn(")
      .slice(1)
      .map((rest) => ({ file, chain: rest.slice(0, rest.indexOf(".handler(")) })),
  );
}

test("the matrix sees the website's server functions", () => {
  assert.ok(serverFunctions().length >= 100, "fewer server functions than expected: scan broken");
});

test("every server function authenticates before its handler runs", () => {
  for (const { file, chain } of serverFunctions()) {
    const middleware = /\.middleware\(\[\s*([^\]]*?)\s*\]\)/s.exec(chain)?.[1] ?? "";
    assert.match(middleware, AUTHENTICATING, `${file}: ${chain.slice(0, 120)}`);
  }
});

test("only staff functions take another person's id as input", () => {
  for (const { file, chain } of serverFunctions()) {
    const validator = chain.slice(chain.indexOf(".validator("));
    if (!chain.includes(".validator(")) continue;
    if (file.startsWith(join("src", "lib", "admin"))) continue;
    assert.doesNotMatch(
      validator,
      /\b(userId|user_id|ownerId|accountId)\s*:/,
      `${file}: ${chain.slice(0, 120)}`,
    );
  }
});
