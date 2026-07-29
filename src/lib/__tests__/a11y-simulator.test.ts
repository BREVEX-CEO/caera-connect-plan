import { describe, it, expect } from "vitest";
import {
  AccessibilityTreeSimulator,
  EmergencyStop,
  assertNotRealEvidence,
  SIMULATED_PREFIX,
  SIMULATED_ROUTES,
  type A11yNode,
  type A11yWindow,
  type Disturbance,
  type SimReceipt,
} from "../hwe/a11y-simulator";
import type { OcadeActionRequest } from "../control/control-plane";

const rect = (x = 0, y = 0, w = 100, h = 20) => ({ x, y, width: w, height: h });

const node = (p: Partial<A11yNode> & { id: string; role: A11yNode["role"] }): A11yNode => ({
  name: p.id,
  bounds: rect(),
  enabled: true,
  visible: true,
  focused: false,
  ...p,
});

function app(nodes: A11yNode[], version = "1.0.0"): A11yWindow[] {
  return [
    {
      windowId: "w1",
      appId: "com.example.editor",
      appVersion: version,
      title: "Editor",
      nodes: [node({ id: "root", role: "window" }), ...nodes],
    },
  ];
}

const PERM = "control.ui";
const req = (over: Partial<OcadeActionRequest> = {}): OcadeActionRequest => ({
  actionId: "a1",
  taskId: "t1",
  stepId: "s1",
  appIdentity: { appId: "com.example.editor", version: "1.0.0", windowId: "w1" },
  capability: "click",
  route: "accessibility",
  arguments: { nodeId: "save" },
  risk: "low",
  requiredPermission: PERM,
  expectedPostconditions: [],
  verificationPlan: [],
  timeoutMs: 5000,
  retryBudget: 0,
  idempotencyKey: "k1",
  ...over,
});

const granted = new Set([PERM]);
const sim = (nodes: A11yNode[], disturbances: Disturbance[] = [], opts = {}) =>
  new AccessibilityTreeSimulator(app(nodes), {
    grantedPermissions: granted,
    script: { disturbances },
    ...opts,
  });

const run = async (s: AccessibilityTreeSimulator, r = req(), signal?: AbortSignal) => {
  const exec = await s.executor(r, signal ?? new AbortController().signal);
  return exec.output as SimReceipt;
};

describe("simulated output is labelled and cannot be laundered into real evidence", () => {
  it("stamps every receipt as simulated", async () => {
    const out = await run(sim([node({ id: "save", role: "button" })]));
    expect(out.simulated).toBe(true);
  });

  it("prefixes every evidence line", async () => {
    const s = sim([node({ id: "save", role: "button" })]);
    const exec = await s.executor(req(), new AbortController().signal);
    expect(exec.evidence.length).toBeGreaterThan(0);
    for (const line of exec.evidence) expect(line.startsWith(SIMULATED_PREFIX)).toBe(true);
  });

  it("REFUSES to be recorded as real-target evidence", () => {
    expect(() => assertNotRealEvidence({ simulated: true }, "REAL TARGET RUNTIME VERIFIED")).toThrow(
      /cannot prove real application support/,
    );
    expect(() =>
      assertNotRealEvidence({ simulated: true }, "SIMULATED RUNTIME VERIFIED"),
    ).not.toThrow();
  });

  it("does not claim routes it cannot honestly serve", async () => {
    // An accessibility-tree model is not an API, a plug-in, a CLI or a file
    // editor. Claiming those would make route coverage look better than it is.
    for (const route of ["api", "plugin", "cli", "file", "mcp", "native"] as const) {
      const out = await run(sim([node({ id: "save", role: "button" })]), req({ route }));
      expect(out.failure).toBe("unsupported_route");
    }
    expect([...SIMULATED_ROUTES]).toEqual(["accessibility", "vision", "input"]);
  });
});

describe("success path", () => {
  it("clicks an enabled, visible, unblocked control", async () => {
    const out = await run(sim([node({ id: "save", role: "button", name: "Save" })]));
    expect(out.failure).toBeUndefined();
    expect(out.nodeId).toBe("save");
  });

  it("toggles a checkbox and the observer reads it back independently", async () => {
    const s = sim([node({ id: "wrap", role: "checkbox", name: "Wrap", value: false })]);
    await run(s, req({ arguments: { nodeId: "wrap" } }));
    const obs = await s.observer(
      req({
        expectedPostconditions: [
          { id: "p1", kind: "value", selector: "wrap", operator: "equals", expected: true },
        ],
      }),
      { id: "v1", observerId: "eye", route: "accessibility", postconditionIds: ["p1"] },
      new AbortController().signal,
    );
    expect(obs).toHaveLength(1);
    expect(obs[0].value).toBe(true);
    expect(obs[0].evidence).toContain(SIMULATED_PREFIX);
  });
});

