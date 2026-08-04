/**
 * Universal PC-control transaction engine (P10).
 *
 * `runDirectedAction` already owns validation, authorization expiry, the
 * idempotency journal, bounded retries and independent verification. This does
 * NOT replace it — it wraps it with the four things the control layer had no
 * implementation for at all:
 *
 *   1. COORDINATE SAFETY CAGES. Nothing constrained where a coordinate action
 *      could land. A click is the one action that cannot be un-clicked, so an
 *      unconstrained coordinate is the sharpest edge in the system.
 *   2. BACKUP BEFORE MUTATION, verified by re-reading. A backup nobody proved
 *      readable is a promise, not a safety net.
 *   3. ROLLBACK EXECUTION. `OcadeActionRequest.rollbackPlan` existed on the
 *      type and was never executed by anything, so every "safe rollback"
 *      claim in this repository rested on a field nobody read.
 *   4. DESTRUCTIVE-ACTION CLASSIFICATION with mandatory confirmation and a
 *      recoverable path.
 *
 * THE BOUNDARY THIS MODULE DEFENDS
 * --------------------------------
 * A model may PROPOSE a typed action. It may not execute one, widen its own
 * permission, choose its own coordinates without a cage, skip a preview, or
 * mark its own action non-destructive. Every field a model could influence is
 * re-derived or re-checked here from the request, never trusted as supplied.
 */
import type {
  ActionRoute,
  ControlOutcome,
  OcadeActionRequest,
  RecoveryStep,
  RiskLevel,
} from "./control-plane";
import type { ScreenRect } from "./perception";

/* ------------------------------------------------------------ cages ------ */

export type CageRefusal = "no_cage" | "outside_cage" | "unknown_scale" | "zero_area" | "occluded";

export interface CoordinateCage {
  /** The approved window rectangle, in the SAME space as the point. */
  bounds: ScreenRect;
  /** Device pixel ratio the bounds are expressed in. */
  scale: number;
  /** Regions inside the window that must never be clicked (e.g. protected fields). */
  exclusions?: ScreenRect[];
}

export type CageVerdict =
  | { allowed: true; point: { x: number; y: number }; evidence: string }
  | { allowed: false; refusal: CageRefusal; reason: string };

const inside = (p: { x: number; y: number }, r: ScreenRect) =>
  p.x >= r.x && p.y >= r.y && p.x <= r.x + r.width && p.y <= r.y + r.height;

/**
 * Decide whether a coordinate action may proceed.
 *
 * REFUSES rather than clamps. Clamping a click that landed outside the target
 * window moves it to the window EDGE, which is a different button — silently
 * doing something other than what was asked is worse than doing nothing.
 */
export function checkCoordinate(
  point: { x: number; y: number },
  cage: CoordinateCage | null,
  pointScale: number,
): CageVerdict {
  if (!cage) {
    return {
      allowed: false,
      refusal: "no_cage",
      reason: "No approved window region was supplied, so there is nothing to bound this click to.",
    };
  }
  if (cage.bounds.width <= 0 || cage.bounds.height <= 0) {
    return { allowed: false, refusal: "zero_area", reason: "The approved region has no area." };
  }
  if (!Number.isFinite(pointScale) || !Number.isFinite(cage.scale) || pointScale !== cage.scale) {
    /*
     * A logical-pixel point measured against physical-pixel bounds lands in the
     * wrong place on any scaled display, and the error grows with distance from
     * the origin. Refusing is the only safe answer when the two disagree.
     */
    return {
      allowed: false,
      refusal: "unknown_scale",
      reason: `The coordinate is expressed at ${pointScale}x but the approved region is at ${cage.scale}x. Refusing rather than clicking the wrong place.`,
    };
  }
  if (!inside(point, cage.bounds)) {
    return {
      allowed: false,
      refusal: "outside_cage",
      reason: "The coordinate falls outside the approved window region.",
    };
  }
  for (const ex of cage.exclusions ?? []) {
    if (inside(point, ex)) {
      return {
        allowed: false,
        refusal: "occluded",
        reason: "The coordinate falls inside a protected region that must never be clicked.",
      };
    }
  }
  return {
    allowed: true,
    point,
    evidence: `Coordinate (${point.x}, ${point.y}) is inside the approved region at ${cage.scale}x.`,
  };
}

