import { describe, it, expect, afterEach } from "vitest";
import {
  describeOutcome,
  requiresHuman,
  MUTATING_COMMANDS,
  WEBSITE_FORBIDDEN_COMMANDS,
  EXTENSION_PROTOCOL_VERSION,
  type ExtensionResult,
} from "../native/extension-protocol";
import {
  sendToExtension,
  handshakeWithExtension,
  extensionChannelAvailable,
  control,
} from "../native/extension-bridge";

/**
 * The website's end of the Cowork channel.
 *
 * The extension's own behaviour is proven in a real browser by
 * `extension/tests/cowork-e2e.mjs`. What is checked HERE is the half that runs
 * in the page: that a mutation with no verification is never reported as done,
 * that the site cannot ask for scope, and that a browser with no extension
 * gets an answer rather than an exception.
 */

const originalChrome = (globalThis as { chrome?: unknown }).chrome;
afterEach(() => {
  if (originalChrome === undefined) delete (globalThis as { chrome?: unknown }).chrome;
  else (globalThis as { chrome?: unknown }).chrome = originalChrome;
});

/** A stand-in extension that answers whatever the test hands it. */
function installFakeExtension(reply: unknown, lastError?: string) {
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: {
      lastError: lastError ? { message: lastError } : undefined,
      sendMessage: (_id: string, _message: unknown, callback: (r: unknown) => void) =>
        setTimeout(() => callback(reply), 0),
    },
  };
}

describe("a change is only called done when it was seen to happen", () => {
  it("reports a verified mutation as done", () => {
    const result: ExtensionResult = { ok: true, verified: true, evidence: "the page changed" };
    expect(describeOutcome("click", result)).toEqual({
      kind: "done",
      evidence: "the page changed",
    });
  });

  /** The whole point: a click that hit nothing looks exactly like one that worked. */
  it("REFUSES to call an unverified mutation done", () => {
    const result: ExtensionResult = { ok: true, verified: false, evidence: "nothing moved" };
    expect(describeOutcome("click", result).kind).toBe("unverified");
  });

  it("treats a mutation with no verification field as unverified, not as done", () => {
    expect(describeOutcome("type", { ok: true }).kind).toBe("unverified");
  });

  it.each([...MUTATING_COMMANDS])("%s must carry verification", (command) => {
    expect(describeOutcome(command, { ok: true }).kind).toBe("unverified");
  });

  it("does not demand verification of a read", () => {
    expect(describeOutcome("observe", { ok: true, evidence: "read" }).kind).toBe("done");
  });
});

describe("refusals keep their meaning on the way to the person", () => {
  it("marks a hand-over as blocked and carries what is needed", () => {
    const outcome = describeOutcome("type", {
      ok: false,
      reason: "OCADE will not type a password.",
      blocked: true,
      handover: { what: "password", message: "Please type it yourself." },
    });
    expect(outcome.kind).toBe("blocked");
    expect(outcome).toHaveProperty("handover.what", "password");
  });

  it("separates 'cannot' from 'refused'", () => {
    expect(describeOutcome("screenshot", { ok: false, reason: "no", unavailable: true }).kind).toBe(
      "unavailable",
    );
    expect(describeOutcome("click", { ok: false, reason: "no", blocked: true }).kind).toBe(
      "blocked",
    );
    expect(describeOutcome("click", { ok: false, reason: "broke" }).kind).toBe("failed");
  });

  it("knows when a run must wait for a person rather than retry", () => {
    expect(requiresHuman({ ok: false, reason: "x", handover: { what: "PIN", message: "m" } })).toBe(
      true,
    );
    expect(requiresHuman({ ok: false, reason: "transient" })).toBe(false);
    expect(requiresHuman({ ok: true })).toBe(false);
  });
});

describe("the website cannot give itself more reach", () => {
  it.each([...WEBSITE_FORBIDDEN_COMMANDS])("refuses to send %s", async (command) => {
    installFakeExtension({ ok: true });
    const result = await sendToExtension(command as never);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/cannot approve a site for itself|popup/i);
  });

  it("does not even reach the extension for those commands", async () => {
    let reached = false;
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage: (_i: string, _m: unknown, cb: (r: unknown) => void) => {
          reached = true;
          cb({ ok: true });
        },
      },
    };
    await sendToExtension("scope.approve" as never);
    expect(reached).toBe(false);
  });
});

describe("a browser with no extension gets an answer, not an exception", () => {
  it("says the extension is not installed when there is no channel at all", async () => {
    delete (globalThis as { chrome?: unknown }).chrome;
    expect(extensionChannelAvailable()).toBe(false);
    const result = await sendToExtension("observe");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/not installed/i);
  });

  it("treats Chrome's lastError as 'not installed' rather than success", async () => {
    installFakeExtension(undefined, "Could not establish connection.");
    const result = await sendToExtension("observe");
    expect(result.ok).toBe(false);
  });

  it("does not throw when sendMessage itself throws", async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage: () => {
          throw new Error("boom");
        },
      },
    };
    await expect(sendToExtension("observe")).resolves.toMatchObject({ ok: false });
  });
});

describe("the handshake reports a mismatch instead of guessing", () => {
  it("accepts a matching protocol version", async () => {
    installFakeExtension({
      ok: true,
      extension: "1.0.0",
      protocolVersion: EXTENSION_PROTOCOL_VERSION,
      status: { control: "running", approvedOrigins: [], reason: null, handover: null },
    });
    const shake = await handshakeWithExtension();
    expect(shake.installed).toBe(true);
    expect(shake.compatible).toBe(true);
  });

  /** An older extension answering a newer command is how a `verified` flag goes missing. */
  it("reports an older extension as incompatible and says what to do", async () => {
    installFakeExtension({ ok: true, extension: "0.9.0", protocolVersion: 0 });
    const shake = await handshakeWithExtension();
    expect(shake.installed).toBe(true);
    expect(shake.compatible).toBe(false);
    expect(shake.reason).toMatch(/update the extension/i);
  });

  it("reports no extension at all as not installed", async () => {
    delete (globalThis as { chrome?: unknown }).chrome;
    const shake = await handshakeWithExtension();
    expect(shake.installed).toBe(false);
    expect(shake.compatible).toBe(false);
  });
});

describe("the control surface reaches the extension", () => {
  it.each([
    ["pause", "control.pause"],
    ["resume", "control.resume"],
    ["stop", "control.stop"],
    ["takeOver", "control.takeover"],
    ["status", "control.status"],
  ])("%s sends %s", async (method, expected) => {
    let sent = "";
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage: (_i: string, message: { command: string }, cb: (r: unknown) => void) => {
          sent = message.command;
          cb({ ok: true });
        },
      },
    };
    await (control as unknown as Record<string, () => Promise<unknown>>)[method]();
    expect(sent).toBe(expected);
  });
});
