/**
 * HWE-10 — headless accessibility-tree simulator.
 *
 * SIMULATED. THIS IS NOT APPLICATION SUPPORT.
 * ==========================================
 * Nothing here touches a real application, a real accessibility API, or a real
 * operating system. It replays a scripted tree so the governed control path can
 * be exercised — route selection, permission, cancellation, emergency stop,
 * postcondition verification, recovery — without a licensed application or a
 * built native companion.
 *
 * Every receipt it produces is stamped `simulated: true` and every evidence
 * line is prefixed `SIMULATED:`. A requirement may reach SIMULATED RUNTIME
 * VERIFIED on this; none may reach REAL TARGET RUNTIME VERIFIED, and the
 * `assertNotRealEvidence` guard exists so a future caller cannot quietly
 * relabel it.
 *
 * What makes it worth having is that it is ADVERSARIAL. A simulator that only
 * replays the happy path proves that the happy path compiles. These scripts
 * reproduce the failures that actually break desktop automation: a node that
 * has gone stale, a control renamed between versions, two controls sharing a
 * label, focus stolen mid-action, a modal appearing over the target, and the
 * application exiting underneath a running step.
 */
import type {
  ActionRoute,
  EyeObservation,
  HandExecution,
  OcadeActionRequest,
  VerificationStep,
} from "../control/control-plane";
import type { RawPerceptionElement, ScreenRect } from "../control/perception";

/** Marker every piece of simulated evidence carries. */
export const SIMULATED_PREFIX = "SIMULATED:";

export type A11yRole =
  | "window"
  | "dialog"
  | "button"
  | "textbox"
  | "checkbox"
  | "menu"
  | "menuitem"
  | "list"
  | "listitem"
  | "tab"
  | "static";

export interface A11yNode {
  id: string;
  role: A11yRole;
  name: string;
  parentId?: string;
  bounds: ScreenRect;
  enabled: boolean;
  visible: boolean;
  focused: boolean;
  /** A modal blocks interaction with everything outside its subtree. */
  modal?: boolean;
  /** Set when the node has been destroyed — targeting it must be refused. */
  stale?: boolean;
  /** Value for textbox/checkbox, used by postcondition checks. */
  value?: string | boolean;
  protected?: boolean;
}

export interface A11yWindow {
  windowId: string;
  appId: string;
  /** Drift between versions is a first-class scenario, not an edge case. */
  appVersion: string;
  title: string;
  nodes: A11yNode[];
}

/** A scripted disturbance applied before a step executes. */
export type Disturbance =
  | { kind: "none" }
  | { kind: "focus_theft"; toNodeId: string }
  | { kind: "modal_appears"; dialog: A11yNode }
  | { kind: "node_goes_stale"; nodeId: string }
  | { kind: "control_renamed"; nodeId: string; newName: string }
  | { kind: "control_disabled"; nodeId: string }
  | { kind: "layout_shift"; nodeId: string; bounds: ScreenRect }
  | { kind: "version_drift"; newVersion: string }
  | { kind: "app_interrupted" };

export interface SimulatorScript {
  /** Applied in order, one per executed step. Exhausted entries mean "none". */
  disturbances: Disturbance[];
}

export type SimFailure =
  | "stale_target"
  | "target_not_found"
  | "ambiguous_target"
  | "disabled_target"
  | "modal_blocked"
  | "focus_lost"
  | "app_gone"
  | "permission_denied"
  | "cancelled"
  | "halted"
  | "unsupported_route";

export interface SimReceipt {
  /** Always true. A real receipt must never be produced by this module. */
  simulated: true;
  route: ActionRoute;
  nodeId: string | null;
  evidence: string[];
  failure?: SimFailure;
}

const nowIso = () => new Date().toISOString();
const ev = (line: string) => `${SIMULATED_PREFIX} ${line}`;

/**
 * Routes this simulator can honestly serve.
 *
 * It models an ACCESSIBILITY tree, so it may serve `accessibility` and the
 * coordinate routes that a real system would only reach after accessibility
 * failed. It must NOT pretend to be an API, plug-in, CLI or file route: those
 * would be different mechanisms entirely, and claiming them would make route
 * selection look better tested than it is.
 */
export const SIMULATED_ROUTES: readonly ActionRoute[] = ["accessibility", "vision", "input"];

export class EmergencyStop {
  private halted = false;
  get isHalted(): boolean {
    return this.halted;
  }
  halt(): void {
    this.halted = true;
  }
  /** Clearing a stop is deliberate and separate — a stop never times out. */
  clear(): void {
    this.halted = false;
  }
}

