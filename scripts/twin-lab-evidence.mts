/**
 * Simulated runtime evidence for the application digital-twin laboratory.
 *
 * Drives every adversarial twin through the route ladder and records what was
 * refused, what was downgraded, and what was verified against ground truth.
 *
 * Tier: SIMULATED RUNTIME VERIFIED, and nothing above it. A twin models an
 * application; it is not one. The evidence file says so in its own body so the
 * caveat cannot be separated from the numbers.
 *
 * Usage: npx vite-node scripts/twin-lab-evidence.mts
 */
import { writeFileSync } from "node:fs";
import {
  buildTwinLab,
  TWIN_PREFIX,
  type TwinAction,
  type TwinKind,
} from "../src/lib/control-labs/twin-lab.ts";
import { assertNotRealEvidence } from "../src/lib/control-labs/a11y-simulator.ts";

type Case = {
  id: string;
  twin: TwinKind;
  what: string;
  action: TwinAction;
  expect: "ok" | string;
  setup?: (lab: ReturnType<typeof buildTwinLab>) => void;
  opts?: Parameters<typeof buildTwinLab>[0];
  cancel?: boolean;
};

const a = (o: Partial<TwinAction> & { targetId: string }): TwinAction => ({
  intent: "activate",
  route: "accessibility",
  ...o,
});

const CASES: Case[] = [
  { id: "T01", twin: "menu", what: "API route serves a menu item directly", action: a({ targetId: "save_item", route: "api" }), expect: "ok" },
  { id: "T02", twin: "menu", what: "disabled menu item is refused", action: a({ targetId: "quit_item", route: "accessibility" }), expect: "target_not_found" },
  { id: "T03", twin: "form", what: "form field set and verified against ground truth", action: a({ targetId: "name", intent: "set_value", value: "Ada", route: "dom" }), expect: "ok" },
  { id: "T04", twin: "form", what: "unsupported api falls DOWN to dom, not up", action: a({ targetId: "submit", route: "api" }), expect: "ok" },
  { id: "T05", twin: "virtualised_list", what: "unrealised virtual row cannot be actioned", action: a({ targetId: "row_5000", route: "accessibility" }), expect: "offscreen_target" },
  { id: "T06", twin: "virtualised_list", what: "safe downgrade dom -> accessibility needs no coordinate consent", action: a({ targetId: "row_1", route: "dom" }), expect: "ok" },
  { id: "T07", twin: "canvas", what: "coordinate route refused without explicit consent", action: a({ targetId: "shape_a", route: "vision" }), expect: "unsafe_downgrade" },
  { id: "T08", twin: "canvas", what: "coordinate route allowed once consented", action: a({ targetId: "shape_a", route: "vision", allowCoordinateFallback: true }), expect: "ok" },
  { id: "T09", twin: "nested_dialogs", what: "modal interruption refuses rather than clicking through", action: a({ targetId: "behind", route: "accessibility" }), expect: "modal_interrupted", setup: (l) => l.nested_dialogs.interrupt() },
  { id: "T10", twin: "drag_and_drop", what: "drag verified by ground-truth position", action: a({ targetId: "card_1", intent: "move", value: 3, route: "api" }), expect: "ok" },
  { id: "T11", twin: "inaccessible_controls", what: "widget with no accessible identity needs coordinate consent", action: a({ targetId: "custom_widget", route: "vision" }), expect: "unsafe_downgrade" },
  { id: "T12", twin: "mixed_dpi", what: "logical-pixel move refused on a 2x display", action: a({ targetId: "scaled_button", intent: "move", value: 100, route: "input", allowCoordinateFallback: true }), expect: "dpi_mismatch" },
  { id: "T13", twin: "changing_layout", what: "stale target refused after layout change", action: a({ targetId: "moving_button", route: "accessibility" }), expect: "stale_target", setup: (l) => l.changing_layout.makeStale("moving_button") },
  { id: "T14", twin: "form", what: "cancellation leaves ground truth untouched", action: a({ targetId: "email", intent: "set_value", value: "zzz", route: "dom" }), expect: "cancelled", cancel: true },
  { id: "T15", twin: "form", what: "emergency stop refuses before routing", action: a({ targetId: "submit", route: "api" }), expect: "halted", opts: { halted: true } },
  { id: "T16", twin: "form", what: "missing permission refused", action: a({ targetId: "submit", route: "dom" }), expect: "not_permitted", opts: { permitted: false } },
];

