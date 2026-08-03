import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConversationControls } from "@/components/ocade/ConversationControls";

/**
 * RENDER PROOF for the conversation-controls surface.
 *
 * The state machines are unit-tested; this proves the surface consuming them
 * mounts, shows the real seeded thread, and is honest up front that it isn't
 * calling a model.
 */

const html = () => renderToStaticMarkup(<ConversationControls />);

describe("the conversation-controls panel", () => {
  it("mounts without throwing", () => {
    expect(() => html()).not.toThrow();
  });

  it("renders the seeded active thread from the real graph", () => {
    const out = html();
    expect(out).toContain("Summarise the quarterly numbers.");
    expect(out).toContain("Revenue rose 12%, costs held flat.");
  });

  it("offers branch and stream controls", () => {
    const out = html();
    expect(out).toMatch(/Regenerate answer/);
    expect(out).toMatch(/Edit .{0,6}resend question/);
    expect(out).toContain("Start");
    expect(out).toContain("Next chunk");
    expect(out).toContain("Stop");
  });

  /** Honesty up front: this demonstrates controls, it is not a model call. */
  it("states plainly it isn't calling a model", () => {
    expect(html()).toMatch(/isn.{0,4}t calling a model/i);
    expect(html()).toMatch(/running on this device/i);
  });

  /**
   * Before any streaming has started there is no streamed content region and
   * no branch-count status (only one version exists at seed).
   */
  it("shows no stream output or branch-count before interaction", () => {
    const out = html();
    expect(out).not.toMatch(/versions of this answer/);
    // The streaming output region only renders once a stream has started.
    expect(out).not.toMatch(/fragment, not a finished answer/);
  });

  it("disables Next chunk and Stop until a stream is started", () => {
    const buttons = html().match(/<button[\s\S]*?<\/button>/g) ?? [];
    const next = buttons.find((b) => b.includes("Next chunk"));
    const stop = buttons.find((b) => b.includes("Stop"));
    expect(next).toBeDefined();
    expect(stop).toBeDefined();
    expect(next!).toMatch(/\sdisabled=""/);
    expect(stop!).toMatch(/\sdisabled=""/);
    // Start is available.
    const start = buttons.find((b) => />\s*Start\s*</.test(b));
    expect(start).toBeDefined();
    expect(start!).not.toMatch(/\sdisabled=""/);
  });
});
