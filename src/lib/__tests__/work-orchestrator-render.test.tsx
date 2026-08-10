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
  it("Control + Work is reachable as its own section, not folded into Chat", () => {
    /*
     * The previous rule here was that /ocade/work must NOT appear in the rail
     * and must redirect to /ocade. Control + Work is now a real destination
     * with its own runtime — it is the only path that may change this computer,
     * where Chat cannot — so both halves of that rule are inverted: the entry
     * must exist, and the route must not redirect.
     */
    const entry = MODULE_CONTEXT.ocade.find((item) => item.to === "/ocade/work");
    expect(entry).toBeDefined();
    expect(entry?.label).toBe("Control + Work");
    const route = source("src/routes/_authenticated/ocade.work.tsx");
    expect(route).not.toContain("redirect(");
    expect(route).toContain("ControlWorkPanel");
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
