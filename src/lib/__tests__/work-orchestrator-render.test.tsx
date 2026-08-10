import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkOrchestratorPanel } from "@/components/ocade/WorkOrchestratorPanel";
import { MODULE_CONTEXT } from "../shell-nav";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
});

const html = () => renderToStaticMarkup(<WorkOrchestratorPanel />);
const source = (path: string) => readFileSync(path, "utf8");

describe("the Work mission runtime", () => {
  /*
   * REWRITTEN, NOT RELAXED.
   *
   * This used to assert that /ocade/work redirected to Chat — that Control +
   * Work was a name with nothing behind it. Control + Work is now its own
   * surface, so pinning the redirect would pin the absence of the feature.
   *
   * What replaces it is a stronger property than the old one: the two surfaces
   * must be structurally distinguishable. Chat must not be able to act on the
   * machine even if a message sounds like an instruction, and the only way to
   * guarantee that is for Chat never to construct a live-world runtime.
   */
  it("gives Control + Work its own reachable surface", () => {
    const entry = MODULE_CONTEXT.ocade.find((item) => item.to === "/ocade/work");
    expect(entry).toBeDefined();
    expect(entry?.label).toBe("Control + Work");

    const workRoute = source("src/routes/_authenticated/ocade.work.tsx");
    expect(workRoute).not.toContain("redirect(");
    expect(workRoute).toContain("ControlWorkSurface");
  });

  it("keeps computer control out of the Chat surface", () => {
    // The separation is enforced here rather than trusted: a future edit that
    // wires the live-world runtime into Chat fails this test rather than
    // silently making every question a potential action.
    const chat = source("src/routes/_authenticated/ocade.tsx");
    expect(chat).not.toContain("useControlWork");
    const work = source("src/lib/agent/use-control-work.ts");
    expect(work).toContain("createDesktopLiveWorldRuntime");
  });

  it("renders graph, role, budget, checkpoint, and supervision state", () => {
    const rendered = html();
    expect(rendered).toContain("Dependency graph");
    expect(rendered).toContain("Specialized roles");
    expect(rendered).toContain("Resource budget");
    expect(rendered).toContain("Durable checkpoint");
    expect(rendered).toContain("Mobile supervision");
  });

  it("offers actual stepwise run, pause, resume, and cancel controls", () => {
    const rendered = html();
    expect(rendered).toContain("Run next checkpoint");
    expect(rendered).toMatch(/>\s*Pause<\/button>/);
    expect(rendered).toMatch(/>\s*Resume<\/button>/);
    expect(rendered).toMatch(/>\s*Cancel<\/button>/);
    expect(rendered).toContain("New local proof");
  });

  it("states the native boundary and never pre-renders success", () => {
    const rendered = html();
    expect(rendered).toContain("local proof data only");
    expect(rendered).toContain("Native Companion");
    expect(rendered).not.toContain("Mission succeeded");
    expect(rendered).not.toContain("Receipt saved");
  });
});

describe("the Work panel is wired to the durable orchestrator", () => {
  const panel = source("src/components/ocade/WorkOrchestratorPanel.tsx");

  it("uses durable browser checkpoints and host recovery", () => {
    expect(panel).toContain("BrowserWorkCheckpointStore");
    expect(panel).toContain("runWorkMission");
    expect(panel).toContain("recover(operationId");
  });

  it("runs one durable batch per user checkpoint action", () => {
    expect(panel).toContain("execute(undefined, 1)");
    expect(panel).toContain("...(checkpointLimit ? { checkpointLimit } : {})");
    expect(panel).toContain('source: "mobile"');
  });
});
