import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  rehearseTask,
  REHEARSAL_REALITY,
  type RehearsalStep,
  type RehearsalContext,
} from "../skills/rehearsal";
import { createTaskScope } from "../skills/task-scope";
import type { AdapterHealth } from "../skills/adapter-health";
import type { AppIdentity, ControlMethod, SkillCapability, SkillPack } from "../skills/skill-pack";

const NOW = new Date("2026-07-23T10:00:00Z");

const listWindows: SkillCapability = {
  id: "window.list",
  label: "List open windows",
  methods: ["official_api", "accessibility"],
  mutating: false,
  verifyBy: "api",
  tested: true,
};

const arrangeWindow: SkillCapability = {
  id: "window.arrange",
  label: "Arrange a window",
  methods: ["accessibility"],
  mutating: true,
  verifyBy: "ui",
  tested: true,
};

const app: AppIdentity = { appId: "demo.app", displayName: "Demo", version: "1.0.0" };

const pack: SkillPack = {
  appId: "demo.app",
  displayName: "Demo",
  category: "os_utilities",
  testedVersions: ["1."],
  capabilities: [listWindows, arrangeWindow],
  requiresLicensedInstall: false,
};

const context = (over: Partial<RehearsalContext> = {}): RehearsalContext => ({
  packs: [pack],
  scope: createTaskScope({
    id: "t1",
    summary: "Tidy the windows",
    capabilities: ["window.list", "window.arrange"],
    now: NOW,
  }),
  health: new Map<ControlMethod, AdapterHealth>(),
  availableMethods: ["official_api", "accessibility"],
  recording: "video_off",
  now: NOW,
  ...over,
});

const listStep: RehearsalStep = { action: { kind: "window.list" }, capability: listWindows, app };
const arrangeStep: RehearsalStep = {
  action: { kind: "window.arrange", layout: "left" },
  capability: arrangeWindow,
  app,
};

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

describe("rehearsing a clear task", () => {
  it("reports every step ready and does not execute", () => {
    const r = rehearseTask([listStep, arrangeStep], context());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.allClear).toBe(true);
    expect(r.data.steps).toHaveLength(2);
    expect(r.data.steps.every((s) => s.status === "ready")).toBe(true);
    expect(r.data.steps[0].method).toBeDefined();
  });

  it("does not mutate the caller's scope", () => {
    const ctx = context();
    const before = ctx.scope!.steps;
    rehearseTask([listStep, arrangeStep], ctx);
    // planStep returns fresh scopes; the original is untouched.
    expect(ctx.scope!.steps).toBe(before);
  });

  it("is honest that clear is not a guarantee", () => {
    const r = rehearseTask([listStep], context());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.headline).toMatch(/can't promise the apps and files will be as expected/i);
    expect(REHEARSAL_REALITY).toMatch(/not a guarantee/i);
    expect(REHEARSAL_REALITY).toMatch(/verifies each step as it runs/i);
  });
});

describe("rehearsing surfaces every blocker at once", () => {
  /**
   * The whole point: a task blocked at step 2 should report step 2's problem
   * during rehearsal, before step 1 runs and changes anything.
   */
  it("reports a permission blocker without running earlier steps", () => {
    const narrow = context({
      scope: createTaskScope({
        id: "t1",
        summary: "Only allowed to look",
        capabilities: ["window.list"], // arrange NOT granted
        now: NOW,
      }),
    });
    const r = rehearseTask([listStep, arrangeStep], narrow);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.allClear).toBe(false);
    expect(r.data.blockers).toHaveLength(1);
    expect(r.data.blockers[0].index).toBe(1);
    expect(r.data.blockers[0].status).toBe("not_permitted");
  });

  it("collects distinct blocker kinds", () => {
    const noScope = context({ scope: null });
    const r = rehearseTask([listStep, arrangeStep], noScope);
    if (!r.ok) throw new Error("unreachable");
    // With no scope, both steps are not_permitted (unapproved task).
    expect(r.data.blockerKinds).toEqual(["not_permitted"]);
    expect(r.data.blockers).toHaveLength(2);
  });

  it("flags a step whose only method is unavailable", () => {
    // arrange needs accessibility; offer only official_api.
    const r = rehearseTask([arrangeStep], context({ availableMethods: ["official_api"] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.allClear).toBe(false);
    // planStep refuses when no method is available for the capability.
    expect(r.data.blockers[0].status).toBe("not_permitted");
  });

  it("tells ready from blocked in a mixed task and counts both", () => {
    const narrow = context({
      scope: createTaskScope({
        id: "t1",
        summary: "Look only",
        capabilities: ["window.list"],
        now: NOW,
      }),
    });
    const r = rehearseTask([listStep, arrangeStep, listStep], narrow);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.steps[0].status).toBe("ready");
    expect(r.data.steps[1].status).toBe("not_permitted");
    expect(r.data.steps[2].status).toBe("ready");
    expect(r.data.headline).toMatch(/1 of 3 steps blocked, 2 ready/);
  });

  it("refuses an empty rehearsal", () => {
    expect(rehearseTask([], context()).ok).toBe(false);
  });
});
