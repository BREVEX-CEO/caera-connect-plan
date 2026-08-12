import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkSessionPanel } from "@/components/ocade/WorkSessionPanel";
import { seedHealth, applyOutcome } from "@/lib/skills/adapter-health-map";
import { createTaskScope } from "../skills/task-scope";
import type { ResumableJob } from "../skills/adapter-health";
import type { InputEvent } from "../skills/session-recording";
import type { ControlMethod } from "../skills/skill-pack";

/**
 * RENDER PROOF for the live work session.
 *
 * The filters are unit-tested, but "the filter is correct" and "the filtered
 * value never reaches the markup" are different claims. These render the real
 * component and assert the produced HTML — which is where a privacy leak would
 * actually happen.
 */

const NOW = new Date("2026-07-23T10:00:00Z");

const job: ResumableJob = {
  id: "j1",
  startedAt: 0,
  updatedAt: 0,
  steps: [
    { id: "s1", summary: "Open the invoices folder", status: "done" },
    { id: "s2", summary: "Rename the March file", status: "failed" },
    { id: "s3", summary: "Move to archive", status: "pending" },
  ],
};

function render(over: Partial<Parameters<typeof WorkSessionPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <WorkSessionPanel
      scope={createTaskScope({
        id: "t",
        summary: "Tidy invoices",
        capabilities: ["file.open"],
        now: NOW,
      })}
      onScopeChange={() => {}}
      job={job}
      onJobChange={() => {}}
      health={seedHealth(["adapter"])}
      inputs={[]}
      protectedFieldIds={[]}
      {...over}
    />,
  );
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

describe("the panel renders real state", () => {
  it("shows each job step and where it will resume", () => {
    const html = render();
    expect(html).toContain("Open the invoices folder");
    expect(html).toContain("Rename the March file");
    expect(html).toMatch(/step 2 of 3/i);
  });

  it("offers to skip only the step that actually failed", () => {
    const html = render();
    expect((html.match(/Skip/g) ?? []).length).toBe(1);
  });

  it("reports route health rather than assuming it works", () => {
    const html = render();
    expect(html).toMatch(/not checked yet/i);
  });

  it("reflects a real observed outcome", () => {
    const health = applyOutcome(seedHealth(["adapter"]), "adapter", { ok: true, latencyMs: 25 });
    expect(render({ health })).toMatch(/working normally \(25 ms\)/i);
  });

  it("says a failing route is being routed around", () => {
    let health = applyOutcome(seedHealth(["adapter"]), "adapter", { ok: false });
    health = applyOutcome(health, "adapter", { ok: false });
    expect(render({ health })).toMatch(/using another route/i);
  });

  it("says plainly when nothing has run yet", () => {
    const html = render({ job: null, health: new Map<ControlMethod, never>() as never });
    expect(html).toMatch(/nothing has run yet/i);
    expect(html).toMatch(/nothing to report/i);
  });
});

/**
 * The strictest claim in this component: typed content must never reach the
 * rendered markup, not merely be masked once it is there.
 */
describe("typed content never reaches the markup", () => {
  const typed = (word: string): InputEvent[] =>
    word.split("").map((c) => ({ kind: "key", label: c, inProtectedField: false, at: 0 }));

  it("renders navigation keys", () => {
    const html = render({
      inputs: [{ kind: "key", label: "Ctrl+S", inProtectedField: false, at: 0 }],
    });
    expect(html).toContain("Ctrl+S");
  });

  it("a typed password NEVER appears, character by character or whole", () => {
    const html = render({ inputs: typed("hunter2") });
    expect(html).not.toContain("hunter2");
    // Nor reconstructable from individual rendered characters.
    for (const c of "hunter2") {
      expect(html).not.toContain(`text-[10px]">${c}<`);
    }
    expect(html).toMatch(/no keys to show/i);
  });

  it("drops even a safe key pressed inside a protected field", () => {
    const html = render({
      inputs: [{ kind: "key", label: "Tab", inProtectedField: true, at: 0 }],
    });
    expect(html).toMatch(/no keys to show/i);
  });

  it("states that what you type is never recorded", () => {
    expect(render()).toMatch(/what you type is never recorded/i);
  });

  it("names the masking that applies before any capture", () => {
    const html = render({ protectedFieldIds: ["accountNumber"] });
    expect(html).toMatch(/blanked before anything is captured/i);
  });
});

describe("replay controls are all present", () => {
  it("offers pause, cancel, emergency stop, undo and replay", () => {
    const html = render();
    for (const label of ["pause", "resume", "cancel", "emergency stop", "undo", "replay"]) {
      expect(html.toLowerCase()).toContain(label);
    }
  });

  it("reports honestly that nothing can be undone yet", () => {
    expect(render()).toMatch(/nothing here can be undone/i);
  });

  it("disables controls that have no active runtime implementation", () => {
    const html = render();
    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(html).toMatch(/runtime controls are unavailable/i);
  });

  it("never offers synthetic activity-log buttons", () => {
    const html = render();
    expect(html).not.toMatch(/log a read step|log a change/i);
  });
});