export interface SimulatorOptions {
  /** Permission scopes the caller actually holds. */
  grantedPermissions?: ReadonlySet<string>;
  emergencyStop?: EmergencyStop;
  script?: SimulatorScript;
}

/**
 * A deterministic, scripted accessibility tree.
 *
 * Deterministic on purpose: an adversarial simulator that varied run to run
 * would produce evidence nobody could reproduce, which is worth less than no
 * evidence at all.
 */
export class AccessibilityTreeSimulator {
  private windows: A11yWindow[];
  private readonly script: Disturbance[];
  private stepIndex = 0;
  private appGone = false;
  private readonly granted: ReadonlySet<string>;
  private readonly stop: EmergencyStop;
  readonly journal: string[] = [];

  constructor(windows: A11yWindow[], opts: SimulatorOptions = {}) {
    this.windows = windows.map((w) => ({ ...w, nodes: w.nodes.map((n) => ({ ...n })) }));
    this.script = opts.script?.disturbances ?? [];
    this.granted = opts.grantedPermissions ?? new Set<string>();
    this.stop = opts.emergencyStop ?? new EmergencyStop();
  }

  get emergencyStop(): EmergencyStop {
    return this.stop;
  }

  /** Current windows, as the caller would see them. */
  snapshot(): A11yWindow[] {
    return this.windows.map((w) => ({ ...w, nodes: w.nodes.map((n) => ({ ...n })) }));
  }

  private find(nodeId: string): { win: A11yWindow; node: A11yNode } | null {
    for (const win of this.windows) {
      const node = win.nodes.find((n) => n.id === nodeId);
      if (node) return { win, node };
    }
    return null;
  }

  /** Nodes matching a name, used to detect duplicate labels. */
  private byName(name: string): A11yNode[] {
    return this.windows.flatMap((w) => w.nodes.filter((n) => n.name === name && !n.stale));
  }

  /** Apply the next scripted disturbance. Called once per executed step. */
  private applyNextDisturbance(): Disturbance {
    const d = this.script[this.stepIndex] ?? { kind: "none" as const };
    this.stepIndex += 1;
    switch (d.kind) {
      case "focus_theft": {
        for (const w of this.windows) for (const n of w.nodes) n.focused = false;
        const t = this.find(d.toNodeId);
        if (t) t.node.focused = true;
        this.journal.push(ev(`focus stolen by ${d.toNodeId}`));
        break;
      }
      case "modal_appears": {
        const w = this.windows[0];
        if (w) w.nodes.push({ ...d.dialog, modal: true });
        this.journal.push(ev(`modal ${d.dialog.id} appeared`));
        break;
      }
      case "node_goes_stale": {
        const t = this.find(d.nodeId);
        if (t) t.node.stale = true;
        this.journal.push(ev(`node ${d.nodeId} went stale`));
        break;
      }
      case "control_renamed": {
        const t = this.find(d.nodeId);
        if (t) t.node.name = d.newName;
        this.journal.push(ev(`node ${d.nodeId} renamed to "${d.newName}"`));
        break;
      }
      case "control_disabled": {
        const t = this.find(d.nodeId);
        if (t) t.node.enabled = false;
        this.journal.push(ev(`node ${d.nodeId} disabled`));
        break;
      }
      case "layout_shift": {
        const t = this.find(d.nodeId);
        if (t) t.node.bounds = d.bounds;
        this.journal.push(ev(`node ${d.nodeId} moved`));
        break;
      }
      case "version_drift": {
        for (const w of this.windows) w.appVersion = d.newVersion;
        this.journal.push(ev(`application version drifted to ${d.newVersion}`));
        break;
      }
      case "app_interrupted": {
        this.appGone = true;
        this.journal.push(ev("application exited during the step"));
        break;
      }
      case "none":
      default:
        break;
    }
    return d;
  }

  /**
   * Is an active modal blocking this node?
   *
   * A modal blocks everything outside its own subtree. Clicking through one is
   * exactly the class of bug that makes automation destructive, so it is a
   * refusal rather than a warning.
   */
  private modalBlocking(nodeId: string): A11yNode | null {
    for (const w of this.windows) {
      const modal = w.nodes.find((n) => n.modal && !n.stale && n.visible);
      if (!modal) continue;
      // In-subtree means allowed. Walk parents up to the modal.
      let cur = w.nodes.find((n) => n.id === nodeId);
      while (cur) {
        if (cur.id === modal.id) return null;
        cur = cur.parentId ? w.nodes.find((n) => n.id === cur!.parentId) : undefined;
      }
      return modal;
    }
    return null;
  }

