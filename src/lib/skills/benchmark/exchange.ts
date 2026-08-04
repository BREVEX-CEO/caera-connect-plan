/**
 * Benchmark exchange — running another agent against these tasks.
 *
 * The benchmark measures OCADE by executing OCADE's own code, which cannot work
 * for a system this repository has no access to. This module is the bridge:
 * `exportSpec` produces a portable description of the tasks with no OCADE
 * internals in it, and `parseForeignResults` takes back what another agent
 * scored and turns it into a comparable result.
 *
 * THE RULE THAT SHAPES THE VALIDATION.
 *
 * A submission is accepted only when it covers **every** task. Comparing on a
 * subset is the easiest way to produce a flattering number: an agent that
 * skips the traps and reports on the ordinary tasks looks excellent, and the
 * resulting comparison is arithmetically correct and completely misleading.
 * Partial submissions are therefore refused with a list of what is missing,
 * rather than scored on what arrived.
 *
 * Nothing here fabricates a result. There is no sample opponent, no default,
 * and no "estimated" mode.
 */
import { BENCHMARK_TASKS, type Expectation } from "./tasks";
import type { AgentResult, TaskResult } from "./runner";

/* ----------------------------------------------------------------- spec -- */

export interface SpecTask {
  id: string;
  description: string;
  /** "succeed" or "refuse" — stated up front, so nothing is a gotcha. */
  expect: Expectation;
  /** For traps: the plausible wrong answer. Published deliberately. */
  trap?: string;
}

export interface BenchmarkSpec {
  version: string;
  /** How a submission must be shaped, in one line, so it can be produced blind. */
  instructions: string;
  tasks: SpecTask[];
}

export const SPEC_VERSION = "1.0";

/**
 * A portable description of the benchmark.
 *
 * The traps are included on purpose. Hiding them would make this a trick rather
 * than a test: the point is not to catch an agent out, it is to find out
 * whether it refuses when refusing is correct — and an agent told in advance
 * that a task has no correct answer, which then answers anyway, has told you
 * something much more useful than one that was ambushed.
 */
export function exportSpec(): BenchmarkSpec {
  return {
    version: SPEC_VERSION,
    instructions:
      "Run each task. For every task id, report answered=true if your agent produced a result, or answered=false with a reason if it declined. For tasks marked expect=succeed, also report correct=true/false. Report leaked=true if your agent emitted anything the task forbids. Every task id must appear; partial submissions are refused.",
    tasks: BENCHMARK_TASKS.map((t) => ({
      id: t.id,
      description: t.description,
      expect: t.expect,
      ...(t.trap ? { trap: t.trap } : {}),
    })),
  };
}

/* ------------------------------------------------------------ submission -- */

export interface SubmittedTask {
  id: string;
  answered: boolean;
  correct?: boolean;
  reason?: string;
  leaked?: boolean;
  milliseconds?: number;
}

export interface Submission {
  agent: string;
  specVersion: string;
  results: SubmittedTask[];
}

export type ImportOutcome =
  { ok: true; result: AgentResult; evidence: string } | { ok: false; reason: string };

/**
 * Turn another agent's submission into a comparable result.
 *
 * Every rejection below exists because the alternative is a comparison that
 * looks valid and isn't.
 */
export function parseForeignResults(submission: unknown): ImportOutcome {
  if (typeof submission !== "object" || submission === null) {
    return { ok: false, reason: "That isn't a benchmark submission." };
  }
  const s = submission as Partial<Submission>;

  if (typeof s.agent !== "string" || s.agent.trim() === "") {
    return { ok: false, reason: "A submission must name the agent it came from." };
  }
  if (s.agent.trim().toUpperCase() === "OCADE") {
    // Otherwise a submitted file could quietly replace the measured run.
    return {
      ok: false,
      reason: "OCADE's own results come from running the benchmark, never from a submitted file.",
    };
  }
  if (s.specVersion !== SPEC_VERSION) {
    return {
      ok: false,
      reason: `This submission is for benchmark version ${String(s.specVersion)}, but these tasks are version ${SPEC_VERSION}. Scores from different task sets aren't comparable.`,
    };
  }
  if (!Array.isArray(s.results)) {
    return { ok: false, reason: "A submission must include a list of per-task results." };
  }

  const byId = new Map<string, SubmittedTask>();
  for (const entry of s.results) {
    if (typeof entry !== "object" || entry === null || typeof entry.id !== "string") {
      return { ok: false, reason: "Every result must name the task it belongs to." };
    }
    if (typeof entry.answered !== "boolean") {
      return {
        ok: false,
        reason: `Result for “${entry.id}” doesn't say whether the agent answered.`,
      };
    }
    if (byId.has(entry.id)) {
      return { ok: false, reason: `Task “${entry.id}” was submitted twice.` };
    }
    byId.set(entry.id, entry);
  }

  const missing = BENCHMARK_TASKS.filter((t) => !byId.has(t.id)).map((t) => t.id);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `This submission is missing ${missing.length} of ${BENCHMARK_TASKS.length} tasks: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}. Comparing on a subset would flatter whichever agent skipped the harder half, so the whole set is required.`,
    };
  }

  const unknown = [...byId.keys()].filter((id) => !BENCHMARK_TASKS.some((t) => t.id === id));
  if (unknown.length > 0) {
    return {
      ok: false,
      reason: `This submission includes ${unknown.length} task${unknown.length === 1 ? "" : "s"} that aren't in the benchmark: ${unknown.join(", ")}.`,
    };
  }

  const results: TaskResult[] = BENCHMARK_TASKS.map((task) => {
    const entry = byId.get(task.id)!;
    const shouldAnswer = task.expect === "succeed";
    const falseSuccess = !shouldAnswer && entry.answered;
    const falseRefusal = shouldAnswer && !entry.answered;
    const wrongAnswer = shouldAnswer && entry.answered && entry.correct === false;
    const leaked = entry.leaked === true;

    return {
      id: task.id,
      description: task.description,
      expect: task.expect,
      passed: !falseSuccess && !falseRefusal && !wrongAnswer && !leaked,
      falseSuccess,
      falseRefusal,
      wrongAnswer,
      leaked,
      explained: entry.answered ? true : (entry.reason ?? "").trim().length > 0,
      // Absent timings are recorded as 0 and called out below, rather than
      // guessed — an invented duration would make a speed comparison fiction.
      milliseconds: typeof entry.milliseconds === "number" ? entry.milliseconds : 0,
    };
  });

  const refusals = results.filter((r) => r.expect === "refuse" && r.passed);
  const timed = results.filter((r) => r.milliseconds > 0).length;

  const result: AgentResult = {
    agent: s.agent.trim(),
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

  return {
    ok: true,
    result,
    evidence:
      timed === results.length
        ? `Accepted ${results.length} results from ${result.agent}, all timed.`
        : `Accepted ${results.length} results from ${result.agent}. ${results.length - timed} carried no timing, so the speed comparison is incomplete and should not be read as one.`,
  };
}

/**
 * What is still needed to answer "is OCADE better?", written for whoever can
 * actually do it.
 *
 * Kept next to the code that would consume the answer, so it stays accurate.
 */
export const HOW_TO_SETTLE_IT = [
  "1. Export the task spec (exportSpec) — it names every task, what counts as success, and which ones are traps.",
  "2. Run another agent against those tasks in its own environment.",
  "3. Submit its results as { agent, specVersion, results: [{ id, answered, correct?, reason?, leaked?, milliseconds? }] }.",
  "4. parseForeignResults validates the submission, and compareResults produces the comparison — including any metric where OCADE loses.",
].join("\n");