/** Routes that act on raw coordinates and therefore require a cage. */
export const CAGED_ROUTES: readonly ActionRoute[] = ["vision", "input"];

export const requiresCage = (route: ActionRoute) => CAGED_ROUTES.includes(route);

/* -------------------------------------------------------- destructive ---- */

/**
 * Capabilities that destroy or hide state.
 *
 * Derived from the capability, never read from a caller-supplied flag: a model
 * that could mark its own action non-destructive would route around every
 * confirmation in the system.
 */
const DESTRUCTIVE_CAPABILITIES = new Set([
  "delete",
  "delete_file",
  "empty_trash",
  "uninstall",
  "kill_process",
  "disable_startup",
  "overwrite",
  "format",
  "revoke",
  "reset_settings",
]);

export function isDestructive(capability: string): boolean {
  return DESTRUCTIVE_CAPABILITIES.has(capability);
}

/* ------------------------------------------------------------ backup ----- */

export interface BackupRecord {
  id: string;
  target: string;
  /** Opaque restore token the backup provider understands. */
  token: string;
  createdAt: string;
  /** Proven by reading the backup back, not by the write returning. */
  verified: boolean;
}

export interface BackupProvider {
  create(target: string): Promise<{ token: string } | null>;
  /** Must actually read the backup. Returning true without reading is a lie. */
  verify(token: string): Promise<boolean>;
  restore(token: string): Promise<boolean>;
}

/* ----------------------------------------------------------- receipts ---- */

export interface TransactionReceipt {
  actionId: string;
  idempotencyKey: string;
  route: ActionRoute;
  risk: RiskLevel;
  destructive: boolean;
  /** Every stage that ran, in order, with its outcome. */
  stages: Array<{ stage: string; ok: boolean; detail: string }>;
  backup: BackupRecord | null;
  rollback: { attempted: boolean; ok: boolean; detail: string } | null;
  outcome: "verified" | "refused" | "failed" | "rolled_back" | "replayed";
  reason?: string;
  at: string;
}

export type TransactionFailure =
  | "cancelled"
  | "halted"
  | "not_permitted"
  | "permission_expired"
  | "destructive_unconfirmed"
  | "cage_refused"
  | "backup_failed"
  | "preview_rejected"
  | "execution_failed"
  | "verification_failed";

export interface PcTransactionInput {
  request: OcadeActionRequest;
  /** Permission scopes actually held, and when they lapse. */
  grants: ReadonlySet<string>;
  grantExpiresAt: string;
  /** Explicit user confirmation. Required for destructive capabilities. */
  confirmed?: boolean;
  /** Approved window region, required for coordinate routes. */
  cage?: CoordinateCage | null;
  /** Point and its scale, for coordinate routes. */
  point?: { x: number; y: number; scale: number };
  /** Emergency stop, owned outside the model. */
  isHalted: () => boolean;
  signal?: AbortSignal;
  backup?: BackupProvider;
  /** Runs the underlying governed action. Injected so this stays testable. */
  execute: (request: OcadeActionRequest, signal?: AbortSignal) => Promise<ControlOutcome>;
  /** Performs one recovery step. Absent means rollback cannot be attempted. */
  recover?: (step: RecoveryStep) => Promise<boolean>;
  /** Dry run. Returning false rejects the transaction before any mutation. */
  preview?: (request: OcadeActionRequest) => Promise<{ ok: boolean; detail: string }>;
  now?: () => Date;
}

/**
 * Run one governed PC-control transaction.
 *
 * Stage order is fixed and each stage can only refuse — never widen. The
 * ordering is a safety property, not a style choice:
 *
 *   halt -> cancel -> permission -> expiry -> destructive confirm -> cage
 *        -> preview -> backup -> execute -> verify -> receipt -> rollback
 *
 * Emergency stop is first because a halted system must not evaluate anything
 * else. Backup is immediately before execute because a backup taken earlier
 * could be stale by the time the mutation lands.
 */
