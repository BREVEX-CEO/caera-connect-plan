import { useCallback, useState } from "react";
import {
  AccessibilityTreeSimulator,
  EmergencyStop,
  SIMULATED_PREFIX,
  type Disturbance,
  type SimReceipt,
} from "@/lib/hwe/a11y-simulator";
import type { ActionRoute, OcadeActionRequest } from "@/lib/control/control-plane";
import { buildTwinLab, TWIN_PREFIX, type TwinKind, type TwinReceipt } from "@/lib/hwe/twin-lab";
import {
  runPcTransaction,
  isDestructive,
  requiresCage,
  type CoordinateCage,
  type TransactionReceipt,
} from "@/lib/control/pc-transaction";

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

      <TwinLabBench />
      <TransactionBench />
    </section>
  );
}

/**
 * P10 bench — the governed transaction, end to end.
 *
 * Runs the real `runPcTransaction` against the P07 simulator's executor, so
 * every stage shown here actually ran: emergency stop, cancellation,
 * permission, expiry, destructive confirmation, coordinate cage, preview,
 * backup, execute, verify, rollback.
 *
 * The defaults are deliberately unsafe-looking and therefore refuse. A bench
 * that only demonstrates the success path would teach nothing about the part
 * that matters — a click outside the approved window, or a delete nobody
 * confirmed, must not proceed.
 */
