import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const extensionRoot = resolve(process.cwd(), "extension");
const manifest = JSON.parse(
  readFileSync(resolve(extensionRoot, "manifest.json"), "utf8"),
) as Record<string, unknown>;
const background = readFileSync(resolve(extensionRoot, "background.js"), "utf8");

describe("browser extension package", () => {
  it("is a loadable MV3 source package with every referenced asset present", () => {
    expect(manifest.manifest_version).toBe(3);
    const serviceWorker = (manifest.background as { service_worker: string }).service_worker;
    const popup = (manifest.action as { default_popup: string }).default_popup;
    expect(statSync(resolve(extensionRoot, serviceWorker)).isFile()).toBe(true);
    expect(statSync(resolve(extensionRoot, popup)).isFile()).toBe(true);
    expect(statSync(resolve(extensionRoot, "popup.js")).isFile()).toBe(true);
    expect(statSync(resolve(extensionRoot, "icons", "icon128.png")).size).toBeGreaterThan(0);
  });

  it("has no blanket host grant and makes downloads optional", () => {
    expect(manifest.host_permissions).toEqual([]);
    expect(manifest.optional_host_permissions).toEqual(["http://*/*", "https://*/*"]);
    expect(manifest.optional_permissions).toContain("downloads");
    expect(manifest.incognito).toBe("not_allowed");
  });

  it("implements the closed Phase 9 action and stop protocol in the actual service worker", () => {
    for (const kind of [
      "tab.activate",
      "tab.create",
      "page.navigate",
      "page.wait",
      "page.summary",
      "page.a11y",
      "page.screenshot",
      "page.verify",
      "form.fill",
      "form.submit",
      "file.download",
      "file.upload",
      "file.drop",
      "run.progress",
      "run.cancel",
      "emergency.stop",
    ]) {
      expect(background).toContain(`"${kind}"`);
    }
    expect(background).toContain("fillApprovedFields");
    expect(background).toContain("verifyPage");
  });

  it("binds external control to popup pairing, per-origin grants, and private-window refusal", () => {
    expect(background).toContain('msg?.kind !== "pairing.begin"');
    expect(background).toContain("pairingExpiresAt");
    expect(background).toContain("ensureOriginPermission");
    expect(background).toContain("sender?.tab?.incognito");
    expect(background).toContain("pairingToken = null");
  });
});
