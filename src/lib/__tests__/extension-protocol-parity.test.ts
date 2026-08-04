import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EXTENSION_PROTOCOL_VERSION } from "../native/extension-protocol";

/**
 * Browser-extension protocol parity and package safety.
 *
 * `extension/background.js` carries its own `validate()` whose comment says it
 * "Mirrors validateRequest() in extension-protocol.ts". Two implementations of
 * one protocol, in two languages, in two files, with nothing keeping them in
 * step. If they drift, the extension accepts a request kind the TypeScript side
 * never validates — or refuses one the app believes is supported — and the gap
 * is invisible at compile time in both directions.
 *
 * The extension is an MV3 service worker that needs the `chrome` API at import
 * time and does not export `validate`, so it cannot be imported and called
 * here. These tests read the two sources and assert they agree, plus the
 * package-level safety properties that make the extension a bounded attack
 * surface. That is the honest limit of what is checkable without loading it
 * into a real browser — which remains an external prerequisite.
 */

const background = readFileSync("extension/background.js", "utf8");
const protocolTs = readFileSync("src/lib/native/extension-protocol.ts", "utf8");
const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8")) as Record<
  string,
  unknown
>;

/** Kinds the extension will accept, from its runtime allowlist. */
const extensionKinds = (() => {
  const block = /const KINDS = new Set\(\[([\s\S]*?)\]\)/.exec(background);
  if (!block) throw new Error("Could not locate the KINDS allowlist in background.js");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
})();

/** Kinds the TypeScript protocol declares. */
const typescriptKinds = (() => {
  const block = /export type ExtensionRequestKind =([\s\S]*?);/.exec(protocolTs);
  if (!block) throw new Error("Could not locate ExtensionRequestKind in extension-protocol.ts");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
})();

describe("the two protocol implementations agree", () => {
  it("extracted both kind lists (the parse itself is not vacuous)", () => {
    expect(extensionKinds.length).toBeGreaterThan(10);
    expect(typescriptKinds.length).toBeGreaterThan(10);
  });

  it("declares the same PROTOCOL VERSION on both sides", () => {
    const jsVersion = /const PROTOCOL_VERSION = (\d+)/.exec(background)?.[1];
    expect(Number(jsVersion)).toBe(EXTENSION_PROTOCOL_VERSION);
  });

  it("accepts exactly the same request kinds — no drift in either direction", () => {
    expect([...extensionKinds].sort()).toEqual([...typescriptKinds].sort());
  });

  it("has no duplicate kind in either list", () => {
    expect(new Set(extensionKinds).size).toBe(extensionKinds.length);
    expect(new Set(typescriptKinds).size).toBe(typescriptKinds.length);
  });
});

describe("the extension validator fails closed", () => {
  const validateFn = /function validate\(msg\) \{([\s\S]*?)\n\}/.exec(background)?.[1] ?? "";

  it("was located in the source", () => {
    expect(validateFn.length).toBeGreaterThan(200);
  });

  it("rejects an unsupported protocol version", () => {
    expect(validateFn).toMatch(/msg\.v !== PROTOCOL_VERSION/);
  });

  it("rejects a kind outside the allowlist", () => {
    expect(validateFn).toMatch(/!KINDS\.has\(msg\.kind\)/);
  });

  it("requires a pairing token for every non-connect request", () => {
    expect(validateFn).toMatch(/if \(!pairingToken\)/);
    expect(validateFn).toMatch(/msg\.token !== pairingToken/);
  });

  it("requires an unexpired, matching pairing code to connect", () => {
    expect(validateFn).toMatch(/Date\.now\(\) > pairingExpiresAt/);
    expect(validateFn).toMatch(/msg\.pairingCode !== pairingCode/);
  });

  it("honours emergency stop, allowing ONLY stop, cancel and progress through", () => {
    // If any other kind were exempted here, emergency stop would not stop it.
    const stopClause = /emergencyStopped &&([\s\S]*?)\)/.exec(validateFn)?.[1] ?? "";
    expect(stopClause).toMatch(/emergency\.stop/);
    expect(stopClause).toMatch(/run\.cancel/);
    expect(stopClause).toMatch(/run\.progress/);
    const exempted = [...stopClause.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(exempted).toEqual(["emergency.stop", "run.cancel", "run.progress"]);
  });

  it("refuses further work on a cancelled run, with the same narrow exemptions", () => {
    const cancelClause =
      /cancelledRuns\.has\(msg\.runId\) &&([\s\S]*?)\)/.exec(validateFn)?.[1] ?? "";
    const exempted = [...cancelClause.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(exempted).toEqual(["run.cancel", "run.progress"]);
  });
});