export async function runPcTransaction(input: PcTransactionInput): Promise<TransactionReceipt> {
  const now = input.now ?? (() => new Date());
  const req = input.request;
  const destructive = isDestructive(req.capability);
  const stages: TransactionReceipt["stages"] = [];
  const at = now().toISOString();
  let backup: BackupRecord | null = null;

  const stage = (name: string, ok: boolean, detail: string) => {
    stages.push({ stage: name, ok, detail });
    return ok;
  };
  const refuse = (failure: TransactionFailure, reason: string): TransactionReceipt => ({
    actionId: req.actionId,
    idempotencyKey: req.idempotencyKey,
    route: req.route,
    risk: req.risk,
    destructive,
    stages,
    backup,
    rollback: null,
    outcome: "refused",
    reason: `${failure}: ${reason}`,
    at,
  });

  // 1. Emergency stop — independent of the model, checked before anything else.
  if (input.isHalted()) {
    stage("emergency_stop", false, "halted");
    return refuse("halted", "Emergency stop is engaged.");
  }
  stage("emergency_stop", true, "not halted");

  // 2. Cancellation.
  if (input.signal?.aborted) {
    stage("cancellation", false, "already cancelled");
    return refuse("cancelled", "The action was cancelled before it began.");
  }
  stage("cancellation", true, "not cancelled");

  // 3. Permission scope.
  if (!input.grants.has(req.requiredPermission)) {
    stage("permission", false, req.requiredPermission);
    return refuse("not_permitted", `Permission "${req.requiredPermission}" is not granted.`);
  }
  stage("permission", true, req.requiredPermission);

  // 4. Permission expiry. A grant that has lapsed is not a grant.
  const expiry = Date.parse(input.grantExpiresAt);
  if (!Number.isFinite(expiry) || now().getTime() >= expiry) {
    stage("permission_expiry", false, input.grantExpiresAt);
    return refuse("permission_expired", "The permission grant has expired. Ask again.");
  }
  stage("permission_expiry", true, `valid until ${input.grantExpiresAt}`);

  // 5. Destructive confirmation, derived from the capability not a flag.
  if (destructive && input.confirmed !== true) {
    stage("destructive_confirmation", false, req.capability);
    return refuse(
      "destructive_unconfirmed",
      `"${req.capability}" destroys or hides state and needs explicit confirmation.`,
    );
  }
  stage("destructive_confirmation", true, destructive ? "confirmed" : "not destructive");

  // 6. Coordinate cage.
  if (requiresCage(req.route)) {
    if (!input.point) {
      stage("coordinate_cage", false, "no point supplied");
      return refuse(
        "cage_refused",
        "A coordinate route was chosen but no coordinate was supplied.",
      );
    }
    const verdict = checkCoordinate(input.point, input.cage ?? null, input.point.scale);
    if (!verdict.allowed) {
      stage("coordinate_cage", false, verdict.refusal);
      return refuse("cage_refused", verdict.reason);
    }
    stage("coordinate_cage", true, verdict.evidence);
  } else {
    stage("coordinate_cage", true, "not a coordinate route");
  }

  // 7. Preview / dry run.
  if (input.preview) {
    const p = await input.preview(req);
    if (!p.ok) {
      stage("preview", false, p.detail);
      return refuse("preview_rejected", p.detail);
    }
    stage("preview", true, p.detail);
  } else {
    stage("preview", true, "no preview available for this action");
  }

  // 8. Backup, immediately before mutation, VERIFIED by reading it back.
  if (input.backup && (destructive || req.risk === "high" || req.risk === "medium")) {
    const target = String(req.arguments.path ?? req.arguments.target ?? req.appIdentity.appId);
    const created = await input.backup.create(target);
    if (!created) {
      stage("backup", false, "could not create");
      return refuse("backup_failed", "A backup could not be created, so the change was not made.");
    }
    const verified = await input.backup.verify(created.token);
    if (!verified) {
      stage("backup", false, "created but unreadable");
      return refuse(
        "backup_failed",
        "The backup could not be read back, so it cannot be relied on. The change was not made.",
      );
    }
    backup = {
      id: `bak-${req.idempotencyKey}`,
      target,
      token: created.token,
      createdAt: now().toISOString(),
      verified: true,
    };
    stage("backup", true, `verified backup of ${target}`);
  } else {
    stage("backup", true, "no backup required for this risk level");
  }

  // 9. Execute through the governed engine.
  if (input.signal?.aborted) {
    stage("execute", false, "cancelled before dispatch");
    return refuse("cancelled", "The action was cancelled before dispatch.");
  }
  const outcome = await input.execute(req, input.signal);

  if (outcome.status === "replayed") {
    stage("execute", true, "already applied; replayed from the journal");
    return {
      actionId: req.actionId,
      idempotencyKey: req.idempotencyKey,
      route: req.route,
      risk: req.risk,
      destructive,
      stages,
      backup,
      rollback: null,
      outcome: "replayed",
      at,
    };
  }

  if (outcome.status === "verified") {
    stage("execute", true, "executed");
    stage("verify", true, "postconditions verified independently");
    return {
      actionId: req.actionId,
      idempotencyKey: req.idempotencyKey,
      route: req.route,
      risk: req.risk,
      destructive,
      stages,
      backup,
      rollback: null,
      outcome: "verified",
      at,
    };
  }

  // 10. Failure. Roll back if there is a plan AND a recoverer.
  const reason = "reason" in outcome ? outcome.reason : "The action did not verify.";
  stage("execute", false, reason);

  const rollback = await attemptRollback(req, input, backup);
  return {
    actionId: req.actionId,
    idempotencyKey: req.idempotencyKey,
    route: req.route,
    risk: req.risk,
    destructive,
    stages,
    backup,
    rollback,
    outcome: rollback?.ok ? "rolled_back" : "failed",
    reason,
    at,
  };
}

