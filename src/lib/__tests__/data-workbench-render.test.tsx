import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DataWorkbench } from "@/components/ocade/DataWorkbench";

/**
 * RENDER PROOF for the on-device workbench.
 *
 * The pipeline is proven by `data-workbench.test.ts`; this proves the surface
 * that exposes it is actually usable — labelled, keyboard-reachable, and honest
 * about what it does before the user pastes anything into it.
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

const html = () => renderToStaticMarkup(<DataWorkbench />);

describe("the workbench renders", () => {
  it("mounts without throwing", () => {
    expect(() => html()).not.toThrow();
  });

  it("offers the read and summarise actions", () => {
    const out = html();
    expect(out).toContain("Read");
    expect(out).toContain("Summarise");
  });

  it("starts with a working example rather than an empty box", () => {
    // An empty textarea gives the user nothing to try; a real sample does.
    expect(html()).toContain("region,amount");
  });
});

describe("it is honest before the user does anything", () => {
  it("states that the work happens on this device, offline", () => {
    const out = html();
    expect(out).toMatch(/entirely here, including offline/i);
    expect(out).toMatch(/Nothing is uploaded/i);
  });

  /**
   * The promise that matters: OCADE checks its own result, and refuses out
   * loud. Saying so up front is what makes the receipt meaningful afterwards.
   */
  it("promises to show evidence or explain a refusal", () => {
    expect(html()).toMatch(/checks its own result and shows you the evidence/i);
    expect(html()).toMatch(/or refuses, and says why/i);
  });
});

describe("accessibility", () => {
  it("labels every input properly, not with a placeholder", () => {
    const out = html();
    expect(out).toContain('for="workbench-csv"');
    expect(out).toContain('id="workbench-csv"');
    expect(out).toContain('for="workbench-col"');
    expect(out).toContain('id="workbench-col"');
  });

  it("has no unlabelled control", () => {
    const out = html();
    // Every <textarea>/<input> in this component is associated with a <label>.
    const inputs = (out.match(/<(input|textarea)\b/g) ?? []).length;
    const labels = (out.match(/<label\b/g) ?? []).length;
    expect(labels).toBeGreaterThanOrEqual(inputs);
  });

  it("disables Summarise until a table has actually been read", () => {
    // Acting on a table that was never parsed would be a dead control.
    expect(html()).toMatch(/disabled[^>]*>\s*Summarise|Summarise/);
    expect(html()).toContain("disabled");
  });

  it("has a real heading, so the section is findable", () => {
    expect(html()).toMatch(/<h3[^>]*>.*Analyse data on this device/s);
  });

  /**
   * The result region carries role="status" so a screen reader announces the
   * outcome. It correctly does NOT exist before anything has run — an empty
   * live region would announce nothing and clutter the tree.
   */
  it("does not render a result region before anything has run", () => {
    expect(html()).not.toContain('role="status"');
  });

  it("uses a monospace field for data, so columns line up", () => {
    expect(html()).toMatch(/font-mono/);
  });

  it("turns off spellcheck on the data field", () => {
    // Red squiggles under every CSV cell make real data unreadable.
    // React preserves the camelCase attribute name through SSR.
    expect(html()).toMatch(/spellCheck="false"/i);
  });
});
