/** Task progress, the live browser panel, and the controls a person must always reach. */
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Hand, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { FINISHED, TASK_STATUS } from "./protocol";
import { readJarvisFrame, type JarvisTaskRow } from "./jarvis.functions";
import type { JarvisVoice } from "./use-voice";

function Controls({
  task,
  onStop,
  onTakeOver,
  onResume,
}: {
  task: JarvisTaskRow;
  onStop: () => void;
  onTakeOver: () => void;
  onResume: () => void;
}) {
  if (FINISHED.includes(task.status)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onStop}
        className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
      >
        <Square className="h-3.5 w-3.5" aria-hidden />
        Stop
      </button>
      {task.status === "running" ? (
        <button
          type="button"
          onClick={onTakeOver}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
        >
          <Hand className="h-3.5 w-3.5" aria-hidden />
          Take Over
        </button>
      ) : (
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          Resume
        </button>
      )}
    </div>
  );
}

export function TaskCard({
  task,
  running,
  onStop,
  onTakeOver,
  onResume,
  onRetry,
}: {
  task: JarvisTaskRow;
  running: boolean;
  onStop: () => void;
  onTakeOver: () => void;
  onResume: () => void;
  /** Ask JARVIS to try a task that failed or could not continue. */
  onRetry?: () => void;
}) {
  const total = Math.max(1, task.plan.length);
  const done = FINISHED.includes(task.status);
  // A percentage only where there is a real plan to measure against.
  const measurable = task.plan.length > 0 && task.status !== "completed";
  const progress = Math.round((Math.min(task.current_step, total) / total) * 100);
  return (
    <section aria-label="Task" className="glass-strong rounded-xl p-3" data-testid="jarvis-task">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-medium">{task.title}</h2>
        <span className="shrink-0 text-xs text-muted-foreground" data-testid="jarvis-task-status">
          {TASK_STATUS[task.status]}
        </span>
      </div>
      {measurable && !done ? (
        <div
          role="progressbar"
          aria-label="Task progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mb-2 h-1 overflow-hidden rounded-full bg-border/70"
        >
          <div
            className="h-full bg-info transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {/* A finished task shows its outcome, not its plan. */}
      {task.plan.length && !done ? (
        <ol className="mb-2 list-decimal pl-5 text-xs text-muted-foreground">
          {task.plan.map((step, index) => (
            <li
              key={`${index}-${step}`}
              aria-current={!done && index === task.current_step ? "step" : undefined}
              className={cn(!done && index === task.current_step && "font-medium text-foreground")}
            >
              {step}
            </li>
          ))}
        </ol>
      ) : null}
      {task.blocker && !done ? <p className="mb-2 text-xs">{task.blocker}</p> : null}
      {done && task.result ? (
        <p className="mb-2 whitespace-pre-wrap text-xs" data-testid="jarvis-task-result">
          {task.result}
        </p>
      ) : null}
      {!running && task.status === "running" ? (
        <p className="mb-2 text-xs text-muted-foreground">
          This task is not being worked on in this tab.
        </p>
      ) : null}
      <Controls task={task} onStop={onStop} onTakeOver={onTakeOver} onResume={onResume} />
      {onRetry && (task.status === "failed" || task.status === "blocked") && !running ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}

export function BrowserPanel({
  task,
  open,
  onToggle,
  onStop,
  onTakeOver,
  onResume,
}: {
  task: JarvisTaskRow;
  open: boolean;
  onToggle: () => void;
  onStop: () => void;
  onTakeOver: () => void;
  onResume: () => void;
}) {
  const [frame, setFrame] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    const pull = () =>
      readJarvisFrame({ data: { taskId: task.id } })
        .then((value) => live && setFrame(value.frame))
        .catch(() => undefined);
    void pull();
    const timer = window.setInterval(pull, 1500);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [open, task.id]);

  return (
    <aside
      aria-label="Live browser"
      className="pointer-events-auto relative z-10 mx-3 mb-2 flex flex-col rounded-xl border border-border/60 bg-background/90 lg:mx-0 lg:mb-0 lg:mr-3 lg:w-[420px]"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <h2 className="text-sm font-medium">
          {task.browser_mode === "real" ? "Your browser" : "JARVIS browser"}
        </h2>
        <div className="flex-1" />
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Collapse live browser" : "Expand live browser"}
          onClick={onToggle}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          {open ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      {open ? (
        <div className="px-3">
          {frame ? (
            <img
              src={`data:image/jpeg;base64,${frame}`}
              alt="What JARVIS currently sees in the browser"
              className="w-full rounded-md border border-border/60"
              data-testid="jarvis-live-frame"
            />
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">No live view yet.</p>
          )}
        </div>
      ) : null}
      <div className="p-3">
        <Controls task={task} onStop={onStop} onTakeOver={onTakeOver} onResume={onResume} />
      </div>
    </aside>
  );
}

export function ConfirmBanner({
  summary,
  onDecide,
}: {
  summary: string;
  onDecide: (ok: boolean) => void;
}) {
  return (
    <section
      role="alertdialog"
      aria-label="Confirm this step"
      className="rounded-xl border border-foreground/40 bg-background p-3"
    >
      <p className="mb-2 text-sm">{summary}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDecide(true)}
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => onDecide(false)}
          className="rounded-md border border-border px-3 py-1.5 text-xs"
        >
          Decline
        </button>
      </div>
    </section>
  );
}

export function TakeOverBanner({
  reason,
  onResume,
  onStop,
}: {
  reason: string;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <section
      role="alert"
      aria-label="You have control"
      className="rounded-xl border border-foreground/40 bg-background p-3"
    >
      <p className="mb-2 text-sm">{reason}</p>
      <p className="mb-2 text-xs text-muted-foreground">
        JARVIS is paused. When you are done, it will look at the page again before doing anything.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onResume}
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={onStop}
          className="rounded-md border border-border px-3 py-1.5 text-xs"
        >
          Stop
        </button>
      </div>
    </section>
  );
}

const VOICE_WORDS = {
  off: "Voice off",
  starting: "Starting…",
  listening: "Listening",
  speaking: "Speaking",
  paused: "Paused",
} as const;

export function VoiceBar({
  voice,
  wake,
  onWake,
  speak,
  onSpeak,
}: {
  voice: JarvisVoice;
  wake: boolean;
  onWake: (wake: boolean) => void;
  speak: boolean;
  onSpeak: (speak: boolean) => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs">
      <span role="status" className="font-medium">
        {VOICE_WORDS[voice.state]}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={voice.interrupt}
        className="rounded-md border border-border px-2 py-1"
      >
        Interrupt
      </button>
      {voice.state === "paused" ? (
        <button
          type="button"
          onClick={voice.resume}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1"
        >
          <Play className="h-3 w-3" aria-hidden />
          Continue
        </button>
      ) : (
        <button
          type="button"
          onClick={voice.pause}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1"
        >
          <Pause className="h-3 w-3" aria-hidden />
          Pause
        </button>
      )}
      <button
        type="button"
        onClick={voice.end}
        className="rounded-md bg-foreground px-2 py-1 text-background"
      >
        End
      </button>
      {voice.speaks ? (
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={speak}
            onChange={(event) => onSpeak(event.target.checked)}
          />
          Speak answers
        </label>
      ) : null}
      <label
        className={
          voice.wakeLocal ? "flex items-center gap-1.5" : "flex items-center gap-1.5 opacity-50"
        }
        title={
          voice.wakeLocal
            ? undefined
            : "This browser cannot listen for “Hey OCADE” on the device, so it stays off."
        }
      >
        <input
          type="checkbox"
          checked={wake && voice.wakeLocal}
          disabled={!voice.wakeLocal}
          onChange={(event) => onWake(event.target.checked)}
        />
        Only after “Hey OCADE”
      </label>
    </div>
  );
}