describe("the extension package is a bounded attack surface", () => {
  it("is Manifest V3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("pins externally_connectable to specific origins, never a wildcard", () => {
    const matches = (manifest.externally_connectable as { matches?: string[] })?.matches ?? [];
    expect(matches.length).toBeGreaterThan(0);
    for (const pattern of matches) {
      expect(pattern).not.toBe("*://*/*");
      expect(pattern).not.toBe("<all_urls>");
      // Every pattern must name a concrete host, not a bare scheme wildcard.
      expect(pattern).toMatch(/^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d+)?\/\*$/i);
    }
  });

  it("requests no blanket host permissions up front", () => {
    const hosts = (manifest.host_permissions as string[] | undefined) ?? [];
    for (const pattern of hosts) {
      expect(pattern).not.toBe("<all_urls>");
      expect(pattern).not.toBe("*://*/*");
    }
  });

  it("asks for origin access at RUNTIME, only after the user approves", () => {
    expect(background).toMatch(/chrome\.permissions\.request\(/);
    expect(background).toMatch(/chrome\.permissions\.contains\(/);
  });

  it("contains no dynamic code execution", () => {
    expect(background).not.toMatch(/\beval\s*\(/);
    expect(background).not.toMatch(/new Function\s*\(/);
  });

  it("embeds no credential-shaped literal", () => {
    expect(background).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
    expect(background).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(JSON.stringify(manifest)).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
  });

  it("keeps the pairing token in memory only, never in extension storage", () => {
    // Persisting it would survive a browser restart and outlive the pairing.
    expect(background).not.toMatch(/chrome\.storage\.\w+\.set\([^)]*pairingToken/);
  });

  /*
   * Reconnection remembers a DECISION, not a CREDENTIAL.
   *
   * The extension may reconnect a previously paired origin without a fresh
   * popup code. The tempting shortcut is to stash the token and hand the same
   * one back — which is exactly what the test above forbids. These guard the
   * replacement: the stored record carries only an origin and timestamps, and
   * a reconnect must mint a new token rather than reuse a stored one.
   */
  it("stores only origin + expiry in the consent record, never a token", () => {
    const stored = background.slice(
      background.indexOf("async function rememberPairedOrigin"),
      background.indexOf("async function originHasLiveConsent"),
    );
    expect(stored).toContain("pairedAt");
    expect(stored).toContain("expiresAt");
    expect(stored).not.toMatch(/token/i);
  });

  it("mints a fresh token on reconnect instead of restoring one", () => {
    const reconnect = background.slice(background.indexOf("msg.reconnect === true"));
    // A new token is generated...
    expect(reconnect).toMatch(/pairingToken = newToken\(\)/);
    // ...and nothing is ever read back out of storage as a token.
    expect(background).not.toMatch(/pairingToken\s*=\s*[^;]*chrome\.storage/);
  });

  it("expires remembered consent rather than granting it forever", () => {
    expect(background).toMatch(/CONSENT_TTL_MS\s*=/);
    expect(background).toMatch(/Date\.now\(\) < entry\.expiresAt/);
  });

  it("revokes remembered consent on emergency stop", () => {
    const stop = background.slice(
      background.indexOf('case "emergency.stop"'),
      background.indexOf('case "emergency.stop"') + 400,
    );
    expect(stop).toContain("forgetAllPairedOrigins");
  });
});
