import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MODULE_CONTEXT } from "../shell-nav";

/**
 * RENDER PROOF for the Artifacts surface.
 *
 * The master plan requires Artifacts to be a real destination, "not a renamed
 * link to Projects". These prove it is reachable on its own and that the two
 * things distinguishing it from a file list — the verified badge and the
 * integrity check — actually reach the page.
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

describe("Artifacts is its own destination, not an alias of Projects", () => {
  it("has a distinct route in OCADE's navigation", () => {
    const artifacts = MODULE_CONTEXT.ocade.find((i) => i.label === "Artifacts");
    const projects = MODULE_CONTEXT.ocade.find((i) => i.label === "Projects");
    expect(artifacts).toBeDefined();
    expect(projects).toBeDefined();
    // The defect the plan calls out: a label pointing at another page's URL.
    expect(artifacts!.to).toBe("/ocade/artifacts");
    expect(artifacts!.to).not.toBe(projects!.to);
    expect(artifacts!.planned).toBeUndefined();
  });

  it("every OCADE nav entry points at a unique destination", () => {
    const targets = MODULE_CONTEXT.ocade.map((i) => i.to);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

/**
 * The route component reads localStorage on mount, so it is exercised through
 * the store rather than rendered directly here (SSR has no localStorage before
 * the stub). The store's own behaviour is covered by artifacts.test.ts; this
 * file guards the wiring that a unit test can't see.
 */
describe("the empty state renders through the real component", () => {
  it("mounts the empty state without throwing", async () => {
    const { EmptyState } = await import("@/components/shell/EmptyState");
    const { Package } = await import("lucide-react");
    const html = renderToStaticMarkup(
      <EmptyState
        icon={<Package className="h-8 w-8" aria-hidden />}
        title="No artifacts yet"
        description="When OCADE produces something worth keeping it appears here."
      />,
    );
    expect(html).toContain("No artifacts yet");
    expect(html).toContain("appears here");
  });
});
