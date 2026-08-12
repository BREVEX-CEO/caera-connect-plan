import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  supervisionCapability,
  registerOfflineShell,
  SERVICE_WORKER_PATH,
} from "../local/web-supervisor";

/**
 * PROGRESSIVE WEB SUPERVISOR FALLBACK (HWE-35).
 *
 * Recorded NOT STARTED with a precise reason: "no progressive web app exists:
 * there is no web manifest and no service worker in the tree." The consequence
 * was that OCADE — a product whose pitch is that your conversations and your
 * engine can live on your device — would not open at all without a network.
 *
 * The distinction these tests defend hardest is between OPENING offline and
 * ANSWERING offline. A service worker gives the first. Only a local engine
 * gives the second. One "works offline" badge covering both is a promise the
 * product cannot keep, and the user finds out at the moment they ask a
 * question.
 */

describe("what this installation can honestly supervise", () => {
  const web = { companionAvailable: false, serviceWorkerSupported: true };

  it("a companion supervises a real process", () => {
    const cap = supervisionCapability({
      companionAvailable: true,
      serviceWorkerSupported: true,
      browserEngineAvailable: false,
    });
    expect(cap.mode).toBe("process");
    expect(cap.canStartEngineProcess).toBe(true);
  });

  it("a browser never claims it can start an engine process", () => {
    const cap = supervisionCapability({ ...web, browserEngineAvailable: true });
    expect(cap.mode).toBe("web");
    // The browser has no way to spawn anything. A screen offering "Start
    // engine" here would be a dead button by construction.
    expect(cap.canStartEngineProcess).toBe(false);
  });

  it("separates opening offline from answering offline", () => {
    // Shell cached, but no engine: the app opens and then cannot answer.
    const shellOnly = supervisionCapability({ ...web, browserEngineAvailable: false });
    expect(shellOnly.canRunOffline).toBe(true);
    expect(shellOnly.canAnswerOffline).toBe(false);
    expect(shellOnly.summary).toMatch(/opens without a connection, but answering still needs/);

    // Engine present, no service worker: it can answer, but only once loaded.
    const engineOnly = supervisionCapability({
      companionAvailable: false,
      serviceWorkerSupported: false,
      browserEngineAvailable: true,
    });
    expect(engineOnly.canRunOffline).toBe(false);
    expect(engineOnly.canAnswerOffline).toBe(true);
    expect(engineOnly.summary).toMatch(/still needs a connection to open/);
  });

  it("claims both only when both are true", () => {
    const cap = supervisionCapability({ ...web, browserEngineAvailable: true });
    expect(cap.canRunOffline).toBe(true);
    expect(cap.canAnswerOffline).toBe(true);
    expect(cap.summary).toMatch(/opens without a connection and can answer/);
  });

  it("says plainly when nothing can be supervised", () => {
    const cap = supervisionCapability({
      companionAvailable: false,
      serviceWorkerSupported: false,
      browserEngineAvailable: false,
    });
    expect(cap.mode).toBe("none");
    expect(cap.canRunOffline).toBe(false);
    expect(cap.canAnswerOffline).toBe(false);
    // Names the two things that would fix it.
    expect(cap.summary).toMatch(/desktop app/);
    expect(cap.summary).toMatch(/Cloud/);
  });
});

describe("installing the offline shell never breaks the app", () => {
  it("registers when the browser allows it", async () => {
    const outcome = await registerOfflineShell({
      supported: true,
      secureContext: true,
      register: async (path) => {
        expect(path).toBe(SERVICE_WORKER_PATH);
        return { scope: "/" };
      },
    });
    expect(outcome).toEqual({ ok: true, scope: "/" });
  });

  it("distinguishes an insecure origin from an unsupported browser", async () => {
    // These need different actions from the user: one is "visit the https URL",
    // the other is "this browser cannot do it". Collapsing them sends people
    // looking for a new browser when a different URL would have worked.
    const insecure = await registerOfflineShell({
      supported: true,
      secureContext: false,
      register: async () => ({ scope: "/" }),
    });
    expect(insecure).toEqual({
      ok: false,
      reason: "Offline mode needs a secure (https) connection.",
      retryable: true,
    });

    const unsupported = await registerOfflineShell({
      supported: false,
      secureContext: true,
    });
    expect(unsupported.ok).toBe(false);
    expect(unsupported).toMatchObject({ retryable: false });
  });

  it("returns a reason instead of throwing when registration is refused", async () => {
    // Private browsing and locked-down enterprise profiles reject the call.
    // An unhandled rejection on every page load would be the wrong response.
    const outcome = await registerOfflineShell({
      supported: true,
      secureContext: true,
      register: async () => {
        throw new Error("The operation is insecure.");
      },
    });
    expect(outcome).toEqual({
      ok: false,
      reason: "The operation is insecure.",
      retryable: true,
    });
  });
});

describe("the progressive web assets actually ship", () => {
  it("has a manifest that names a real start URL and icon", () => {
    expect(existsSync("public/manifest.webmanifest")).toBe(true);
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(manifest.name).toMatch(/OCADE/);
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/ocade");
    // A manifest pointing at an icon that 404s makes the install prompt fail
    // silently in some browsers.
    for (const icon of manifest.icons) {
      expect(existsSync(`public${icon.src}`), `${icon.src} is missing`).toBe(true);
    }
  });

  it("links the manifest from the document head", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toMatch(/rel:\s*"manifest"/);
  });

  it("registers the service worker from the application root", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toContain("registerOfflineShellFromBrowser");
  });

  it("ships a service worker and an offline page for it to serve", () => {
    expect(existsSync("public/sw.js")).toBe(true);
    expect(existsSync("public/offline.html")).toBe(true);
    const offline = readFileSync("public/offline.html", "utf8");
    // The offline page must not overclaim: vault-backed chats survive, cloud
    // does not.
    expect(offline).toMatch(/Browser Only|PC Vault/);
    expect(offline).toMatch(/Cloud is unavailable/i);
  });

  it("never caches API, server-function or auth responses", () => {
    /*
     * The assertion that matters most in this file. A cached 200 for a request
     * that should now be 401 is an access-control bug, and a cached chat reply
     * is someone's conversation surviving a sign-out on a shared computer.
     */
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('url.pathname.startsWith("/_serverFn/")');
    expect(sw).toContain('url.pathname.startsWith("/auth/")');
    // Non-GET must be left alone entirely: a cached POST is a request the user
    // believes happened.
    expect(sw).toMatch(/request\.method !== "GET"/);
  });

  it("serves navigations network-first, so nobody is stuck on an old build", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    // fetch() first, cache only in the catch. The reverse would pin users to
    // whatever version they first loaded.
    expect(sw).toMatch(/request\.mode === "navigate"/);
    expect(sw).toMatch(/fetch\(request\)\.catch\(/);
  });

  it("deletes previous cache versions when a new worker activates", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toMatch(/caches\.delete/);
    expect(sw).toMatch(/keys\.filter/);
  });
});
