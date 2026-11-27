/**
 * REPO-03: compacting the planner's history must never change a correct decision. A frozen corpus of
 * long, multilingual and multi-window histories; each case names what must survive compaction.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { history } from "../../src/lib/jarvis/planner.server.ts";
import type { Step } from "../../src/lib/jarvis/supervisor.ts";

const at = "2026-11-27T00:00:00.000Z";
const step = (
  index: number,
  evidence: unknown,
  extra: Partial<Step> & { receipt?: Record<string, unknown> } = {},
): Step =>
  ({
    intent: {
      operation: "fs.read_text",
      arguments: { path: `f${index}.txt` },
      idempotencyKey: `k${index}`,
    },
    status: "done",
    receipt: { status: "observed", maybeChanged: false, observedAtUtc: at, evidence },
    ...extra,
  }) as unknown as Step;
const filler = (count: number) =>
  Array.from({ length: count }, (_, i) => step(i, { text: "line ".repeat(30) + i }));
const unseen = (index: number, errorCode = "focus_lost"): Step =>
  ({
    ...step(index, {}),
    status: "failed",
    receipt: { status: "unknown", maybeChanged: true, observedAtUtc: at, errorCode },
  }) as unknown as Step;

test("an old step whose effect nobody saw is still on the page after 80 later steps", () => {
  const steps = filler(80);
  steps[3] = unseen(3);
  const shown = history(steps);
  assert.match(shown, /"arguments":\{"path":"f3\.txt"\}[^\n]*"recovery":"uncertain_effect"/);
  assert.match(shown, /"reobserveFirst":true/);
  assert.ok(shown.includes("f79.txt"), "the newest step is still there");
});

test("a step the person already answered is not carried forward, and the page stays bounded", () => {
  const steps = filler(80);
  steps[3] = { ...unseen(3), resolution: "unapplied" } as unknown as Step;
  assert.ok(!history(steps).includes("f3.txt"));
  const many = filler(120).map((s, i) => (i < 40 ? unseen(i) : s));
  const shown = history(many);
  assert.equal(
    (shown.match(/older step, effect unknown/g) ?? []).length,
    8,
    "at most eight carried obligations",
  );
  assert.ok(shown.length < 12_000 + 8 * 600, `page of ${shown.length} characters`);
});

test("multilingual names and element references in the newest observation survive byte for byte", () => {
  const elements = Array.from({ length: 60 }, (_, i) => ({
    ref: `e${i}`,
    name: `ボタン ${i} · زر ${i} · 🚀`,
    role: "button",
  }));
  const shown = history([...filler(5), step(5, { elements })]);
  for (const element of elements) {
    assert.ok(shown.includes(JSON.stringify(element).slice(1, -1)), `${element.ref} lost`);
  }
});

test("a person's decision on a recent step and the hint for its refusal are never clipped away", () => {
  const refused: Step = {
    ...step(90, {}),
    status: "failed",
    resolution: "applied",
    receipt: {
      status: "not_applied",
      maybeChanged: false,
      observedAtUtc: at,
      errorCode: "file_changed",
    },
  } as unknown as Step;
  const shown = history([...filler(10), step(11, { text: "y".repeat(40_000) }), refused]);
  assert.match(shown, /"personSays":"it took effect"/);
  assert.match(shown, /"hint":"the file changed since it was read/);
  assert.match(shown, /"recovery":"recoverable"/);
});
