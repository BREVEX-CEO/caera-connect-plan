/**
 * BROWSER WORK CAN NEVER REACH THE PC-CONTROL PATH.
 *
 * The architecture rule is not "the extension is preferred". It is that browser
 * Cowork does not require — and must not silently use — the Python sidecar, the
 * desktop companion or the old CDP host. "Preferred" is what the code looked
 * like before the adapter existed, and what it did was fall all the way through
 * to a server function every single time.
 *
 * `use-mission` implements the rule like this:
 *
 *     const viaExtension = await runBrowserToolViaExtension(call);
 *     if (viaExtension) return viaExtension;      // browser tools stop here
 *     ... runControlActionFn(...)                 // PC control, server-side
 *
 * So exclusivity reduces to ONE property, and it is the property tested here:
 * for every browser tool, `runBrowserToolViaExtension` NEVER returns null — not
 * when the extension is missing, not when it is the wrong version, not when the
 * command has no browser equivalent. A null is the only way execution can reach
 * the line below, so a null for a browser tool IS the fallback, whatever the
 * comments say.
 *
 * The mirror property matters just as much: a PC-control tool MUST return null,
 * or the desktop half of the product stops working.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { runBrowserToolViaExtension, EXTENSION_TOOLS } from "../native/extension-adapter";
import { allToolNames } from "../agent/tool-registry";
import type { ToolCall } from "../agent/loop";

const call = (name: string, args: Record<string, unknown> = {}): ToolCall =>
  ({ name, arguments: args }) as ToolCall;

/** Pretend an extension is there, and record what it was asked. */
function installFakeExtension(reply: unknown) {
  const sent: { command: string; argument: unknown }[] = [];
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: {
      sendMessage: (
        _id: string,
        message: { command: string; argument: unknown },
        cb: (r: unknown) => void,
      ) => {
        sent.push({ command: message.command, argument: message.argument });
        cb(reply);
      },
    },
  };
  return sent;
}

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
  vi.restoreAllMocks();
});

describe("no browser tool can fall through to PC control", () => {
  it("never returns null for a browser tool when NO extension is installed", async () => {
    // The important case. With no extension, the honest answer is "install it" —
    // NOT a silent hand-off to a desktop sidecar the user may not even have.
    for (const name of EXTENSION_TOOLS) {
      const outcome = await runBrowserToolViaExtension(call(name, { url: "https://x.test/" }));
      expect(outcome, `${name} fell through to the PC-control path`).not.toBeNull();
      expect(outcome!.kind).toBe("unsupported");
      expect(outcome!.detail).toMatch(/extension/i);
    }
  });

  it("never returns null for a browser tool when the extension IS installed", async () => {
    installFakeExtension({ ok: true, verified: true, evidence: "did it" });
    for (const name of EXTENSION_TOOLS) {
      const outcome = await runBrowserToolViaExtension(call(name, { url: "https://x.test/" }));
      expect(outcome, `${name} fell through to the PC-control path`).not.toBeNull();
    }
  });

  it("never returns null for a browser tool the extension refuses", async () => {
    installFakeExtension({ ok: false, reason: "That tab is outside the sites you approved." });
    for (const name of EXTENSION_TOOLS) {
      const outcome = await runBrowserToolViaExtension(call(name, { url: "https://x.test/" }));
      expect(outcome, `${name} fell through on refusal`).not.toBeNull();
      expect(outcome!.kind).not.toBe("success");
    }
  });

  it("covers every browser tool the registry actually offers", async () => {
    // A `browser_*` tool added to the registry and not to the adapter would be
    // routed to the server — the exact defect this file exists to prevent — and
    // every test above would still pass, because they iterate the adapter's own
    // list.
    const registryBrowserTools = allToolNames().filter((name) => name.startsWith("browser_"));
    const missing = registryBrowserTools.filter((name) => !EXTENSION_TOOLS.has(name));
    expect(missing, `these browser tools have no extension route: ${missing.join(", ")}`).toEqual(
      [],
    );
  });
});

describe("PC-control tools keep their own path", () => {
  it("returns null so the desktop half still works", async () => {
    installFakeExtension({ ok: true });
    for (const name of ["workspace_write", "screen_observe", "window_list", "input_type"]) {
      expect(await runBrowserToolViaExtension(call(name)), `${name} was hijacked`).toBeNull();
    }
  });
});

describe("the extension is the only thing a browser tool talks to", () => {
  it("sends the command to the extension and nowhere else", async () => {
    const sent = installFakeExtension({ ok: true, verified: true, evidence: "navigated" });
    // A server round trip would need fetch. If one happens, this fails loudly.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("a browser tool reached the network — that is the server path");
    });

    const outcome = await runBrowserToolViaExtension(
      call("browser_navigate", { url: "https://x.test/page" }),
    );

    expect(outcome).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0].command).toBe("navigate");
    expect(sent[0].argument).toMatchObject({ url: "https://x.test/page" });
  });
});