  /** Export the tree in the shape the perception fuser already consumes. */
  toPerceptionElements(): RawPerceptionElement[] {
    const out: RawPerceptionElement[] = [];
    for (const w of this.windows) {
      for (const n of w.nodes) {
        if (n.stale) continue;
        out.push({
          source: "accessibility",
          sourceId: n.id,
          parentId: n.parentId,
          role: n.role,
          name: n.name,
          bounds: n.bounds,
          // Accessibility APIs report logical, DPI-independent window
          // coordinates. Declaring "screen physical" would invite a caller to
          // click raw pixels on a scaled display and miss the target.
          coordinateSpace: "window_logical",
          // A simulated tree is internally consistent, so confidence is high —
          // but it is simulated confidence, and the receipt says so.
          confidence: 0.99,
          interactive: n.role !== "static" && n.role !== "window",
          enabled: n.enabled,
          visible: n.visible,
          focused: n.focused,
          protected: n.protected,
        });
      }
    }
    return out;
  }

  /**
   * The `HandExecutor` this simulator provides.
   *
   * Order of refusal matters and is deliberate: emergency stop, then
   * cancellation, then permission, then route support, then target state. A
   * halted system must not evaluate permissions, and an unpermitted caller
   * must never learn whether a target exists.
   */
  readonly executor = async (
    request: OcadeActionRequest,
    signal: AbortSignal,
  ): Promise<HandExecution> => {
    const startedAt = nowIso();
    const evidence: string[] = [];
    const finish = (out: SimReceipt): HandExecution => ({
      executorId: "hwe10-a11y-simulator",
      route: request.route,
      startedAt,
      finishedAt: nowIso(),
      evidence: [...evidence, ...out.evidence],
      output: out,
    });

    if (this.stop.isHalted) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: null,
        failure: "halted",
        evidence: [ev("refused: emergency stop is engaged")],
      });
    }
    if (signal.aborted) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: null,
        failure: "cancelled",
        evidence: [ev("refused: cancelled before execution")],
      });
    }
    if (!this.granted.has(request.requiredPermission)) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: null,
        failure: "permission_denied",
        evidence: [ev(`refused: permission "${request.requiredPermission}" not granted`)],
      });
    }
    if (!SIMULATED_ROUTES.includes(request.route)) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: null,
        failure: "unsupported_route",
        evidence: [
          ev(
            `refused: this simulator models an accessibility tree and cannot honestly serve the "${request.route}" route`,
          ),
        ],
      });
    }

    const disturbance = this.applyNextDisturbance();
    evidence.push(ev(`disturbance applied: ${disturbance.kind}`));

    if (this.appGone) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: null,
        failure: "app_gone",
        evidence: [ev("refused: the application exited during the step")],
      });
    }

    // Targeting: by explicit node id, or by name (which may be ambiguous).
    const targetId = request.arguments.nodeId;
    const targetName = request.arguments.name;
    let node: A11yNode | null = null;

    if (typeof targetId === "string") {
      const hit = this.find(targetId);
      if (!hit) {
        return finish({
          simulated: true,
          route: request.route,
          nodeId: targetId,
          failure: "target_not_found",
          evidence: [ev(`refused: no node "${targetId}"`)],
        });
      }
      if (hit.node.stale) {
        return finish({
          simulated: true,
          route: request.route,
          nodeId: targetId,
          failure: "stale_target",
          evidence: [ev(`refused: node "${targetId}" is stale and must be re-resolved`)],
        });
      }
      node = hit.node;
    } else if (typeof targetName === "string") {
      const matches = this.byName(targetName);
      if (matches.length === 0) {
        return finish({
          simulated: true,
          route: request.route,
          nodeId: null,
          failure: "target_not_found",
          evidence: [
            ev(
              `refused: no control named "${targetName}" — it may have been renamed by a version change`,
            ),
          ],
        });
      }
      if (matches.length > 1) {
        // Picking one of several identically-labelled controls is a guess, and
        // a guess that clicks something is not an acceptable failure mode.
        return finish({
          simulated: true,
          route: request.route,
          nodeId: null,
          failure: "ambiguous_target",
          evidence: [
            ev(
              `refused: ${matches.length} controls are named "${targetName}" (${matches.map((m) => m.id).join(", ")}) — refusing to guess`,
            ),
          ],
        });
      }
      node = matches[0];
    } else {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: null,
        failure: "target_not_found",
        evidence: [ev("refused: the request named no target")],
      });
    }

    const blocking = this.modalBlocking(node.id);
    if (blocking) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: node.id,
        failure: "modal_blocked",
        evidence: [ev(`refused: modal "${blocking.name}" is blocking "${node.name}"`)],
      });
    }
    if (!node.enabled) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: node.id,
        failure: "disabled_target",
        evidence: [ev(`refused: "${node.name}" is disabled`)],
      });
    }
    if (!node.visible) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: node.id,
        failure: "target_not_found",
        evidence: [ev(`refused: "${node.name}" is not visible`)],
      });
    }

    // Typing into a control that no longer has focus would send keystrokes to
    // whatever stole it. Refuse rather than type somewhere unknown.
    if (request.capability === "type" && !node.focused) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: node.id,
        failure: "focus_lost",
        evidence: [ev(`refused: "${node.name}" does not have focus; keystrokes would go elsewhere`)],
      });
    }

    if (signal.aborted) {
      return finish({
        simulated: true,
        route: request.route,
        nodeId: node.id,
        failure: "cancelled",
        evidence: [ev("cancelled mid-step; no mutation applied")],
      });
    }

    // Apply the effect.
    switch (request.capability) {
      case "click": {
        if (node.role === "checkbox") node.value = !(node.value === true);
        for (const w of this.windows) for (const n of w.nodes) n.focused = false;
        node.focused = true;
        evidence.push(ev(`clicked "${node.name}"`));
        break;
      }
      case "type": {
        const text = String(request.arguments.text ?? "");
        node.value = text;
        evidence.push(ev(`typed ${text.length} characters into "${node.name}"`));
        break;
      }
      case "focus": {
        for (const w of this.windows) for (const n of w.nodes) n.focused = false;
        node.focused = true;
        evidence.push(ev(`focused "${node.name}"`));
        break;
      }
      case "read": {
        evidence.push(ev(`read "${node.name}" = ${JSON.stringify(node.value ?? null)}`));
        break;
      }
      default:
        return finish({
          simulated: true,
          route: request.route,
          nodeId: node.id,
          failure: "unsupported_route",
          evidence: [ev(`refused: capability "${request.capability}" is not simulated`)],
        });
    }

    this.journal.push(ev(`${request.capability} on ${node.id}`));
    return finish({ simulated: true, route: request.route, nodeId: node.id, evidence: [] });
  };

  /**
   * The `EyeObserver` this simulator provides.
   *
   * Reads the tree INDEPENDENTLY of what the executor claimed. That separation
   * is the point: verification that trusts the executor's own report verifies
   * nothing.
   */
  readonly observer = async (
    request: OcadeActionRequest,
    step: VerificationStep,
    signal: AbortSignal,
  ): Promise<EyeObservation[]> => {
    if (signal.aborted) return [];
    const out: EyeObservation[] = [];
    for (const id of step.postconditionIds) {
      const post = request.expectedPostconditions.find((p) => p.id === id);
      if (!post) continue;
      const hit = this.find(post.selector);
      const value = hit && !hit.node.stale ? this.readSelector(hit.node, post.kind) : null;
      out.push({
        observerId: "hwe10-a11y-simulator-eye",
        route: "accessibility",
        postconditionId: id,
        value,
        observedAt: nowIso(),
        evidence: ev(
          `observed ${post.kind} of "${post.selector}" = ${JSON.stringify(value)} (simulated tree read, not a real application)`,
        ),
        redacted: Boolean(hit?.node.protected),
      });
    }
    return out;
  };

  private readSelector(node: A11yNode, kind: string): unknown {
    switch (kind) {
      case "value":
        return node.value ?? null;
      case "focused":
        return node.focused;
      case "enabled":
        return node.enabled;
      case "name":
        return node.name;
      case "exists":
        return true;
      default:
        return null;
    }
  }

  /** Recovery: re-resolve a stale target by name, honestly reporting failure. */
  recoverTarget(name: string): { ok: true; nodeId: string } | { ok: false; reason: string } {
    const matches = this.byName(name);
    if (matches.length === 1) return { ok: true, nodeId: matches[0].id };
    if (matches.length === 0)
      return { ok: false, reason: `No control named "${name}" exists after the change.` };
    return {
      ok: false,
      reason: `${matches.length} controls are named "${name}"; recovery will not guess between them.`,
    };
  }
}

/**
 * Guard against a simulated receipt ever being filed as real evidence.
 *
 * Cheap, and it closes the exact hole the audit was written to catch: a twin
 * or fixture quietly promoted to REAL TARGET RUNTIME VERIFIED.
 */
export function assertNotRealEvidence(receipt: { simulated?: boolean }, tier: string): void {
  if (receipt.simulated && /real[ _-]?target/i.test(tier)) {
    throw new Error(
      "Refusing to record simulated output as real-target runtime evidence. A simulator cannot prove real application support.",
    );
  }
}
