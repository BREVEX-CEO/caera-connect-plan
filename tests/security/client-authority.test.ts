/** FRONTEND-07, FRONTEND-08, PRIVACY: no client-supplied plan, role or entitlement is trusted by a website server function. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const files = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.ts$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
const sources = files("src").filter(
  (path) => !path.includes("/admin/") && !path.endsWith("types.ts"),
);

const AUTHORITY_KEYS =
  /^\s+(plan|tier|entitlement|entitlements|isAdmin|is_admin|isStaff|staff|permissions?|quota|allowance|credits?)\s*:\s*z\./gm;

test("no website server function outside the staff console takes a plan, tier, quota or permission as input", () => {
  const found: string[] = [];
  for (const path of sources) {
    const text = readFileSync(path, "utf8");
    if (!text.includes("createServerFn")) continue;
    for (const match of text.matchAll(AUTHORITY_KEYS)) found.push(`${path}: ${match[1]}`);
  }
  assert.deepEqual(found, []);
});

test("the only `role` a customer function accepts is a message role, never an authority", () => {
  for (const path of sources) {
    const text = readFileSync(path, "utf8");
    if (!text.includes("createServerFn")) continue;
    for (const match of text.matchAll(/^\s+role\s*:\s*(z\.[^\n]*)/gm)) {
      assert.match(match[1]!, /z\.enum\(\["user", "assistant"\]\)/, `${path}: ${match[1]}`);
    }
  }
});

test("the staff console functions that take a role or tier require a staff permission", () => {
  for (const path of files("src/lib/admin")) {
    const text = readFileSync(path, "utf8");
    if (!/(role|tier)\s*:\s*z\.enum/.test(text)) continue;
    assert.match(
      text,
      /requireStaff|requireAdmin|staffPermission|requirePermission|requireAssurance/,
      path,
    );
  }
});
