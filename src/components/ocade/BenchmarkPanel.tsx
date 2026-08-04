import { useState } from "react";
import { Gauge, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { BENCHMARK_TASKS } from "@/lib/skills/benchmark/tasks";
import {
  runBenchmark,
  describeResult,
  NO_COMPARISON_RUN,
  type AgentResult,
} from "@/lib/skills/benchmark/runner";
import { exportSpec, SPEC_VERSION } from "@/lib/skills/benchmark/exchange";

/**
 * The benchmark, run on the user's own device when they ask for it.
 *
 * Three deliberate choices, each of which a test pins:
 *
 *  - It does NOT run on mount. A benchmark that runs itself and displays a
 *    green number is decoration; one the user triggers is a measurement they
 *    watched happen.
 *  - Failures are listed BY NAME. A summary that showed only a pass count would
 *    let a regression hide behind a good-looking headline.
 *  - `NO_COMPARISON_RUN` appears with the results, so an impressive score is
 *    never left sitting where it reads as "better than the alternatives".
 */
export function BenchmarkPanel() {
  const [result, setResult] = useState<AgentResult | null>(null);
  const [running, setRunning] = useState(false);
  const [spec, setSpec] = useState<string | null>(null);

  const traps = BENCHMARK_TASKS.filter((t) => t.expect === "refuse").length;

  function run() {
    setRunning(true);
    // Synchronous and fast, but the flag makes the state honest if that changes.
    const outcome = runBenchmark();
    setResult(outcome);
    setRunning(false);
  }

  const failures = result?.results.filter((r) => !r.passed) ?? [];

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Gauge className="h-4 w-4" aria-hidden /> Run the benchmark yourself
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        {BENCHMARK_TASKS.length} tasks, {traps} of them traps where the only correct answer is to
        refuse. Runs here, offline, in milliseconds — nothing is precomputed.
      </p>

      <Button size="sm" className="h-8" onClick={run} disabled={running}>
        {result ? "Run it again" : "Run it now"}
      </Button>

      {result ? (
        <div role="status" className="mt-3 rounded-lg border border-border/60 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {failures.length === 0 ? (
              <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--state-success)]" aria-hidden />
            ) : (
              <AlertTriangle
                className="h-3.5 w-3.5 text-[color:var(--state-warning)]"
                aria-hidden
              />
            )}
            {failures.length === 0
              ? "Every task passed"
              : `${failures.length} task${failures.length === 1 ? "" : "s"} failed`}
          </p>

          <p className="mt-1 text-muted-foreground">{describeResult(result)}</p>

          {/* Named individually. A count alone gives nowhere to start. */}
          {failures.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {failures.map((f) => (
                <li key={f.id} className="text-[11px] text-[color:var(--state-warning)]">
                  {f.description} —{" "}
                  {f.falseSuccess
                    ? "answered when the only correct response was to refuse"
                    : f.leaked
                      ? "emitted something it was told to keep"
                      : f.wrongAnswer
                        ? "answered incorrectly"
                        : "did not complete"}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            {NO_COMPARISON_RUN}
          </p>
        </div>
      ) : null}

      {/*
       * The way OUT of "no comparison run".
       *
       * The benchmark measures OCADE by executing OCADE's own code, which
       * cannot work for a system this repository has no access to. Exporting
       * the spec is what makes a real comparison possible: another agent runs
       * the same tasks, including the traps, and reports back. There is no
       * sample opponent and no estimated score here — an invented rival is
       * worse than no comparison at all.
       */}
      <div className="mt-3 border-t border-border/60 pt-3">
        <p className="text-[11px] font-medium">Compare against another agent</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Export the tasks in a portable form, run them elsewhere, and bring the results back. The
          traps are included deliberately: an agent warned that a task has no correct answer, which
          answers anyway, has told you more than one that was ambushed.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => setSpec(JSON.stringify(exportSpec(), null, 2))}
        >
          Export benchmark spec (v{SPEC_VERSION})
        </Button>
        {spec ? (
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border/70 p-2 text-[10px]">
            {spec}
          </pre>
        ) : null}
      </div>
    </GlassPanel>
  );
}
