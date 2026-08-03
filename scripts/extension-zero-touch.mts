/**
 * HWE-21 — zero-touch browser-extension test profile.
 *
 * `extension/background.js` is 36 KB of real protocol logic that, until now,
 * was only ever asserted on as TEXT: tests read the file and matched strings.
 * That proves a string is present, not that a message is refused.
 *
 * "Zero-touch" means exercising the service worker without a human loading an
 * unpacked extension into a browser. This loads the real file into a Node VM
 * with a fake `chrome` API, captures the listeners it registers at top level,
 * and drives genuine protocol messages through them.
 *
 * WHAT THIS IS AND IS NOT
 * -----------------------
 * It executes the extension's own decision logic — pairing, origin checks,
 * message validation, emergency stop, protected-field refusal. That is real
 * behavioural evidence for the extension's PROTOCOL.
 *
 * It is NOT proof that the extension works in Chrome. The `chrome` API here is
 * a double: no real tab, DOM, page or permission prompt exists. Anything
 * depending on `chrome.scripting.executeScript` actually reaching a page is
 * unproven, and the harness records that rather than glossing it.
 */
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

export interface ChromeCall {
  api: string;
  args: unknown[];
}

export interface LoadedExtension {
  /** Send a message as the paired web page would (external channel). */
  external: (msg: unknown, sender?: unknown) => Promise<unknown>;
  /** Send a message from inside the extension (popup). */
  internal: (msg: unknown) => Promise<unknown>;
  calls: ChromeCall[];
  manifest: Record<string, unknown>;
}

export interface FakeChromeOptions {
  /** Origin the message claims to come from. */
  senderOrigin?: string;
  extensionId?: string;
  /** Tabs the fake browser reports. */
  tabs?: Array<Record<string, unknown>>;
  /** Whether optional permissions are already held. */
  hasPermission?: boolean;
  /** What executeScript returns; a double for real page injection. */
  scriptResult?: unknown;
}

/**
 * Load the real service worker with a fake `chrome`.
 *
 * The double records every call so a test can assert what the extension TRIED
 * to do, not merely what it returned — an extension that refuses a request but
 * still calls `chrome.tabs.update` has not really refused.
 */
export function loadExtension(opts: FakeChromeOptions = {}): LoadedExtension {
  const source = readFileSync("extension/background.js", "utf8");
  const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8")) as Record<
    string,
    unknown
  >;
  const calls: ChromeCall[] = [];
  const record = (api: string) => (...args: unknown[]) => {
    calls.push({ api, args });
    return undefined;
  };

  let onMessage: ((m: unknown, s: unknown, r: (v: unknown) => void) => boolean) | null = null;
  let onExternal: ((m: unknown, s: unknown, r: (v: unknown) => void) => boolean) | null = null;

  const tabs = opts.tabs ?? [{ id: 1, url: "https://example.com/page", title: "Example", active: true }];

  const chrome = {
    runtime: {
      id: opts.extensionId ?? "ocade-test-extension",
      getManifest: () => manifest,
      onMessage: {
        addListener: (fn: typeof onMessage) => {
          onMessage = fn;
        },
      },
      onMessageExternal: {
        addListener: (fn: typeof onExternal) => {
          onExternal = fn;
        },
      },
      onSuspend: { addListener: record("runtime.onSuspend.addListener") },
      lastError: undefined,
    },
    tabs: {
      query: async (q: unknown) => {
        calls.push({ api: "tabs.query", args: [q] });
        return tabs;
      },
      get: async (id: unknown) => {
        calls.push({ api: "tabs.get", args: [id] });
        return tabs.find((t) => t.id === id) ?? tabs[0];
      },
      create: async (o: unknown) => {
        calls.push({ api: "tabs.create", args: [o] });
        return { id: 99, ...(o as object) };
      },
      update: async (id: unknown, o: unknown) => {
        calls.push({ api: "tabs.update", args: [id, o] });
        return { id, ...(o as object) };
      },
      captureVisibleTab: async () => {
        calls.push({ api: "tabs.captureVisibleTab", args: [] });
        return "data:image/png;base64,AAAA";
      },
    },
    windows: { update: async (...a: unknown[]) => void calls.push({ api: "windows.update", args: a }) },
    scripting: {
      executeScript: async (o: unknown) => {
        calls.push({ api: "scripting.executeScript", args: [o] });
        return [{ result: opts.scriptResult ?? null }];
      },
    },
    permissions: {
      contains: async (p: unknown) => {
        calls.push({ api: "permissions.contains", args: [p] });
        return opts.hasPermission ?? false;
      },
      request: async (p: unknown) => {
        calls.push({ api: "permissions.request", args: [p] });
        return opts.hasPermission ?? false;
      },
    },
    downloads: {
      download: async (o: unknown) => {
        calls.push({ api: "downloads.download", args: [o] });
        return 1;
      },
    },
  };

  const sandbox = {
    chrome,
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Set,
    Map,
    Promise,
    URL,
    Error,
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    btoa: globalThis.btoa,
    atob: globalThis.atob,
    structuredClone: globalThis.structuredClone,
  };
  runInContext(source, createContext(sandbox), { filename: "extension/background.js" });

  const send =
    (which: "internal" | "external") =>
    (msg: unknown, sender: unknown = { origin: opts.senderOrigin ?? "https://app.caeracadane.com" }) =>
      new Promise<unknown>((resolve, reject) => {
        const fn = which === "external" ? onExternal : onMessage;
        if (!fn) {
          reject(new Error(`The extension registered no ${which} message listener.`));
          return;
        }
        const kept = fn(msg, sender, resolve);
        // A listener returning false means it will not reply asynchronously.
        if (kept !== true) resolve(undefined);
      });

  return {
    external: (m, s) => send("external")(m, s),
    internal: (m) => send("internal")(m),
    calls,
    manifest,
  };
}
