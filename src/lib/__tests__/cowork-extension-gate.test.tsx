// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CoworkExtensionGate } from "@/components/ocade/cowork/CoworkExtensionGate";

/**
 * The panel that decides whether OCADE can act in this browser.
 *
 * THE RULE UNDER TEST is honesty about installation. A page cannot install a
 * browser extension, so the only truthful states are "it answered, therefore it
 * is here" and "it did not, here is how to add it". Anything that claims an
 * install it has not seen, or that sits on a spinner forever, is the defect.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
});

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<CoworkExtensionGate />);
  });
  // Let the handshake settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
  return container!.textContent ?? "";
}

/** An extension that answers a handshake with the given payload. */
function installFakeExtension(reply: unknown) {
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: {
      sendMessage: (_id: string, _message: unknown, callback: (r: unknown) => void) =>
        setTimeout(() => callback(reply), 0),
    },
  };
}

describe("when no extension answers", () => {
  it("says the extension is needed rather than claiming it is there", async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage: (_i: string, _m: unknown, cb: (r: unknown) => void) =>
          setTimeout(() => cb(undefined), 0),
        lastError: { message: "Could not establish connection." },
      },
    };
    const text = await mount();
    expect(text).toMatch(/needs its browser extension/i);
    expect(text).not.toMatch(/connected/i);
  });

  it("shows the Load unpacked steps, and does not pretend to install anything", async () => {
    installFakeExtension(undefined);
    const text = await mount();
    expect(text).toMatch(/chrome:\/\/extensions/);
    expect(text).toMatch(/developer mode/i);
    expect(text).toMatch(/load unpacked/i);
    // The promise it must never make.
    expect(text).not.toMatch(/installing|install for you|adding it now/i);
    expect(text).toMatch(/a page cannot install an extension for you/i);
  });

  it("offers a way to re-check rather than leaving a dead end", async () => {
    installFakeExtension(undefined);
    await mount();
    const buttons = [...container!.querySelectorAll("button")];
    expect(buttons.some((b) => /check again/i.test(b.textContent ?? ""))).toBe(true);
  });

  it("never sits on a spinner once the handshake has settled", async () => {
    installFakeExtension(undefined);
    const text = await mount();
    expect(text).not.toMatch(/Looking for the OCADE Cowork extension/i);
  });
});

describe("when the extension answers", () => {
  it("reports it connected, and says what that does and does not permit", async () => {
    installFakeExtension({ ok: true, extension: "1.0.0", protocolVersion: 1 });
    const text = await mount();
    expect(text).toMatch(/cowork is connected/i);
    expect(text).toMatch(/1\.0\.0/);
    // The scope promise has to travel with the good news.
    expect(text).toMatch(/inside the sites you approve/i);
  });

  it("calls back exactly once when it becomes ready", async () => {
    installFakeExtension({ ok: true, extension: "1.0.0", protocolVersion: 1 });
    const seen: unknown[] = [];
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<CoworkExtensionGate onReady={(h) => seen.push(h)} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(seen).toHaveLength(1);
  });
});

describe("when the extension is too old", () => {
  it("asks for an update instead of failing later in a way nobody can read", async () => {
    installFakeExtension({ ok: true, extension: "0.9.0", protocolVersion: 0 });
    const text = await mount();
    expect(text).toMatch(/needs updating/i);
    expect(text).toMatch(/update the extension/i);
    expect(text).not.toMatch(/cowork is connected/i);
    // Install steps are wrong advice for an extension that IS installed.
    expect(text).not.toMatch(/load unpacked/i);
  });
});
