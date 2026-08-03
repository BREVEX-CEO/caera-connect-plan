import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PreflightPanel } from "@/components/ocade/PreflightPanel";

/**
 * RENDER PROOF for the pre-flight panel.
 *
 * Its real purpose here is to prove the three previously-orphaned modules
 * (rehearsal, shadow-execution, learning-replay) are now reached by a routed
 * component — importing the panel pulls them in. It also checks the panel is
 * honest before anything runs.
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

const html = () => renderToStaticMarkup(<PreflightPanel />);

describe("the pre-flight panel wires the formerly-orphaned safety modules", () => {
  it("mounts without throwing", () => {
    expect(() => html()).not.toThrow();
  });

  it("offers all three checks — rehearse, shadow, replay", () => {
    const out = html();
    expect(out).toContain("Rehearse a plan");
    expect(out).toContain("Shadow a code change");
    expect(out).toContain("Replay a task");
  });

  it("states what each check does before anything runs", () => {
    const out = html();
    expect(out).toMatch(/rehearse the whole plan without acting/i);
    expect(out).toMatch(/prove a code change on a copy first/i);
    expect(out).toMatch(/keeps the mistakes in/i);
  });

  it("shows no result region before a check is chosen", () => {
    expect(html()).not.toContain('role="status"');
  });
});

/**
 * Static reachability guard: the panel module must import each of the three
 * modules directly, so they can never silently become orphaned again.
 */
describe("the modules are genuinely reached", () => {
  it("imports rehearsal, shadow-execution and learning-replay", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../components/ocade/PreflightPanel.tsx", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("skills/rehearsal");
    expect(src).toContain("skills/shadow-execution");
    expect(src).toContain("artifacts/learning-replay");
  });
});
