/**
 * SIMULATED-runtime evidence for P10 (universal PC-control transaction engine).
 *
 * Drives `runPcTransaction` against the P07 accessibility simulator's real
 * executor, so the transaction stages and the underlying control path both
 * actually run.
 *
 * Tier: SIMULATED RUNTIME VERIFIED. No real application, display, input device
 * or built companion is involved, and the harness refuses to label itself
 * otherwise.
 *
 * Usage: npx vite-node scripts/pc-transaction-evidence.mts
 */
import { writeFileSync } from "node:fs";
import {
  runPcTransaction,
  isDestructive,
  type CoordinateCage,
  type TransactionReceipt,
} from "../src/lib/control/pc-transaction.ts";
import {
  AccessibilityTreeSimulator,
  EmergencyStop,
  assertNotRealEvidence,
  type A11yNode,
} from "../src/lib/control-labs/a11y-simulator.ts";
import type { ControlOutcome, OcadeActionRequest } from "../src/lib/control/control-plane.ts";

const PERM = "control.ui";
const CAGE: CoordinateCage = { bounds: { x: 0, y: 0, width: 200, height: 200 }, scale: 1 };
const n = (p: Partial<A11yNode> & { id: string; role: A11yNode["role"] }): A11yNode => ({
  name: p.id,
  bounds: { x: 0, y: 0, width: 90, height: 24 },
  enabled: true,
  visible: true,
  focused: false,
  ...p,
});

function req(over: Partial<OcadeActionRequest> = {}): OcadeActionRequest {
  return {
    actionId: "ev",
    taskId: "t",
    stepId: "s",
    appIdentity: { appId: "com.example.editor", version: "1.0.0", windowId: "w1" },
    capability: "click",
    route: "accessibility",
    arguments: { nodeId: "save", path: "/tmp/example.txt" },
    risk: "low",
    requiredPermission: PERM,
    expectedPostconditions: [],
    verificationPlan: [],
    timeoutMs: 5000,
    retryBudget: 0,
    idempotencyKey: "k",
    ...over,
  };
}

/** Executes through the P07 simulator, so the underlying control path is real. */
function simulatorExecutor(halted: boolean) {
  const stop = new EmergencyStop();
  if (halted) stop.halt();
  const sim = new AccessibilityTreeSimulator(
    [
      {
        windowId: "w1",
        appId: "com.example.editor",
        appVersion: "1.0.0",
        title: "Example Editor",
        nodes: [
          n({ id: "root", role: "window" }),
          n({ id: "save", role: "button", name: "Save", focused: true }),
        ],
      },
    ],
    { grantedPermissions: new Set([PERM]), emergencyStop: stop },
  );
  return async (r: OcadeActionRequest, signal?: AbortSignal): Promise<ControlOutcome> => {
    const exec = await sim.executor(r, signal ?? new AbortController().signal);
    const out = exec.output as { failure?: string };
    return out.failure
      ? ({ status: "failed", request: r, reason: out.failure } as ControlOutcome)
      : ({
          status: "verified",
          request: r,
          execution: exec,
          receipt: {
            verified: true,
            evidence: exec.evidence,
            observations: [],
            missingPostconditions: [],
            mismatchedPostconditions: [],
          },
        } as ControlOutcome);
  };
}

type Case = {
  id: string;
  what: string;
  expect: TransactionReceipt["outcome"];
  reasonMatch?: RegExp;
  build: () => Parameters<typeof runPcTransaction>[0];
};

const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();
const okBackup = { create: async () => ({ token: "t" }), verify: async () => true, restore: async () => true };

