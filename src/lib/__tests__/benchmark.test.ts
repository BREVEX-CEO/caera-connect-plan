import { describe, it, expect } from "vitest";
import { BENCHMARK_TASKS } from "../skills/benchmark/tasks";
import {
  runBenchmark,
  compareResults,
  describeResult,
  NO_COMPARISON_RUN,
  type AgentResult,
} from "../skills/benchmark/runner";

/**
 * This is the measurement, not a description of one. The numbers asserted below
 * are produced by executing the benchmark; if OCADE regresses, they change and
 * the suite goes red.
 */

const result = runBenchmark();

describe("the benchmark is a real test, not a formality", () => {
  it("contains traps as well as ordinary work", () => {
    const traps = BENCHMARK_TASKS.filter((t) => t.expect === "refuse");
    const ordinary = BENCHMARK_TASKS.filter((t) => t.expect === "succeed");
    // Neither half may dominate: all-traps rewards refusing everything, and
    // all-ordinary never measures the failure that matters.
    expect(traps.length).toBeGreaterThanOrEqual(8);
    expect(ordinary.length).toBeGreaterThanOrEqual(8);
  });

  it("names the plausible wrong answer for the traps", () => {
    for (const task of BENCHMARK_TASKS.filter((t) => t.expect === "refuse")) {
      expect(task.trap, `${task.id} has no named trap`).toBeTruthy();
      expect(task.trap!.length).toBeGreaterThan(20);
    }
  });

  it("has no duplicate task ids", () => {
    expect(new Set(BENCHMARK_TASKS.map((t) => t.id)).size).toBe(BENCHMARK_TASKS.length);
  });

  /**
   * A harness that scores a crash as anything but a failure would let an agent
   * do well by throwing.
   */
  it("scores a crash as a failure", () => {
    const crashing = runBenchmark([
      {
        id: "boom",
        criterion: "correctness",
        description: "throws",
        expect: "succeed",
        run: () => {
          throw new Error("boom");
        },
      },
    ]);
    expect(crashing.passed).toBe(0);
    expect(crashing.falseRefusals).toBe(1);
  });
});

/* ------------------------------------------------- the measurement itself -- */

describe("OCADE's measured results", () => {
  it("passes every task", () => {
    const failed = result.results.filter((r) => !r.passed);
    expect(failed.map((f) => `${f.id}: ${f.description}`)).toEqual([]);
    expect(result.passed).toBe(result.total);
  });

  /**
   * The headline number. A false success is an answer produced for a question
   * that has no correct answer — the failure that looks identical to success
   * and so survives review.
   */
  it("produces ZERO false successes across every trap", () => {
    expect(result.falseSuccesses).toBe(0);
  });

  it("produces zero wrong answers on the tasks it does complete", () => {
    expect(result.wrongAnswers).toBe(0);
  });

  it("leaks nothing it was told to keep", () => {
    expect(result.leaks).toBe(0);
  });

  /** Refusing without saying why leaves the user unable to act. */
  it("explains every refusal", () => {
    expect(result.explainedRefusals).toBe(result.totalRefusals);
    expect(result.totalRefusals).toBeGreaterThan(8);
  });

  /**
   * Speed is claimed, so it is measured. This runs in-process with no network
   * and no companion, which is the point: the whole battery completes in the
   * time a single network round trip would take.
   */
  it("completes the whole battery in well under a second, offline", () => {
    expect(result.totalMilliseconds).toBeLessThan(1000);
  });

  it("summarises its own results without a comparative claim", () => {
    const line = describeResult(result);
    expect(line).toMatch(/entirely offline/);
    expect(line).toMatch(/0 false successes/);
    expect(line).not.toMatch(/better|superior|parity/i);
  });
});

/* ---------------------------------------------------------- the comparison -- */

describe("comparison against another agent", () => {
  it("works when two agents have genuinely been run", () => {
    // A hypothetical second run, constructed HERE in the test — never by the
    // runner, and never presented as a real measurement of anything.
    const other: AgentResult = {
      ...result,
      agent: "Hypothetical",
      falseSuccesses: 3,
      passed: result.total - 3,
    };
    const diff = compareResults(result, other);
    const falseSuccessRow = diff.find((d) => d.metric === "false successes")!;
    expect(falseSuccessRow.better).toBe("OCADE");
    expect(falseSuccessRow.a).toBe(0);
    expect(falseSuccessRow.b).toBe(3);
  });

  it("calls a tie a tie rather than favouring the home side", () => {
    const diff = compareResults(result, { ...result, agent: "Twin" });
    expect(diff.every((d) => d.better === null)).toBe(true);
  });

  /**
   * The part that matters. Asked to compare against a system nobody has run,
   * the answer is a stated absence — never an estimate, and never an empty
   * result rendered as a favourable one.
   */
  it("states plainly that no competitor has been run", () => {
    expect(NO_COMPARISON_RUN).toMatch(/no comparison to report/i);
    expect(NO_COMPARISON_RUN).toMatch(/would be invented/i);
    // And it points at what would actually settle the question.
    expect(NO_COMPARISON_RUN).toMatch(/running another system against them/i);
  });

  it("offers no default opponent to compare against", () => {
    // compareResults takes two required arguments; there is no one-argument
    // form that could silently invent the other side.
    expect(compareResults.length).toBe(2);
  });
});
