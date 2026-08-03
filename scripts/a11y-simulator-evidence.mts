/**
 * SIMULATED-runtime evidence for HWE-10 (accessibility-tree simulator).
 *
 * Runs the governed control path against every adversarial scenario and writes
 * down what was refused and why. The tier this produces is SIMULATED RUNTIME
 * VERIFIED and nothing higher: no real application, accessibility API or
 * operating system is involved, and the harness asserts that the evidence file
 * itself cannot claim otherwise.
 *
 * Usage: npx vite-node scripts/a11y-simulator-evidence.mts
 */
import { writeFileSync } from "node:fs";
import {
  AccessibilityTreeSimulator,
  EmergencyStop,
  assertNotRealEvidence,
  SIMULATED_PREFIX,
  type A11yNode,
  type A11yWindow,
  type Disturbance,
  type SimReceipt,
} from "../src/lib/hwe/a11y-simulator.ts";
import type { OcadeActionRequest } from "../src/lib/control/control-plane.ts";

const PERM = "control.ui";
const rect = (x = 0, y = 0) => ({ x, y, width: 90, height: 24 });
const n = (p: Partial<A11yNode> & { id: string; role: A11yNode["role"] }): A11yNode => ({
  name: p.id,
  bounds: rect(),
  enabled: true,
  visible: true,
  focused: false,
  ...p,
});

function tree(): A11yWindow[] {
  return [
    {
      windowId: "w1",
      appId: "com.example.editor",
      appVersion: "1.0.0",
      title: "Example Editor",
      nodes: [
        n({ id: "root", role: "window" }),
        n({ id: "save", role: "button", name: "Save", parentId: "root", focused: true }),
        n({ id: "other", role: "button", name: "Close", parentId: "root" }),
      ],
    },
  ];
}

function req(over: Partial<OcadeActionRequest> = {}): OcadeActionRequest {
  return {
    actionId: "ev",
    taskId: "t",
    stepId: "s",
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
    idempotencyKey: "k",
    ...over,
  };
}

type Case = {
  id: string;
  what: string;
  expect: SimReceipt["failure"] | "success";
  disturbance: Disturbance;
  request?: Partial<OcadeActionRequest>;
  permit?: boolean;
  halt?: boolean;
  cancel?: boolean;
};

const CASES: Case[] = [
  { id: "S01", what: "healthy control is actioned", expect: "success", disturbance: { kind: "none" } },
  {
    id: "S02",
    what: "destroyed (stale) node is refused, not actioned",
    expect: "stale_target",
    disturbance: { kind: "node_goes_stale", nodeId: "save" },
  },
  {
    id: "S03",
    what: "renamed control is reported missing, not substituted",
    expect: "target_not_found",
    disturbance: { kind: "control_renamed", nodeId: "save", newName: "Save file" },
    request: { arguments: { name: "Save" } },
  },
  {
    id: "S04",
    what: "disabled control is refused",
    expect: "disabled_target",
    disturbance: { kind: "control_disabled", nodeId: "save" },
  },
  {
    id: "S05",
    what: "modal dialog blocks the target",
    expect: "modal_blocked",
    disturbance: {
      kind: "modal_appears",
      dialog: n({ id: "confirm", role: "dialog", name: "Unsaved changes" }),
    },
  },
  {
    id: "S06",
    what: "focus theft blocks typing rather than sending keys elsewhere",
    expect: "focus_lost",
    disturbance: { kind: "focus_theft", toNodeId: "other" },
    request: { capability: "type", arguments: { nodeId: "save", text: "hello" } },
  },
  {
    id: "S07",
    what: "application exiting mid-step is refused",
    expect: "app_gone",
    disturbance: { kind: "app_interrupted" },
  },
  {
    id: "S08",
    what: "missing permission is refused",
    expect: "permission_denied",
    disturbance: { kind: "none" },
    permit: false,
  },
  {
    id: "S09",
    what: "emergency stop refuses before permission is even evaluated",
    expect: "halted",
    disturbance: { kind: "none" },
    permit: false,
    halt: true,
  },
  {
    id: "S10",
    what: "cancellation refuses and applies no mutation",
    expect: "cancelled",
    disturbance: { kind: "none" },
    cancel: true,
  },
  {
    id: "S11",
    what: "a route this simulator cannot honestly serve is refused",
    expect: "unsupported_route",
    disturbance: { kind: "none" },
    request: { route: "api" },
  },
  {
    id: "S12",
    what: "version drift is recorded and the action still evaluated",
    expect: "success",
    disturbance: { kind: "version_drift", newVersion: "2.0.0" },
  },
];

