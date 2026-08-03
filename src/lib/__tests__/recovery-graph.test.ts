import { describe, it, expect } from "vitest";
import {
  assessRecovery,
  assessTaskRecovery,
  type StepRecovery,
  type RecoveryOption,
} from "../skills/recovery-graph";

const opt = (kind: RecoveryOption["kind"], ready = true): RecoveryOption => ({
  kind,
  plan: `${kind} plan`,
  ready,
});

const step = (over: Partial<StepRecovery> = {}): StepRecovery => ({
  intent: "Rename the file",
  risk: "low",
  verifiable: true,
  options: [opt("cancel")],
  ...over,
});

describe("recovery must meet the risk", () => {
  it("clears a read with no recovery at all — nothing changes", () => {
    const r = assessRecovery(step({ risk: "read", options: [] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safe).toBe(true);
    expect(r.data.required).toBe("none");
  });

  it("clears a low-risk write that can at least be cancelled", () => {
    const r = assessRecovery(step({ risk: "low", options: [opt("cancel")] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safe).toBe(true);
  });

  it("requires a restore point for a high-risk step", () => {
    const cancelOnly = assessRecovery(step({ risk: "high", options: [opt("cancel")] }));
    const restorable = assessRecovery(step({ risk: "high", options: [opt("restore")] }));
    if (!cancelOnly.ok || !restorable.ok) throw new Error("unreachable");
    expect(cancelOnly.data.safe).toBe(false);
    expect(cancelOnly.data.reason).toMatch(/won't run a change it can't walk back/i);
    expect(restorable.data.safe).toBe(true);
  });

  /**
   * Only READY options count. A checkpoint that was never taken is not
   * recovery — counting it would be the after-the-fact surprise the graph
   * exists to prevent.
   */
  it("ignores a recovery option that isn't ready yet", () => {
    const r = assessRecovery(step({ risk: "high", options: [opt("restore", false)] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.best).toBe("none");
    expect(r.data.safe).toBe(false);
  });

  it("picks the strongest ready option as best", () => {
    const r = assessRecovery(
      step({ risk: "high", options: [opt("cancel"), opt("restore"), opt("undo")] }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.best).toBe("undo");
    expect(r.data.safe).toBe(true);
  });

  /**
   * An unverifiable low-risk write is held to a higher bar (isolate), because a
   * bad write you can't even detect needs containing.
   */
  it("raises the bar for an unverifiable low-risk write", () => {
    const cancelOnly = assessRecovery(
      step({ risk: "low", verifiable: false, options: [opt("cancel")] }),
    );
    const isolated = assessRecovery(
      step({ risk: "low", verifiable: false, options: [opt("isolate")] }),
    );
    if (!cancelOnly.ok || !isolated.ok) throw new Error("unreachable");
    expect(cancelOnly.data.safe).toBe(false);
    expect(isolated.data.safe).toBe(true);
  });
});

/**
 * The worst case: an irreversible act. It is only safe if it was run against a
 * copy AND has a restore point. Straight-to-real-state is refused however
 * strong the nominal recovery looks.
 */
describe("irreversible steps demand isolate + restore", () => {
  it("refuses an irreversible step that only has undo", () => {
    // undo is the strongest ordinary recovery, but for irreversible it isn't
    // enough on its own — the act must have been isolated first.
    const r = assessRecovery(step({ risk: "irreversible", options: [opt("undo")] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safe).toBe(false);
    expect(r.data.reason).toMatch(/only run it against a copy first/i);
  });

  it("clears an irreversible step that was isolated and has a restore point", () => {
    const r = assessRecovery(
      step({ risk: "irreversible", options: [opt("isolate"), opt("restore")] }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safe).toBe(true);
  });

  it("refuses an irreversible step isolated but with no restore", () => {
    const r = assessRecovery(step({ risk: "irreversible", options: [opt("isolate")] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.safe).toBe(false);
  });
});

describe("a task is runnable only if every step can be walked back", () => {
  it("clears a task whose steps are all recoverable", () => {
    const r = assessTaskRecovery([
      step({ risk: "read", options: [] }),
      step({ risk: "low", options: [opt("cancel")] }),
      step({ risk: "high", options: [opt("restore")] }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.task!.runnable).toBe(true);
    expect(r.task!.headline).toMatch(/All 3 steps have a recovery path/);
  });

  it("blocks the whole task when one step can't be recovered", () => {
    const r = assessTaskRecovery([
      step({ risk: "low", options: [opt("cancel")] }),
      step({ intent: "Overwrite production config", risk: "high", options: [opt("cancel")] }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.task!.runnable).toBe(false);
    expect(r.task!.unsafe).toHaveLength(1);
    expect(r.task!.headline).toMatch(/won't start a task it can't safely abandon partway/i);
  });

  it("refuses an empty task", () => {
    expect(assessTaskRecovery([]).ok).toBe(false);
  });
});
