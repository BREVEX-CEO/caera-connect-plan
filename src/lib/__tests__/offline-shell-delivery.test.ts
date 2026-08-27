import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("offline shell delivery", () => {
  it("serves the exact static offline page instead of framework canonicalization", () => {
    const server = readFileSync(resolve("src/server.ts"), "utf8");
    expect(server).toContain('import offlineShellHtml from "../public/offline.html?raw"');
    expect(server).toContain('url.pathname === "/offline.html"');
    expect(server).toContain('request.method === "HEAD" ? null : offlineShellHtml');
    expect(server.indexOf('url.pathname === "/offline.html"')).toBeLessThan(
      server.indexOf("const handler = await getServerEntry()"),
    );
  });

  it("keeps that path in the service worker's atomic required precache", () => {
    const worker = readFileSync(resolve("public/sw.js"), "utf8");
    expect(worker).toContain('const OFFLINE_URL = "/offline.html"');
    expect(worker).toContain(
      'const REQUIRED_PRECACHE = ["/", OFFLINE_URL, "/manifest.webmanifest"]',
    );
  });

  it("disables Cloudflare's automatic .html redirect for the offline asset", () => {
    const wrangler = JSON.parse(readFileSync(resolve("wrangler.json"), "utf8"));
    expect(wrangler.assets).toMatchObject({
      run_worker_first: true,
      html_handling: "none",
    });
  });
});
