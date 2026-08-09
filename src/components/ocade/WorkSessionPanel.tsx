import { useMemo } from "react";
import { Activity, Undo2, Gauge, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  initialHealth,
  recordOutcome,
  describeHealth,
  markStep,
  describeResume,
  type AdapterHealth,
  type ResumableJob,
} from "@/lib/skills/adapter-health";
import {
  redactReplay,
  describeUndo,
  recordableInputs,
  captureMaskFor,
  REPLAY_CONTROLS,
  type InputEvent,
  type ReplayControl,
  type ReplayStep,
} from "@/lib/skills/session-recording";
import type { TaskScope } from "@/lib/skills/task-scope";
import { describeMethod, type ControlMethod } from "@/lib/skills/skill-pack";

/**
 * The live work session: what OCADE is doing on this machine right now.
 *
 * Everything shown here is derived from the real decision layers — adapter
 * health, the resumable job, the redacted replay log. Nothing is illustrative:
 * if a value isn't known, the panel says so rather than showing a placeholder.
 */
export function WorkSessionPanel({
  scope,
  onScopeChange,
  job,
  onJobChange,
  health,
  inputs,
  protectedFieldIds,
  replay = [],
  controls = {},
}: {
  scope: TaskScope | null;
  onScopeChange: (s: TaskScope) => void;
  job: ResumableJob | null;
  onJobChange: (j: ResumableJob) => void;
  health: Map<ControlMethod, AdapterHealth>;
  /** Raw input stream; filtered before anything is displayed. */
  inputs: InputEvent[];
  /** Fields detected as protected on the current screen. */
  protectedFieldIds: string[];
  /** Host-produced replay steps. Synthetic UI entries are never accepted. */
  replay?: ReplayStep[];
  /** Only controls backed by the active runtime are enabled. */
  controls?: Partial<Record<ReplayControl, () => void | Promise<void>>>;
}) {
  // Only inputs that may be shown ever reach the DOM.
  const shownInputs = useMemo(() => recordableInputs(inputs), [inputs]);
  const mask = useMemo(() => captureMaskFor(protectedFieldIds), [protectedFieldIds]);
  // Redacted before render, not before export — the panel is a surface too.
  const safeReplay = useMemo(() => redactReplay(replay), [replay]);
  const undoSummary = describeUndo(replay);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <Activity className="h-4 w-4" aria-hidden /> Work session
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Exactly what OCADE is doing on this computer, and how to stop or undo it.
        </p>
      </div>

      {/* Job progress and resume */}
      {job ? (
        <section className="rounded-lg border border-border/60 p-3" aria-label="Task progress">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Progress
          </h3>
          <p className="text-[12px]">{describeResume(job)}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {job.steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-[11px]">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    s.status === "done" && "bg-[color:var(--state-success)]",
                    s.status === "failed" && "bg-destructive",
                    s.status === "pending" && "bg-muted-foreground/50",
                    s.status === "skipped" && "bg-[color:var(--state-warning)]",
                  )}
                />
                <span className={cn(s.status === "done" && "text-muted-foreground line-through")}>
                  {s.summary}
                </span>
                {s.status === "failed" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-6 px-2 text-[10px]"
                    onClick={() => onJobChange(markStep(job, s.id, "skipped"))}
                  >
                    Skip
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Adapter health — why OCADE chose the route it did */}
      <section className="rounded-lg border border-border/60 p-3" aria-label="Connection health">
        <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" aria-hidden /> Routes
        </h3>
        {health.size === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No route has been used yet, so there's nothing to report.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...health.entries()].map(([method, h]) => (
              <li key={method} className="flex items-start gap-2 text-[11px]">
                <span
                  className={cn(
                    "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    h.state === "healthy" && "bg-[color:var(--state-success)]",
                    h.state === "degraded" && "bg-[color:var(--state-warning)]",
                    h.state === "failing" && "bg-destructive",
                    h.state === "unknown" && "bg-muted-foreground/40",
                  )}
                />
                <span className="capitalize">{describeMethod(method)}</span>
                <span className="ml-auto text-right text-muted-foreground">
                  {describeHealth(h)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Keys shown — never content */}
      <section className="rounded-lg border border-border/60 p-3" aria-label="Input activity">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Keys used
        </h3>
        {shownInputs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No keys to show.</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {shownInputs.slice(-12).map((e, i) => (
              <li key={i} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                {e.label}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Only navigation and command keys appear here. What you type is never recorded, and{" "}
          {mask.reason.toLowerCase()}
        </p>
      </section>

      {/* Replay and undo */}
      <section className="rounded-lg border border-border/60 p-3" aria-label="Replay">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Replay
        </h3>
        {safeReplay.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nothing has run yet.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {safeReplay.map((s) => (
              <li key={s.index} className="flex items-start gap-2 text-[11px]">
                <span className="text-muted-foreground tabular-nums">{s.index}.</span>
                <span className="flex-1">{s.summary}</span>
                {!s.undoable ? (
                  <span className="text-[10px] text-muted-foreground">can't undo</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">{undoSummary}</p>

        <div className="mt-2 flex flex-wrap gap-1">
          {REPLAY_CONTROLS.map((c) => (
            <Button
              key={c}
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              disabled={!controls[c]}
              title={
                controls[c]
                  ? undefined
                  : `${c.replace("_", " ")} is unavailable until the active runtime provides it.`
              }
              onClick={() => void controls[c]?.()}
            >
              {c === "undo" ? <Undo2 className="mr-1 h-3 w-3" /> : null}
              {c === "emergency_stop" ? <Square className="mr-1 h-3 w-3" /> : null}
              {c === "resume" ? <Play className="mr-1 h-3 w-3" /> : null}
              {c.replace("_", " ")}
            </Button>
          ))}
        </div>
        {Object.keys(controls).length === 0 ? (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Runtime controls are unavailable. Connect a capable companion to pause, cancel, undo, or
            replay work.
          </p>
        ) : null}
      </section>
    </div>
  );
}
