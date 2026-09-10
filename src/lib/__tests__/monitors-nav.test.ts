import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { MODULE_CONTEXT } from "../shell-nav";

/**
 * MONITORS IS STILL REACHABLE, AND IS NO LONGER A DESTINATION.
 *
 * This asserted that `/ocade/monitors` was a distinct destination wired into
 * navigation — the §5.3 world-scan feature, not an orphaned route. `PLAN.md`
 * §4 then folded monitors into Tasks: "Automations, monitors, inbox,
 * notifications, and schedules into Tasks." The requirement underneath the old
 * assertion survives the move — a person can still get to it — but the thing
 * that must be true changed shape, so the test changed with it rather than
 * being deleted.
 */
describe("Monitors after the consolidation", () => {
  it("renders inside the Tasks screen", () => {
    const tasks = readFileSync("src/components/ocade/TasksWorkspace.tsx", "utf8");
    expect(tasks).toContain("MonitorsSection");
  });

  it("keeps the section that defines and revokes a monitor", () => {
    const section = readFileSync("src/components/ocade/tasks/MonitorsSection.tsx", "utf8");
    for (const call of ["createMonitor", "setMonitorState", "revokeMonitor", "listMonitors"]) {
      expect(section, call).toContain(call);
    }
  });

  it("still refuses to imply that anything is polling", () => {
    /*
     * The most important line the old page carried. Saving a monitor stores a
     * definition; no runner checks it. A consolidation that lost this would
     * have turned an honest screen into a promise of surveillance OCADE does
     * not perform.
     */
    const section = readFileSync("src/components/ocade/tasks/MonitorsSection.tsx", "utf8");
    expect(section).toMatch(/no monitor runner is polling/i);
  });

  it("forwards its old address rather than answering with a 404", () => {
    const route = readFileSync("src/routes/_authenticated/ocade.monitors.tsx", "utf8");
    expect(route).toContain("beforeLoad");
    expect(route).toContain('to: "/ocade/tasks"');
  });

  it("does not collide with another rail destination", () => {
    const targets = MODULE_CONTEXT.ocade.map((item) => item.to);
    expect(new Set(targets).size).toBe(targets.length);
  });
});
