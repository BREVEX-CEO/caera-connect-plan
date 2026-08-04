import { describe, it, expect } from "vitest";
import {
  exportSpec,
  parseForeignResults,
  SPEC_VERSION,
  HOW_TO_SETTLE_IT,
  type Submission,
} from "../skills/benchmark/exchange";
import { BENCHMARK_TASKS } from "../skills/benchmark/tasks";
import { runBenchmark, compareResults } from "../skills/benchmark/runner";

/**
 * The exchange is what makes the comparison possible for someone who has access
 * to another agent. These tests prove it accepts a genuine submission, produces
 * a real comparison from it — including one OCADE loses — and refuses every
 * shape of submission that would yield a misleading result.
 */

/** A complete submission, built by transforming the spec — never hand-listed. */
function submission(
  agent: string,
  transform: (
    id: string,
    expect: string,
  ) => Partial<{
    answered: boolean;
    correct: boolean;
    reason: string;
    leaked: boolean;
    milliseconds: number;
  }> = () => ({}),
): Submission {
  return {
    agent,
    specVersion: SPEC_VERSION,
    results: exportSpec().tasks.map((t) => ({
      id: t.id,
      // A perfect default: answers what it should, refuses what it should.
      answered: t.expect === "succeed",
      correct: t.expect === "succeed" ? true : undefined,
      reason: t.expect === "refuse" ? "Declined: no correct answer exists." : undefined,
      milliseconds: 5,
      ...transform(t.id, t.expect),
    })),
  };
}

describe("the spec can be handed to another agent", () => {
  it("describes every task without exposing OCADE internals", () => {
    const spec = exportSpec();
    expect(spec.tasks).toHaveLength(BENCHMARK_TASKS.length);
    expect(JSON.stringify(spec)).not.toMatch(/parseCsv|checkScope|PackRegistry/);
  });

  /**
   * Publishing the traps is deliberate. An agent told in advance that a task
   * has no correct answer, which then answers anyway, has told you far more
   * than one that was ambushed.
   */
  it("publishes the traps rather than hiding them", () => {
    const traps = exportSpec().tasks.filter((t) => t.expect === "refuse");
    expect(traps.length).toBeGreaterThanOrEqual(8);
    for (const t of traps) expect(t.trap).toBeTruthy();
  });

  it("says how to submit results", () => {
    expect(exportSpec().instructions).toMatch(/Every task id must appear/i);
    expect(exportSpec().instructions).toMatch(/partial submissions are refused/i);
  });

  it("is serialisable, so it can actually be sent somewhere", () => {
    expect(() => JSON.parse(JSON.stringify(exportSpec()))).not.toThrow();
  });
});

