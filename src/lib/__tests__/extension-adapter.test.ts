/**
 * The adapter that makes browser Cowork actually browser-first.
 *
 * These tests exist because the failure this file prevents is invisible: the
 * extension worked, the loop worked, and nothing connected them, so every
 * browser task quietly went to a desktop sidecar instead. A missing adapter
 * does not throw — it just means a feature is served by the wrong thing.
 */
import { describe, it, expect } from "vitest";
import {
  isExtensionTool,
  translate,
  toToolOutcome,
  EXTENSION_TOOLS,
} from "../native/extension-adapter";
import type { ToolCall } from "@/lib/agent/loop";
import type { Observation } from "../native/extension-protocol";
import { findTool } from "@/lib/agent/tool-registry";

const call = (name: string, args: Record<string, unknown> = {}): ToolCall =>
  ({ name, arguments: args }) as ToolCall;

describe("every browser tool the model can call is handled", () => {
  it("covers exactly the browser tools that describe a page action", () => {
    // If a browser_* tool is added to the registry and not here, the model can
    // call something the extension will never receive — which is the original
    // defect, reintroduced.
    for (const name of EXTENSION_TOOLS) {
      expect(findTool(name), `${name} is not a real tool`).toBeTruthy();
    }
  });

  it("routes browser tools and leaves everything else alone", () => {
    expect(isExtensionTool("browser_click")).toBe(true);
    expect(isExtensionTool("workspace_write")).toBe(false);
    expect(isExtensionTool("screen_observe")).toBe(false);
  });
});

describe("tool vocabulary translates to extension vocabulary", () => {
  it("reads the page", () => {
    expect(translate(call("browser_read"))).toEqual({ command: "observe", argument: {} });
  });

  it("navigates with the url the model gave", () => {
    expect(translate(call("browser_navigate", { url: "https://example.com/x" }))).toEqual({
      command: "navigate",
      argument: { url: "https://example.com/x" },
    });
  });

  it("clicks by visible text, which is how the model refers to what it read", () => {
    expect(translate(call("browser_click", { text: "Sign in" }))).toEqual({
      command: "click",
      argument: { target: { text: "Sign in" } },
    });
  });

  it("types into the selector the model named, carrying the value across", () => {
    // The tool says `value`; the content script says `text`. Getting this wrong
    // types `undefined` into a real field on a real site.
    expect(translate(call("browser_type", { selector: "#q", value: "hello" }))).toEqual({
      command: "type",
      argument: { target: { selector: "#q" }, text: "hello" },
    });
  });

  it("scrolls a screen in the direction asked, and up really is negative", () => {
    const down = translate(call("browser_scroll", { direction: "down" }));
    const up = translate(call("browser_scroll", { direction: "up" }));
    expect(down).toMatchObject({ command: "scroll" });
    expect(up).toMatchObject({ command: "scroll" });
    const by = (t: unknown) => (t as { argument: { by: number } }).argument.by;
    expect(by(down)).toBeGreaterThan(0);
    expect(by(up)).toBeLessThan(0);
    expect(by(up)).toBe(-by(down));
  });

  it("turns 'open a browser' into reading the tabs that are already open", () => {
    // There is no window to launch: the extension lives inside the browser the
    // person is already using.
    expect(translate(call("browser_open", { browser: "chrome" }))).toEqual({
      command: "tabs.list",
      argument: {},
    });
  });

  it("says plainly that it cannot press keys rather than pretending to", () => {
    const result = translate(call("browser_key", { key: "Enter" }));
    expect(result).toHaveProperty("unsupported");
    expect((result as { unsupported: string }).unsupported).toMatch(/cannot press keys/i);
  });

  it("returns null for a tool that is not a browser tool at all", () => {
    expect(translate(call("workspace_write", {}))).toBeNull();
  });
});

describe("a step outcome becomes a tool outcome without losing the distinction", () => {
  const observation: Observation = {
    url: "https://example.com/",
    title: "T",
    readyState: "complete",
    text: "hello",
    controls: [],
    signature: "https://example.com/|T|0",
    injectionAttempts: 0,
  };

  it("a verified mutation is a success that says it was verified", () => {
    const outcome = toToolOutcome({ kind: "done", evidence: "The page changed." }, observation);
    expect(outcome.kind).toBe("success");
    expect(outcome.verified).toBe(true);
    expect(outcome.observation).toBe(observation);
  });

  it("an UNVERIFIED mutation is never reported as success", () => {
    // This is the assertion the whole design rests on. A click that moved
    // nothing must not come back as done, and must not come back as a
    // retryable failure either — the model needs to see the evidence and
    // decide, not repeat itself against a page that may have moved.
    const outcome = toToolOutcome(
      { kind: "unverified", evidence: "Nothing measurable changed." },
      observation,
    );
    expect(outcome.kind).toBe("state_changed");
    expect(outcome.kind).not.toBe("success");
    expect(outcome.verified).toBe(false);
    expect(outcome.detail).toMatch(/nothing measurable/i);
  });

  it("a hand-over asks for the person rather than failing", () => {
    const outcome = toToolOutcome({
      kind: "blocked",
      reason: "blocked",
      handover: { what: "password", message: "Please enter it yourself in this tab." },
    });
    expect(outcome.kind).toBe("permission_required");
    expect(outcome.detail).toMatch(/enter it yourself/i);
  });

  it("a plain block stays blocked", () => {
    const outcome = toToolOutcome({ kind: "blocked", reason: "OCADE was stopped." });
    expect(outcome.kind).toBe("blocked");
    expect(outcome.detail).toBe("OCADE was stopped.");
  });

  it("something the browser cannot do is unsupported, not a failure to retry", () => {
    const outcome = toToolOutcome({ kind: "unavailable", reason: "Chrome would not capture." });
    expect(outcome.kind).toBe("unsupported");
  });

  it("a real failure is retryable", () => {
    const outcome = toToolOutcome({ kind: "failed", reason: "No element matched that target." });
    expect(outcome.kind).toBe("retryable_failure");
  });
});