async function main() {
  console.log("\nApplication digital-twin laboratory — SIMULATED evidence\n");
  const steps: Array<Record<string, unknown>> = [];
  let failed = 0;

  for (const c of CASES) {
    const lab = buildTwinLab(c.opts ?? {});
    c.setup?.(lab);
    const ac = new AbortController();
    if (c.cancel) ac.abort();
    const before = lab[c.twin].groundTruth(c.action.targetId);
    const r = lab[c.twin].perform(c.action, ac.signal);
    const after = lab[c.twin].groundTruth(c.action.targetId);
    const actual = r.ok ? "ok" : (r.failure ?? "unknown");
    const ok = actual === c.expect;

    // A refusal must not have mutated ground truth. This is the check that
    // separates "refused" from "refused after doing it anyway".
    const mutatedOnRefusal = !r.ok && before !== after;
    if (!ok || mutatedOnRefusal) failed++;

    const unlabelled = r.evidence.filter((l) => !l.startsWith(TWIN_PREFIX));
    if (unlabelled.length > 0) failed++;

    steps.push({
      id: c.id,
      twin: c.twin,
      what: c.what,
      expected: c.expect,
      actual,
      ok: ok && !mutatedOnRefusal && unlabelled.length === 0,
      routeRequested: c.action.route,
      routeUsed: r.route,
      downgraded: r.requestedRoute !== undefined,
      verifiedAgainstGroundTruth: r.verifiedAgainstGroundTruth,
      mutatedOnRefusal,
      evidence: r.evidence,
    });
    console.log(
      `  [${ok && !mutatedOnRefusal ? "OK  " : "FAIL"}] ${c.id} ${c.twin.padEnd(22)} ${c.what} → ${actual}`,
    );
  }

  // Rollback is a separate claim and is verified by re-reading, not asserted.
  const lab = buildTwinLab();
  const prior = lab.form.groundTruth("email");
  lab.form.perform(a({ targetId: "email", intent: "set_value", value: "x@y.z", route: "dom" }));
  const rolled = lab.form.rollback("email", prior as string);
  const rollOk = rolled && lab.form.groundTruth("email") === prior;
  if (!rollOk) failed++;
  steps.push({ id: "T17", twin: "form", what: "rollback restores prior ground truth and is re-read to confirm", ok: rollOk });
  console.log(`  [${rollOk ? "OK  " : "FAIL"}] T17 form                   rollback verified by re-reading ground truth`);

  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tier: "SIMULATED RUNTIME VERIFIED",
    subject: "Application digital-twin laboratory",
    notRealApplicationSupport:
      "A twin models an application; it is not one. No licensed application, real GUI toolkit, real display or real input device was involved. This proves route selection, unsafe-downgrade refusal, ground-truth verification, interruption, cancellation, emergency stop and rollback behave correctly against adversarial models. It proves NOTHING about driving real applications and must never be promoted to REAL TARGET RUNTIME VERIFIED.",
    routeLadder: "api -> plugin -> mcp -> cli -> file -> dom -> accessibility -> native -> vision -> input",
    summary: { observed: steps.filter((s) => s.ok).length, failed, total: steps.length },
    steps,
  };
  assertNotRealEvidence({ simulated: true }, evidence.tier);

  writeFileSync("release/OCADE_TWIN_LAB_EVIDENCE.json", JSON.stringify(evidence, null, 2));
  console.log(`\n  observed=${evidence.summary.observed} failed=${failed} total=${steps.length}`);
  console.log("  written: release/OCADE_TWIN_LAB_EVIDENCE.json\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