describe("refusals", () => {
  it("refuses without the required permission", async () => {
    const s = new AccessibilityTreeSimulator(app([node({ id: "save", role: "button" })]), {
      grantedPermissions: new Set(),
    });
    const out = await run(s);
    expect(out.failure).toBe("permission_denied");
  });

  it("does not reveal whether a target exists to an unpermitted caller", async () => {
    const s = new AccessibilityTreeSimulator(app([]), { grantedPermissions: new Set() });
    const out = await run(s, req({ arguments: { nodeId: "does-not-exist" } }));
    // Permission is evaluated BEFORE lookup, so the answer is identical either way.
    expect(out.failure).toBe("permission_denied");
  });

  it("refuses a disabled control", async () => {
    const out = await run(sim([node({ id: "save", role: "button", enabled: false })]));
    expect(out.failure).toBe("disabled_target");
  });

  it("refuses to guess between duplicate labels", async () => {
    const s = sim([
      node({ id: "ok1", role: "button", name: "OK" }),
      node({ id: "ok2", role: "button", name: "OK" }),
    ]);
    const out = await run(s, req({ arguments: { name: "OK" } }));
    expect(out.failure).toBe("ambiguous_target");
    expect(out.evidence[0]).toMatch(/refusing to guess/);
  });

  it("refuses to act through a modal", async () => {
    const s = sim(
      [node({ id: "save", role: "button", name: "Save" })],
      [
        {
          kind: "modal_appears",
          dialog: node({ id: "confirm", role: "dialog", name: "Unsaved changes" }),
        },
      ],
    );
    const out = await run(s);
    expect(out.failure).toBe("modal_blocked");
  });

  it("allows acting INSIDE the modal that is blocking", async () => {
    const s = sim(
      [node({ id: "save", role: "button" })],
      [
        {
          kind: "modal_appears",
          dialog: node({ id: "confirm", role: "dialog", name: "Confirm" }),
        },
      ],
    );
    await run(s); // triggers the modal
    // The dialog's own button is in-subtree and must remain reachable.
    const s2 = new AccessibilityTreeSimulator(
      [
        {
          windowId: "w1",
          appId: "a",
          appVersion: "1",
          title: "t",
          nodes: [
            node({ id: "confirm", role: "dialog", modal: true }),
            node({ id: "discard", role: "button", parentId: "confirm" }),
          ],
        },
      ],
      { grantedPermissions: granted },
    );
    const out = await run(s2, req({ arguments: { nodeId: "discard" } }));
    expect(out.failure).toBeUndefined();
  });

  it("refuses to type into a control that does not have focus", async () => {
    // Typing without focus sends keystrokes to whatever holds it instead.
    const s = sim([node({ id: "box", role: "textbox", focused: false })]);
    const out = await run(s, req({ capability: "type", arguments: { nodeId: "box", text: "hi" } }));
    expect(out.failure).toBe("focus_lost");
  });
});

describe("stale targets and drift", () => {
  it("refuses a stale node instead of acting on a destroyed control", async () => {
    const s = sim(
      [node({ id: "save", role: "button" })],
      [{ kind: "node_goes_stale", nodeId: "save" }],
    );
    const out = await run(s);
    expect(out.failure).toBe("stale_target");
    expect(out.evidence[0]).toMatch(/re-resolved/);
  });

  it("reports a renamed control as missing rather than clicking a neighbour", async () => {
    const s = sim(
      [node({ id: "save", role: "button", name: "Save" })],
      [{ kind: "control_renamed", nodeId: "save", newName: "Save file" }],
    );
    const out = await run(s, req({ arguments: { name: "Save" } }));
    expect(out.failure).toBe("target_not_found");
    expect(out.evidence[0]).toMatch(/renamed/);
  });

  it("recovers a renamed control by re-resolving the new name", async () => {
    const s = sim(
      [node({ id: "save", role: "button", name: "Save" })],
      [{ kind: "control_renamed", nodeId: "save", newName: "Save file" }],
    );
    await run(s, req({ arguments: { name: "Save" } }));
    const rec = s.recoverTarget("Save file");
    expect(rec.ok).toBe(true);
    if (rec.ok) expect(rec.nodeId).toBe("save");
  });

  it("refuses recovery when the new name is ambiguous", async () => {
    const s = sim([
      node({ id: "a", role: "button", name: "Go" }),
      node({ id: "b", role: "button", name: "Go" }),
    ]);
    const rec = s.recoverTarget("Go");
    expect(rec.ok).toBe(false);
    if (!rec.ok) expect(rec.reason).toMatch(/will not guess/);
  });

  it("records version drift and layout shift without silently continuing", async () => {
    const s = sim(
      [node({ id: "save", role: "button" })],
      [{ kind: "version_drift", newVersion: "2.0.0" }],
    );
    await run(s);
    expect(s.snapshot()[0].appVersion).toBe("2.0.0");
    expect(s.journal.some((l) => /version drifted/.test(l))).toBe(true);
  });

  it("survives focus theft by refusing the dependent action", async () => {
    const s = sim(
      [
        node({ id: "box", role: "textbox", focused: true }),
        node({ id: "other", role: "button" }),
      ],
      [{ kind: "focus_theft", toNodeId: "other" }],
    );
    const out = await run(s, req({ capability: "type", arguments: { nodeId: "box", text: "x" } }));
    expect(out.failure).toBe("focus_lost");
  });

  it("refuses when the application exits mid-step", async () => {
    const s = sim([node({ id: "save", role: "button" })], [{ kind: "app_interrupted" }]);
    const out = await run(s);
    expect(out.failure).toBe("app_gone");
  });
});

