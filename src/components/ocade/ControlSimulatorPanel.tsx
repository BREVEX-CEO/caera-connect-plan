import { useCallback, useState } from "react";
import {
  AccessibilityTreeSimulator,
  EmergencyStop,
  SIMULATED_PREFIX,
  type Disturbance,
  type SimReceipt,
} from "@/lib/hwe/a11y-simulator";
import type { OcadeActionRequest } from "@/lib/control/control-plane";

/**
 * Production owner for the HWE-10 accessibility-tree simulator.
 *
 * Without a reachable entry point the simulator would be a module imported
 * only by tests — precisely the shape this programme's audit counts as
 * unwired, and precisely the shape that lets a "simulator" exist on paper
 * while proving nothing.
 *
 * The panel is a control-path rehearsal bench: pick a failure that actually
 * breaks desktop automation, run the governed path against it, and read the
 * refusal. Everything it shows is labelled SIMULATED, and the label is not
 * decoration — it is the difference between "the refusal logic works" and
 * "OCADE can drive your applications", which are not the same claim.
 */

const SCENARIOS: Array<{ id: string; label: string; blurb: string; disturbance: Disturbance }> = [
  {
    id: "healthy",
    label: "Nothing goes wrong",
    blurb: "Baseline: the control is present, enabled and unblocked.",
    disturbance: { kind: "none" },
  },
  {
    id: "stale",
    label: "Control destroyed mid-action",
    blurb: "The node goes stale between planning and acting.",
    disturbance: { kind: "node_goes_stale", nodeId: "save" },
  },
  {
    id: "renamed",
    label: "Control renamed by an update",
    blurb: "Version drift renames the button OCADE was told to press.",
    disturbance: { kind: "control_renamed", nodeId: "save", newName: "Save file" },
  },
  {
    id: "disabled",
    label: "Control disabled",
    blurb: "The target becomes unavailable before the click lands.",
    disturbance: { kind: "control_disabled", nodeId: "save" },
  },
  {
    id: "modal",
    label: "Modal dialog steals the screen",
    blurb: "A confirmation dialog appears over the target.",
    disturbance: {
      kind: "modal_appears",
      dialog: {
        id: "confirm",
        role: "dialog",
        name: "Unsaved changes",
        bounds: { x: 40, y: 40, width: 200, height: 100 },
        enabled: true,
        visible: true,
        focused: true,
      },
    },
  },
  {
    id: "focus",
    label: "Focus stolen by another window",
    blurb: "Something else takes focus while OCADE is about to type.",
    disturbance: { kind: "focus_theft", toNodeId: "other" },
  },
  {
    id: "gone",
    label: "Application exits mid-step",
    blurb: "The application disappears underneath a running action.",
    disturbance: { kind: "app_interrupted" },
  },
];

const PERMISSION = "control.ui";

function buildTree() {
  const r = (x: number, y: number) => ({ x, y, width: 90, height: 24 });
  return [
    {
      windowId: "w1",
      appId: "com.example.editor",
      appVersion: "1.0.0",
      title: "Example Editor (simulated)",
      nodes: [
        {
          id: "root",
          role: "window" as const,
          name: "Example Editor",
          bounds: r(0, 0),
          enabled: true,
          visible: true,
          focused: false,
        },
        {
          id: "save",
          role: "button" as const,
          name: "Save",
          parentId: "root",
          bounds: r(10, 40),
          enabled: true,
          visible: true,
          focused: true,
        },
        {
          id: "other",
          role: "button" as const,
          name: "Close",
          parentId: "root",
          bounds: r(110, 40),
          enabled: true,
          visible: true,
          focused: false,
        },
      ],
    },
  ];
}

function request(capability: string): OcadeActionRequest {
  return {
    actionId: "sim.rehearsal",
    taskId: "sim",
    stepId: "s1",
    appIdentity: { appId: "com.example.editor", version: "1.0.0", windowId: "w1" },
    capability,
    route: "accessibility",
    arguments: capability === "type" ? { nodeId: "save", text: "hello" } : { nodeId: "save" },
    risk: "low",
    requiredPermission: PERMISSION,
    expectedPostconditions: [],
    verificationPlan: [],
    timeoutMs: 5000,
    retryBudget: 0,
    idempotencyKey: `sim-${capability}`,
  };
}

export function ControlSimulatorPanel() {
  const [scenario, setScenario] = useState(SCENARIOS[1].id);
  const [permit, setPermit] = useState(true);
  const [halted, setHalted] = useState(false);
  const [result, setResult] = useState<{ receipt: SimReceipt; evidence: string[] } | null>(null);

  const rehearse = useCallback(
    async (capability: string, cancelImmediately = false) => {
      const chosen = SCENARIOS.find((s) => s.id === scenario)!;
      const stop = new EmergencyStop();
      if (halted) stop.halt();
      const sim = new AccessibilityTreeSimulator(buildTree(), {
        grantedPermissions: permit ? new Set([PERMISSION]) : new Set(),
        emergencyStop: stop,
        script: { disturbances: [chosen.disturbance] },
      });
      const ac = new AbortController();
      if (cancelImmediately) ac.abort();
      const exec = await sim.executor(request(capability), ac.signal);
      setResult({ receipt: exec.output as SimReceipt, evidence: exec.evidence });
    },
    [scenario, permit, halted],
  );

  const receipt = result?.receipt;

  return (
    <section className="rounded-lg border border-border p-4" data-testid="control-simulator">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Control rehearsal bench</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Runs the governed control path against a scripted accessibility tree. This is a
            simulation: it proves the refusal, cancellation and recovery logic behave, and it proves
            nothing at all about driving real applications on this machine.
          </p>
        </div>
        <span className="shrink-0 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Simulated
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <select
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          aria-label="Failure to rehearse"
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {SCENARIOS.find((s) => s.id === scenario)?.blurb}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={permit} onChange={(e) => setPermit(e.target.checked)} />
            Permission granted
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={halted} onChange={(e) => setHalted(e.target.checked)} />
            Emergency stop engaged
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
            onClick={() => void rehearse("click")}
          >
            Rehearse click
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-xs"
            onClick={() => void rehearse("type")}
          >
            Rehearse typing
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1 text-xs"
            onClick={() => void rehearse("click", true)}
          >
            Rehearse cancelled
          </button>
        </div>
      </div>

      {receipt && (
        <div className="mt-4 rounded border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium">
            {receipt.failure ? `Refused — ${receipt.failure.replace(/_/g, " ")}` : "Completed"}
            {receipt.nodeId ? ` (${receipt.nodeId})` : ""}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {result!.evidence.map((line, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {line.replace(`${SIMULATED_PREFIX} `, "")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
