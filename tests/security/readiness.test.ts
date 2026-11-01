/** Readiness configuration must never earn milestones from missing criteria. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("../../scripts/launch-readiness.mjs", import.meta.url));
type Condition = { id: string; text: string; status: string; evidence: string[]; reason?: string };
const fixture = () => ({
  milestones: Array.from({ length: 10 }, (_, index) => ({
    n: index + 1,
    name: `Fixture milestone ${index + 1}`,
    conditions: Array.from({ length: index < 2 ? 5 : 4 }, (_, at): Condition => ({
      id: `criterion_${index}_${at}`,
      text: "Synthetic criterion",
      status: "UNTESTED",
      evidence: [],
    })),
  })),
});

test("readiness rejects omitted, duplicated and empty mandatory criteria", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "ocade-readiness-"));
  try {
    mkdirSync(join(root, "evidence/readiness"), { recursive: true });
    for (const args of [
      ["init", "-q"],
      ["-c", "user.name=Synthetic CI", "-c", "user.email=ci@example.test", "commit", "--allow-empty", "-qm", "synthetic fixture"],
    ]) {
      const git = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      assert.equal(git.status, 0, git.stderr);
    }
    const run = (config: ReturnType<typeof fixture>) => {
      writeFileSync(join(root, "evidence/readiness/gates.json"), JSON.stringify(config));
      return spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    };
    const valid = run(fixture());
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /Readiness 0% earned/);
    const cases: [string, (value: ReturnType<typeof fixture>) => void][] = [
      ["missing milestone", (v) => { v.milestones.pop(); }],
      ["duplicate milestone", (v) => { v.milestones[9].n = 1; }],
      ["extra milestone", (v) => { v.milestones.push({ ...v.milestones[0], n: 11 }); }],
      ["empty milestone", (v) => { v.milestones[1].conditions.push(...v.milestones[0].conditions); v.milestones[0].conditions = []; }],
      ["missing mandatory condition", (v) => { v.milestones[0].conditions.pop(); }],
      ["duplicate condition", (v) => { v.milestones[1].conditions[0].id = v.milestones[0].conditions[0].id; }],
      ["unknown state", (v) => { v.milestones[0].conditions[0].status = "DONE"; }],
      ["partial without reason", (v) => { v.milestones[0].conditions[0].status = "PARTIAL"; }],
      ["PASS without evidence", (v) => { v.milestones[0].conditions[0].status = "PASS"; }],
      ["directory as PASS evidence", (v) => { Object.assign(v.milestones[0].conditions[0], { status: "PASS", evidence: ["evidence"] }); }],
    ];
    for (const [name, change] of cases) {
      await t.test(name, () => {
        const value = fixture();
        change(value);
        const result = run(value);
        assert.notEqual(result.status, 0, result.stdout);
      });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