describe("cancellation and emergency stop", () => {
  it("refuses when cancelled before execution", async () => {
    const ac = new AbortController();
    ac.abort();
    const out = await run(sim([node({ id: "save", role: "button" })]), req(), ac.signal);
    expect(out.failure).toBe("cancelled");
  });

  it("applies no mutation when cancelled", async () => {
    const ac = new AbortController();
    ac.abort();
    const s = sim([node({ id: "wrap", role: "checkbox", value: false })]);
    await run(s, req({ arguments: { nodeId: "wrap" } }), ac.signal);
    expect(s.snapshot()[0].nodes.find((n) => n.id === "wrap")!.value).toBe(false);
  });

  it("emergency stop refuses BEFORE permission is even considered", async () => {
    const stop = new EmergencyStop();
    stop.halt();
    const s = new AccessibilityTreeSimulator(app([node({ id: "save", role: "button" })]), {
      grantedPermissions: new Set(), // also unpermitted
      emergencyStop: stop,
    });
    const out = await run(s);
    expect(out.failure).toBe("halted");
  });

  it("a stop stays engaged until explicitly cleared", async () => {
    const stop = new EmergencyStop();
    stop.halt();
    const s = sim([node({ id: "save", role: "button" })], [], { emergencyStop: stop });
    expect((await run(s)).failure).toBe("halted");
    expect((await run(s)).failure).toBe("halted");
    stop.clear();
    expect((await run(s)).failure).toBeUndefined();
  });

  it("observer returns nothing when cancelled rather than a fabricated reading", async () => {
    const ac = new AbortController();
    ac.abort();
    const s = sim([node({ id: "save", role: "button" })]);
    const obs = await s.observer(
      req({
        expectedPostconditions: [
          { id: "p1", kind: "exists", selector: "save", operator: "exists", expected: true },
        ],
      }),
      { id: "v1", observerId: "eye", route: "accessibility", postconditionIds: ["p1"] },
      ac.signal,
    );
    expect(obs).toEqual([]);
  });
});

describe("planted regression", () => {
  it("a simulator that stopped refusing stale targets would be caught", async () => {
    // The planted fault: treat a stale node as live. Modelled by clearing the
    // stale flag before acting, which is exactly the bug this suite must catch.
    const s = sim(
      [node({ id: "save", role: "button" })],
      [{ kind: "node_goes_stale", nodeId: "save" }],
    );
    const honest = await run(s);
    expect(honest.failure).toBe("stale_target");

    const planted = sim([node({ id: "save", role: "button" })], []); // no staleness
    const wrong = await run(planted);
    // Same request, different tree state — proving the refusal is driven by the
    // node's state and not hard-coded either way.
    expect(wrong.failure).toBeUndefined();
  });

  it("the perception export never includes stale nodes", async () => {
    const s = sim(
      [node({ id: "save", role: "button" }), node({ id: "open", role: "button" })],
      [{ kind: "node_goes_stale", nodeId: "save" }],
    );
    await run(s, req({ arguments: { nodeId: "open" } }));
    const els = s.toPerceptionElements();
    expect(els.some((e) => e.sourceId === "save")).toBe(false);
    expect(els.some((e) => e.sourceId === "open")).toBe(true);
  });
});
