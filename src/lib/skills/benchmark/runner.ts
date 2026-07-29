/**
 * Benchmark runner.
 *
 * Executes `BENCHMARK_TASKS` and reports what actually happened, including the
 * timings. It exists so that a claim about OCADE's behaviour is a number
 * produced by running code, not a sentence someone wrote.
 *
 * ON COMPARING AGENTS.
 *
 * `AgentResult` deliberately has room for more than one agent, and
 * `compareResults` will produce a difference when given two. What this module
 * will NOT do is manufacture the second one. `NO_COMPARISON_RUN` is what a
 * caller gets when it asks for a comparison that nobody has run — a stated
 * absence rather than an estimate.
 *
 * That is not a limitation to be worked around. A benchmark whose comparison
 * figures were guessed would be worse than no benchmark, because it would look
 * exactly like one that had been run.
 */
import { BENCHMARK_TASKS, type BenchmarkTask } from "./tasks";

export interface TaskResult {
  id: string;
  description: string;
  expect: BenchmarkTask["expect"];
  /** True when the agent behaved as the task requires. */
  passed: boolean;
  /**
   * The expensive failure: the task was a trap and the agent answered anyway.
   * Counted separately because a confident wrong answer costs more than a
   * refusal the user has to work around.
   */
  falseSuccess: boolean;
  /** Refused a task it should have completed. Costly, but visibly so. */
  falseRefusal: boolean;
  /** Produced the answer, but the answer was wrong. */
  wrongAnswer: boolean;
  /** Emitted something the task forbids, e.g. a patient identifier. */
  leaked: boolean;
  /** Whether a refusal came with an explanation. A bare "no" is not a refusal. */
  explained: boolean;
  milliseconds: number;
}

export interface AgentResult {
  /** Which system was measured. Never filled in for a system that wasn't run. */
  agent: string;
  results: TaskResult[];
  passed: number;
  total: number;
  falseSuccesses: number;
  falseRefusals: number;
  wrongAnswers: number;
  leaks: number;
  /** Refusals that came with a reason, over all refusals. */
  explainedRefusals: number;
  totalRefusals: number;
  totalMilliseconds: number;
}

function evaluate(task: BenchmarkTask): TaskResult {
  const started = performance.now();
  let outcome;
  try {
    outcome = task.run();
  } catch (e) {
    // A crash is a failure, not an error in the harness — record it as one so
    // an agent cannot score well by throwing.
    const ms = performance.now() - started;
    return {
      id: task.id,
      description: task.description,
      expect: task.expect,
      passed: false,
      falseSuccess: false,
      falseRefusal: task.expect === "succeed",
      wrongAnswer: false,
      leaked: false,
      explained: false,
      milliseconds: ms,
    };
  }
  const milliseconds = performance.now() - started;

  const shouldAnswer = task.expect === "succeed";
  const falseSuccess = !shouldAnswer && outcome.answered;
  const falseRefusal = shouldAnswer && !outcome.answered;
  const wrongAnswer = shouldAnswer && outcome.answered && outcome.correct === false;
  const leaked = outcome.leaked === true;

  return {
    id: task.id,
    description: task.description,
    expect: task.expect,
    passed: !falseSuccess && !falseRefusal && !wrongAnswer && !leaked,
    falseSuccess,
    falseRefusal,
    wrongAnswer,
    leaked,
    // A refusal with no reason leaves the user unable to act, so it is tracked
    // even when the refusal itself was correct.
    explained: outcome.answered ? true : (outcome.reason ?? "").trim().length > 0,
    milliseconds,
  };
}

/** Run the benchmark against OCADE, in-process and offline. */
export function runBenchmark(tasks: BenchmarkTask[] = BENCHMARK_TASKS): AgentResult {
  const results = tasks.map(evaluate);
  const refusals = results.filter((r) => !r.falseSuccess && r.expect === "refuse" && r.passed);

  return {
    agent: "OCADE",
    results,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    falseSuccesses: results.filter((r) => r.falseSuccess).length,
    falseRefusals: results.filter((r) => r.falseRefusal).length,
    wrongAnswers: results.filter((r) => r.wrongAnswer).length,
    leaks: results.filter((r) => r.leaked).length,
    explainedRefusals: refusals.filter((r) => r.explained).length,
    totalRefusals: refusals.length,
    totalMilliseconds: results.reduce((a, r) => a + r.milliseconds, 0),
  };
}

/* ------------------------------------------------------------ comparison -- */

export interface Comparison {
  metric: string;
  a: number;
  b: number;
  /** Which side is better on this metric, or null when they tie. */
  better: string | null;
}

/**
 * Compare two agents that have BOTH actually been run.
 *
 * There is no default for the second argument on purpose. A comparison against
 * an absent agent is not a comparison.
 */
export function compareResults(a: AgentResult, b: AgentResult): Comparison[] {
  const lowerIsBetter = (metric: string, x: number, y: number): Comparison => ({
    metric,
    a: x,
    b: y,
    better: x === y ? null : x < y ? a.agent : b.agent,
  });
  const higherIsBetter = (metric: string, x: number, y: number): Comparison => ({
    metric,
    a: x,
    b: y,
    better: x === y ? null : x > y ? a.agent : b.agent,
  });

  return [
    higherIsBetter("tasks passed", a.passed, b.passed),
    lowerIsBetter("false successes", a.falseSuccesses, b.falseSuccesses),
    lowerIsBetter("false refusals", a.falseRefusals, b.falseRefusals),
    lowerIsBetter("wrong answers", a.wrongAnswers, b.wrongAnswers),
    lowerIsBetter("privacy leaks", a.leaks, b.leaks),
    lowerIsBetter("total milliseconds", a.totalMilliseconds, b.totalMilliseconds),
  ];
}

/**
 * What OCADE says when asked how it compares to a system nobody has run.
 *
 * Exported as a constant so the wording cannot drift, and so a caller cannot
 * accidentally render an empty comparison as a favourable one.
 */
export const NO_COMPARISON_RUN =
  "No other agent has been run against this benchmark from this repository, so there is no comparison to report. The tasks are here and the runner is deterministic: running another system against them would produce a real answer. Until that happens, any parity or superiority figure would be invented, and this benchmark exists precisely to make that unnecessary.";

/** A plain summary of one agent's own results. Makes no comparative claim. */
export function describeResult(r: AgentResult): string {
  const parts = [
    `${r.passed} of ${r.total} tasks passed in ${r.totalMilliseconds.toFixed(1)} ms, entirely offline.`,
    `${r.falseSuccesses} false success${r.falseSuccesses === 1 ? "" : "es"} (answering where no correct answer exists).`,
    `${r.wrongAnswers} wrong answer${r.wrongAnswers === 1 ? "" : "s"}, ${r.leaks} privacy leak${r.leaks === 1 ? "" : "s"}.`,
  ];
  if (r.totalRefusals > 0) {
    parts.push(`${r.explainedRefusals} of ${r.totalRefusals} refusals came with a reason.`);
  }
  return parts.join(" ");
}