async function main() {
  console.log(`\nHWE-10 accessibility-tree simulator — SIMULATED evidence\n`);
  const steps: Array<Record<string, unknown>> = [];
  let failed = 0;

  for (const c of CASES) {
    const stop = new EmergencyStop();
    if (c.halt) stop.halt();
    const sim = new AccessibilityTreeSimulator(tree(), {
      grantedPermissions: c.permit === false ? new Set() : new Set([PERM]),
      emergencyStop: stop,
      script: { disturbances: [c.disturbance] },
    });
    const ac = new AbortController();
    if (c.cancel) ac.abort();
    const exec = await sim.executor(req(c.request), ac.signal);
    const receipt = exec.output as SimReceipt;
    const actual = receipt.failure ?? "success";
    const ok = actual === c.expect;
    if (!ok) failed++;

    // Every line must carry the simulated marker; an unlabelled line is how
    // simulated output gets mistaken for real evidence later.
    const unlabelled = exec.evidence.filter((l) => !l.startsWith(SIMULATED_PREFIX));
    if (unlabelled.length > 0) failed++;

    steps.push({
      id: c.id,
      what: c.what,
      expected: c.expect,
      actual,
      ok: ok && unlabelled.length === 0,
      simulated: receipt.simulated,
      nodeId: receipt.nodeId,
      evidence: exec.evidence,
      unlabelledEvidenceLines: unlabelled.length,
    });
    console.log(`  [${ok ? "OK  " : "FAIL"}] ${c.id}  ${c.what}  → ${actual}`);
  }

  // Recovery is a separate claim from refusal: refusing a renamed control is
  // only half the behaviour, re-resolving it is the other half.
  const rec = new AccessibilityTreeSimulator(tree(), {
    grantedPermissions: new Set([PERM]),
    script: { disturbances: [{ kind: "control_renamed", nodeId: "save", newName: "Save file" }] },
  });
  await rec.executor(req({ arguments: { name: "Save" } }), new AbortController().signal);
  const recovered = rec.recoverTarget("Save file");
  const recOk = recovered.ok && recovered.nodeId === "save";
  if (!recOk) failed++;
  steps.push({ id: "S13", what: "renamed control is recovered by re-resolution", ok: recOk, detail: recovered });
  console.log(`  [${recOk ? "OK  " : "FAIL"}] S13  renamed control is recovered by re-resolution`);

  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tier: "SIMULATED RUNTIME VERIFIED",
    subject: "HWE-10 headless accessibility-tree simulator",
    notRealApplicationSupport:
      "No real application, accessibility API or operating system was involved. This proves the governed control path refuses, cancels, halts and recovers correctly against scripted adversarial conditions. It proves NOTHING about driving real applications, and must never be promoted to REAL TARGET RUNTIME VERIFIED.",
    summary: { observed: steps.filter((s) => s.ok).length, failed, total: steps.length },
    steps,
  };

  // Belt and braces: the guard that stops this file being relabelled.
  assertNotRealEvidence({ simulated: true }, evidence.tier);

  writeFileSync(
    "release/OCADE_A11Y_SIMULATOR_EVIDENCE.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(`\n  observed=${evidence.summary.observed} failed=${failed} total=${steps.length}`);
  console.log("  written: release/OCADE_A11Y_SIMULATOR_EVIDENCE.json\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