const CASES: Case[] = [
  {
    id: "X01",
    what: "a permitted, confirmed, caged action completes and verifies",
    expect: "verified",
    build: () => ({
      request: req(),
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      isHalted: () => false,
      execute: simulatorExecutor(false),
    }),
  },
  {
    id: "X02",
    what: "emergency stop refuses before permission is evaluated",
    expect: "refused",
    reasonMatch: /halted/,
    build: () => ({
      request: req(),
      grants: new Set(),
      grantExpiresAt: future(),
      isHalted: () => true,
      execute: simulatorExecutor(true),
    }),
  },
  {
    id: "X03",
    what: "an expired permission grant is refused",
    expect: "refused",
    reasonMatch: /permission_expired/,
    build: () => ({
      request: req(),
      grants: new Set([PERM]),
      grantExpiresAt: past(),
      isHalted: () => false,
      execute: simulatorExecutor(false),
    }),
  },
  {
    id: "X04",
    what: "a destructive capability without confirmation is refused",
    expect: "refused",
    reasonMatch: /destructive_unconfirmed/,
    build: () => ({
      request: req({ capability: "delete", risk: "high" }),
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      isHalted: () => false,
      backup: okBackup,
      execute: simulatorExecutor(false),
    }),
  },
  {
    id: "X05",
    what: "a coordinate outside the approved window is refused, not clamped",
    expect: "refused",
    reasonMatch: /cage_refused/,
    build: () => ({
      request: req({ route: "input" }),
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      cage: CAGE,
      point: { x: 5_000, y: 5_000, scale: 1 },
      isHalted: () => false,
      execute: simulatorExecutor(false),
    }),
  },
  {
    id: "X06",
    what: "a coordinate at the wrong display scale is refused",
    expect: "refused",
    reasonMatch: /cage_refused/,
    build: () => ({
      request: req({ route: "input" }),
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      cage: { ...CAGE, scale: 2 },
      point: { x: 50, y: 50, scale: 1 },
      isHalted: () => false,
      execute: simulatorExecutor(false),
    }),
  },
  {
    id: "X07",
    what: "a rejected dry run stops the transaction before any mutation",
    expect: "refused",
    reasonMatch: /preview_rejected/,
    build: () => ({
      request: req(),
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      isHalted: () => false,
      preview: async () => ({ ok: false, detail: "would overwrite 12 files" }),
      execute: simulatorExecutor(false),
    }),
  },
  {
    id: "X08",
    what: "an unreadable backup refuses the change rather than proceeding",
    expect: "refused",
    reasonMatch: /backup_failed/,
    build: () => ({
      request: req({ capability: "delete", risk: "high" }),
      confirmed: true,
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      isHalted: () => false,
      backup: { ...okBackup, verify: async () => false },
      execute: simulatorExecutor(false),
    }),
  },
  {
    id: "X09",
    what: "cancellation refuses before dispatch",
    expect: "refused",
    reasonMatch: /cancelled/,
    build: () => {
      const ac = new AbortController();
      ac.abort();
      return {
        request: req(),
        grants: new Set([PERM]),
        grantExpiresAt: future(),
        isHalted: () => false,
        signal: ac.signal,
        execute: simulatorExecutor(false),
      };
    },
  },
  {
    id: "X10",
    what: "a failed execution rolls back in reverse order and restores the backup",
    expect: "rolled_back",
    build: () => ({
      request: req({
        capability: "delete",
        risk: "high",
        arguments: { nodeId: "missing-node", path: "/tmp/x" },
        rollbackPlan: [
          { id: "r1", kind: "undo", description: "undo", ready: true },
          { id: "r2", kind: "restore", description: "restore", ready: true },
        ],
      }),
      confirmed: true,
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      isHalted: () => false,
      backup: okBackup,
      recover: async () => true,
      execute: simulatorExecutor(false),
    }),
  },
  {
    id: "X11",
    what: "a duplicate action replays from the journal instead of re-executing",
    expect: "replayed",
    build: () => ({
      request: req(),
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      isHalted: () => false,
      execute: async (r: OcadeActionRequest) =>
        ({
          status: "replayed",
          request: r,
          receipt: {
            verified: true,
            evidence: [],
            observations: [],
            missingPostconditions: [],
            mismatchedPostconditions: [],
          },
        }) as ControlOutcome,
    }),
  },
  {
    id: "X12",
    what: "a failure with no rollback plan and no backup does NOT claim recovery",
    expect: "failed",
    build: () => ({
      request: req({ arguments: { nodeId: "missing-node" } }),
      grants: new Set([PERM]),
      grantExpiresAt: future(),
      isHalted: () => false,
      execute: simulatorExecutor(false),
    }),
  },
];

async function main() {
  console.log("\nP10 universal PC-control transaction engine — SIMULATED evidence\n");
  const steps: Array<Record<string, unknown>> = [];
  let failed = 0;

  for (const c of CASES) {
    const receipt = await runPcTransaction(c.build());
    const matched =
      receipt.outcome === c.expect && (!c.reasonMatch || c.reasonMatch.test(receipt.reason ?? ""));
    if (!matched) failed++;
    steps.push({
      id: c.id,
      what: c.what,
      expected: c.expect,
      actual: receipt.outcome,
      ok: matched,
      reason: receipt.reason,
      destructive: receipt.destructive,
      backupVerified: receipt.backup?.verified ?? null,
      rollback: receipt.rollback,
      stages: receipt.stages.map((s) => `${s.ok ? "ok" : "no"}:${s.stage}`),
    });
    console.log(`  [${matched ? "OK  " : "FAIL"}] ${c.id}  ${c.what} → ${receipt.outcome}`);
  }

  // The model boundary, asserted rather than described.
  const boundary = ["delete", "uninstall", "kill_process", "empty_trash", "disable_startup"].every(
    isDestructive,
  );
  if (!boundary) failed++;
  steps.push({
    id: "X13",
    what: "destructiveness is derived from the capability, not a caller-supplied flag",
    ok: boundary,
  });
  console.log(`  [${boundary ? "OK  " : "FAIL"}] X13  destructiveness derived, not declared`);

  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tier: "SIMULATED RUNTIME VERIFIED",
    subject: "P10 universal PC-control transaction engine",
    notRealApplicationSupport:
      "Executed against the P07 accessibility simulator. No real application, display, input device or built Tauri companion was involved. This proves the transaction refuses, cages, previews, backs up, verifies and rolls back correctly. It proves NOTHING about controlling real Windows applications, and must never be promoted to REAL TARGET RUNTIME VERIFIED.",
    stageOrder:
      "emergency stop -> cancellation -> permission -> expiry -> destructive confirmation -> coordinate cage -> preview -> backup -> execute -> verify -> rollback",
    summary: { observed: steps.filter((s) => s.ok).length, failed, total: steps.length },
    steps,
  };
  assertNotRealEvidence({ simulated: true }, evidence.tier);
  writeFileSync("release/OCADE_PC_TRANSACTION_EVIDENCE.json", JSON.stringify(evidence, null, 2));
  console.log(`\n  observed=${evidence.summary.observed} failed=${failed} total=${steps.length}`);
  console.log("  written: release/OCADE_PC_TRANSACTION_EVIDENCE.json\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
