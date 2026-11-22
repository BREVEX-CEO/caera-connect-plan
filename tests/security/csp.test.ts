/**
 * Inline scripts (168): only the router's per-request nonce and the two fixed scripts, by exact
 * content hash, may run. Changing a fixed script without its hash fails here, not in a browser.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { build } from "esbuild";
import { THEME_BOOT, THEME_BOOT_SHA256 } from "../../src/lib/theme-boot.ts";

const sha256 = (text: string) => createHash("sha256").update(text).digest("base64");
const policy = readFileSync("src/lib/security/public-response.ts", "utf8");

test("each fixed inline script is allowed by its exact hash", () => {
  assert.equal(sha256(THEME_BOOT), THEME_BOOT_SHA256);
  const offline = readFileSync("public/offline.html", "utf8");
  const scripts = [...offline.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1, "offline.html has exactly one inline script");
  const declared = policy.match(/OFFLINE_RECONNECT_SHA256 = "([^"]+)"/)?.[1];
  assert.equal(sha256(scripts[0]), declared);
});

test("script-src never allows arbitrary inline script", () => {
  const scriptSrc = policy.slice(policy.indexOf('"script-src'), policy.indexOf('"style-src'));
  assert.ok(scriptSrc.length > 0);
  assert.doesNotMatch(scriptSrc, /unsafe-inline/);
  assert.match(scriptSrc, /'nonce-\$\{nonce\}'/);
});

test("server functions cannot cache private responses even if a handler sets a public TTL", async () => {
  const bundle = await build({
    entryPoints: ["src/lib/security/public-response.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    define: { "import.meta.env": "{}" },
  });
  const moduleUrl =
    "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0]!.text).toString("base64");
  const { withPublicSecurityHeaders } = await import(moduleUrl);
  const response = () =>
    new Response("synthetic", { headers: { "cache-control": "public, max-age=3600" } });
  assert.equal(
    withPublicSecurityHeaders(response(), "/_serverFn/list").headers.get("cache-control"),
    "private, no-store",
  );
  assert.equal(
    withPublicSecurityHeaders(response(), "/offline.html").headers.get("cache-control"),
    "public, max-age=3600",
  );
});