/**
 * Execute the rollback plan.
 *
 * `rollbackPlan` has existed on `OcadeActionRequest` since the type was
 * written and nothing ever ran it. Steps marked `ready: false` are SKIPPED
 * rather than attempted: a recovery step that has declared itself not ready is
 * more likely to compound the failure than undo it.
 */
async function attemptRollback(
  req: OcadeActionRequest,
  input: PcTransactionInput,
  backup: BackupRecord | null,
): Promise<TransactionReceipt["rollback"]> {
  const plan = (req.rollbackPlan ?? []).filter((s) => s.ready);
  const notReady = (req.rollbackPlan ?? []).length - plan.length;

  if (plan.length === 0 && !backup) {
    return {
      attempted: false,
      ok: false,
      detail:
        notReady > 0
          ? `No rollback attempted: ${notReady} recovery step(s) declared themselves not ready.`
          : "No rollback plan and no backup, so the change could not be undone automatically.",
    };
  }

  const done: string[] = [];
  // Undo in REVERSE order. Replaying forward would re-apply the sequence that
  // failed rather than unwind it.
  for (const step of [...plan].reverse()) {
    if (!input.recover) {
      return { attempted: false, ok: false, detail: "No recovery executor is connected." };
    }
    const ok = await input.recover(step);
    if (!ok) {
      return {
        attempted: true,
        ok: false,
        detail: `Recovery step "${step.id}" (${step.kind}) failed. Completed before it: ${done.join(", ") || "none"}.`,
      };
    }
    done.push(step.id);
  }

  if (backup && input.backup) {
    const restored = await input.backup.restore(backup.token);
    if (!restored) {
      return {
        attempted: true,
        ok: false,
        detail: `Recovery steps ran but the backup of ${backup.target} could not be restored.`,
      };
    }
    done.push(`restore:${backup.target}`);
  }

  return {
    attempted: true,
    ok: true,
    detail: `Rolled back: ${done.join(", ")}${notReady > 0 ? ` (${notReady} step(s) skipped as not ready)` : ""}.`,
  };
}