function TransactionBench() {
  const [capability, setCapability] = useState("click");
  const [route, setRoute] = useState<ActionRoute>("accessibility");
  const [confirmed, setConfirmed] = useState(false);
  const [insideCage, setInsideCage] = useState(true);
  const [expired, setExpired] = useState(false);
  const [halted, setHalted] = useState(false);
  const [failExecution, setFailExecution] = useState(false);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);

  const run = useCallback(async () => {
    const cage: CoordinateCage = { bounds: { x: 0, y: 0, width: 200, height: 200 }, scale: 1 };
    const request: OcadeActionRequest = {
      ...request0(capability, route),
      rollbackPlan: [
        { id: "undo-1", kind: "undo", description: "Undo the change", ready: true },
      ],
      risk: isDestructive(capability) ? "high" : "low",
    };

    const out = await runPcTransaction({
      request,
      grants: new Set([PERMISSION]),
      grantExpiresAt: new Date(Date.now() + (expired ? -60_000 : 60_000)).toISOString(),
      confirmed,
      cage,
      point: { x: insideCage ? 50 : 5_000, y: 50, scale: 1 },
      isHalted: () => halted,
      backup: {
        create: async () => ({ token: "sim-backup" }),
        verify: async () => true,
        restore: async () => true,
      },
      recover: async () => true,
      preview: async () => ({ ok: true, detail: "Dry run produced no unexpected changes." }),
      execute: async (r) =>
        failExecution
          ? ({ status: "failed", request: r, reason: "Simulated executor failure." } as never)
          : ({
              status: "verified",
              request: r,
              receipt: {
                verified: true,
                evidence: [],
                observations: [],
                missingPostconditions: [],
                mismatchedPostconditions: [],
              },
            } as never),
    });
    setReceipt(out);
  }, [capability, route, confirmed, insideCage, expired, halted, failExecution]);

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">Governed transaction bench</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Every stage below actually runs. Deterministic validators own each decision — a model can
            propose an action, never approve, cage, confirm or execute one.
          </p>
        </div>
        <span className="shrink-0 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Simulated
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={capability}
          onChange={(e) => setCapability(e.target.value)}
          aria-label="Capability"
        >
          {["click", "type", "delete", "uninstall", "kill_process"].map((c) => (
            <option key={c} value={c}>
              {c}
              {isDestructive(c) ? " (destructive)" : ""}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={route}
          onChange={(e) => setRoute(e.target.value as ActionRoute)}
          aria-label="Route"
        >
          {(["api", "accessibility", "vision", "input"] as ActionRoute[]).map((r) => (
            <option key={r} value={r}>
              {r}
              {requiresCage(r) ? " (caged)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
          onClick={() => void run()}
        >
          Run transaction
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {(
          [
            ["Confirmed", confirmed, setConfirmed],
            ["Point inside cage", insideCage, setInsideCage],
            ["Grant expired", expired, setExpired],
            ["Emergency stop", halted, setHalted],
            ["Force execution failure", failExecution, setFailExecution],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>

      {receipt && (
        <div className="mt-3 rounded border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium">
            {receipt.outcome.replace(/_/g, " ")}
            {receipt.reason ? ` — ${receipt.reason}` : ""}
          </p>
          <ol className="mt-1.5 space-y-0.5">
            {receipt.stages.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {s.ok ? "✓" : "✕"} {s.stage.replace(/_/g, " ")} — {s.detail}
              </li>
            ))}
          </ol>
          {receipt.rollback && (
            <p className="mt-1 text-xs text-muted-foreground">
              Rollback: {receipt.rollback.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function request0(capability: string, route: ActionRoute): OcadeActionRequest {
  return {
    actionId: "bench",
    taskId: "bench",
    stepId: "s1",
    appIdentity: { appId: "com.example.editor", version: "1.0.0", windowId: "w1" },
    capability,
    route,
    arguments: { nodeId: "save", path: "/tmp/example.txt" },
    risk: "low",
    requiredPermission: PERMISSION,
    expectedPostconditions: [],
    verificationPlan: [],
    timeoutMs: 5000,
    retryBudget: 0,
    idempotencyKey: `bench-${capability}-${route}`,
  };
}

/** Adversarial application shapes, and the route each one can honestly serve. */
const TWINS: Array<{ kind: TwinKind; label: string; target: string; blurb: string }> = [
  { kind: "menu", label: "Menu (has an API)", target: "save_item", blurb: "Precise route available." },
  { kind: "form", label: "Form (DOM only)", target: "submit", blurb: "No API; falls to DOM." },
  {
    kind: "virtualised_list",
    label: "Virtualised list",
    target: "row_5000",
    blurb: "Row 5000 has not been scrolled into existence yet.",
  },
  {
    kind: "canvas",
    label: "Canvas (no accessible tree)",
    target: "shape_a",
    blurb: "Only coordinates can reach these shapes.",
  },
  {
    kind: "mixed_dpi",
    label: "Mixed DPI display",
    target: "scaled_button",
    blurb: "Logical pixels on a 2x display miss the target.",
  },
  {
    kind: "inaccessible_controls",
    label: "Custom widget, no identity",
    target: "custom_widget",
    blurb: "Nothing to name; coordinates or nothing.",
  },
];

const ROUTES: ActionRoute[] = ["api", "dom", "accessibility", "vision", "input"];

/**
 * HWE-11 bench.
 *
 * The interesting control here is "allow coordinate fallback". Leaving it off
 * is the safe default and produces refusals on purpose — a coordinate route is
 * blind mouse movement, and consenting to it should be a decision someone
 * makes, not something that happens because a better route was unavailable.
 */
function TwinLabBench() {
  const [twin, setTwin] = useState<TwinKind>("canvas");
  const [route, setRoute] = useState<ActionRoute>("accessibility");
  const [allowCoords, setAllowCoords] = useState(false);
  const [out, setOut] = useState<TwinReceipt | null>(null);

  const chosen = TWINS.find((t) => t.kind === twin)!;

  const run = useCallback(() => {
    const lab = buildTwinLab();
    setOut(
      lab[twin].perform({
        targetId: chosen.target,
        intent: "activate",
        route,
        allowCoordinateFallback: allowCoords,
      }),
    );
  }, [twin, route, allowCoords, chosen.target]);

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">Application twin bench</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Each twin holds ground truth separately from what it displays, and every action is
            checked against that truth rather than against its own report.
          </p>
        </div>
        <span className="shrink-0 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Twin
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={twin}
          onChange={(e) => setTwin(e.target.value as TwinKind)}
          aria-label="Application twin"
        >
          {TWINS.map((t) => (
            <option key={t.kind} value={t.kind}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={route}
          onChange={(e) => setRoute(e.target.value as ActionRoute)}
          aria-label="Requested route"
        >
          {ROUTES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={allowCoords}
            onChange={(e) => setAllowCoords(e.target.checked)}
          />
          Allow coordinate fallback
        </label>
        <button
          type="button"
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
          onClick={run}
        >
          Run
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{chosen.blurb}</p>

      {out && (
        <div className="mt-3 rounded border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium">
            {out.ok ? "Completed" : `Refused — ${out.failure?.replace(/_/g, " ")}`}
            {out.requestedRoute ? ` (asked for ${out.requestedRoute}, used ${out.route})` : ""}
          </p>
          {out.ok && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Verified against ground truth: {String(out.verifiedAgainstGroundTruth)}
            </p>
          )}
          <ul className="mt-1.5 space-y-0.5">
            {out.evidence.map((line, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {line.replace(`${TWIN_PREFIX} `, "")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
