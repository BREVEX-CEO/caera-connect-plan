import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GovernedRunPanel } from "@/components/ocade/GovernedRunPanel";

/**
 * RENDER PROOF for the governed-run surface.
 *
 * The pipeline is proven end-to-end by governed-run.test.ts; this proves the
 * surface exposing it is honest before anything runs — two real buttons, no
 * pre-baked result, and a plain statement of what the run will actually do.
 */

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

const html = () => renderToStaticMarkup(<GovernedRunPanel />);

describe("the governed-run panel", () => {
  it("mounts without throwing", () => {
    expect(() => html()).not.toThrow();
  });

  it("offers both the run and the blocked-run demonstrations", () => {
    const out = html();
    expect(out).toContain("Run it");
    expect(out).toMatch(/Run one that isn.{0,4}t allowed/);
  });

  it("names the whole contract it will run, not just 'run'", () => {
    const out = html();
    expect(out).toMatch(/plan and check the approval/i);
    expect(out).toMatch(/govern the confidence/i);
    expect(out).toMatch(/require a recovery path/i);
    expect(out).toMatch(/save a receipt to Artifacts/i);
  });

  it("shows no result region before anything runs", () => {
    expect(html()).not.toContain('role="status"');
  });

  it("offers real buttons, not clickable-looking text", () => {
    expect(html()).toMatch(/<button[\s\S]*?Run it/);
  });
});