describe("a genuine submission produces a real comparison", () => {
  it("accepts a complete submission and scores it", () => {
    const r = parseForeignResults(submission("Another agent"));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.result.total).toBe(BENCHMARK_TASKS.length);
    expect(r.result.passed).toBe(BENCHMARK_TASKS.length);
    expect(r.evidence).toMatch(/all timed/);
  });

  it("counts a trap that was answered as a false success", () => {
    const careless = submission("Careless agent", (_id, expect) =>
      expect === "refuse" ? { answered: true } : {},
    );
    const r = parseForeignResults(careless);
    if (!r.ok) throw new Error("unreachable");
    expect(r.result.falseSuccesses).toBeGreaterThanOrEqual(8);
    expect(r.result.passed).toBeLessThan(r.result.total);
  });

  it("compares an imported agent against OCADE's measured run", () => {
    const careless = parseForeignResults(
      submission("Careless agent", (_id, expect) =>
        expect === "refuse" ? { answered: true } : {},
      ),
    );
    if (!careless.ok) throw new Error("unreachable");

    const diff = compareResults(runBenchmark(), careless.result);
    const falseSuccesses = diff.find((d) => d.metric === "false successes")!;
    expect(falseSuccesses.a).toBe(0);
    expect(falseSuccesses.better).toBe("OCADE");
  });

  /**
   * The test that keeps this honest: the comparison must be capable of saying
   * OCADE lost. A harness that can only report favourably isn't a measurement.
   */
  it("reports OCADE as the loser when the other agent is faster", () => {
    const quick = parseForeignResults(submission("Quick agent", () => ({ milliseconds: 0.001 })));
    if (!quick.ok) throw new Error("unreachable");

    const diff = compareResults(runBenchmark(), quick.result);
    const speed = diff.find((d) => d.metric === "total milliseconds")!;
    expect(speed.better).toBe("Quick agent");
  });

  it("says plainly when timings are missing, instead of inventing them", () => {
    const untimed = parseForeignResults(
      submission("Untimed agent", () => ({ milliseconds: undefined })),
    );
    if (!untimed.ok) throw new Error("unreachable");
    expect(untimed.evidence).toMatch(/should not be read as one/i);
    expect(untimed.result.totalMilliseconds).toBe(0);
  });

  it("treats an unexplained refusal as unexplained", () => {
    const terse = parseForeignResults(
      submission("Terse agent", (_id, expect) => (expect === "refuse" ? { reason: "" } : {})),
    );
    if (!terse.ok) throw new Error("unreachable");
    expect(terse.result.explainedRefusals).toBe(0);
    expect(terse.result.totalRefusals).toBeGreaterThan(0);
  });
});

describe("submissions that would mislead are refused", () => {
  /**
   * The most important refusal. An agent that reports only the tasks it did
   * well on scores brilliantly, and the arithmetic is correct throughout.
   */
  it("refuses a partial submission, naming what's missing", () => {
    const partial = submission("Selective agent");
    partial.results = partial.results.filter((r) => !r.id.startsWith("trap."));

    const r = parseForeignResults(partial);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/missing \d+ of \d+ tasks/);
    expect(r.reason).toMatch(/flatter whichever agent skipped/i);
  });

  it("refuses results for tasks that aren't in the benchmark", () => {
    const padded = submission("Inventive agent");
    padded.results.push({ id: "task.invented", answered: true });
    const r = parseForeignResults(padded);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/aren't in the benchmark/i);
  });

  it("refuses a duplicate task rather than taking the last one", () => {
    const doubled = submission("Repeating agent");
    doubled.results.push({ ...doubled.results[0] });
    const r = parseForeignResults(doubled);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/submitted twice/i);
  });

  it("refuses a submission for a different version of the tasks", () => {
    const stale = { ...submission("Old agent"), specVersion: "0.9" };
    const r = parseForeignResults(stale);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/aren't comparable/i);
  });

  /** OCADE's own number must come from running, never from a file. */
  it("refuses a submission claiming to be OCADE", () => {
    const spoof = { ...submission("OCADE") };
    const r = parseForeignResults(spoof);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/never from a submitted file/i);
  });

  it("refuses malformed input rather than scoring what it can read", () => {
    for (const bad of [
      null,
      "a string",
      42,
      {},
      { agent: "x" },
      { agent: "", specVersion: SPEC_VERSION, results: [] },
    ]) {
      expect(parseForeignResults(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("refuses a result that doesn't say whether the agent answered", () => {
    const vague = submission("Vague agent");
    // @ts-expect-error deliberately malformed, which is the point of the test
    vague.results[0].answered = undefined;
    const r = parseForeignResults(vague);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/doesn't say whether the agent answered/i);
  });
});

describe("the remaining step is documented where it will be read", () => {
  it("spells out what would settle the comparison", () => {
    expect(HOW_TO_SETTLE_IT).toMatch(/exportSpec/);
    expect(HOW_TO_SETTLE_IT).toMatch(/parseForeignResults/);
    expect(HOW_TO_SETTLE_IT).toMatch(/including any metric where OCADE loses/i);
  });
});
