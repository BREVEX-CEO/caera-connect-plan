/** Task progress, the live browser panel, and the controls a person must always reach. */
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Hand, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { FINISHED, plainStep, TASK_STATUS } from "./protocol";
import { readJarvisFrame, type JarvisState, type JarvisTaskRow } from "./jarvis.functions";
import { signLibraryItem } from "@/lib/library/library.functions";
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
    <>
      <button
        type="button"
        onClick={onStop}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-semibold uppercase tracking-wide text-background"
      >
        <Square className="h-3.5 w-3.5" aria-hidden />
        Stop
      </button>
      {task.status === "running" ? (
        <button
          type="button"
          onClick={onTakeOver}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs hover:bg-accent"
        >
          <Hand className="h-3.5 w-3.5" aria-hidden />
          Take Over
        </button>
      ) : (
        <button
          type="button"
          onClick={onResume}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs hover:bg-accent"
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          Resume
        </button>
      )}
    </>
  );
}

export function TaskCard({
  task,
  running,
  using,
  onStop,
  onTakeOver,
  onResume,
  onRetry,
  onRepeat,
  checks = [],
  steps = [],
  latest,
}: {
  task: JarvisTaskRow;
  running: boolean;
  /** What the record says each step did, oldest first: the progress timeline. */
  steps?: string[];
  /** Where the work runs: the computer's name, and the app named with @ if any. */
  using?: string | null;
  onStop: () => void;
  onTakeOver: () => void;
  onResume: () => void;
  /** Ask JARVIS to try a task that failed or could not continue. */
  onRetry?: () => void;
  /** Start the same work again with new inputs, from the composer. */
  onRepeat?: () => void;
  /** What the device read back for this task: receipts, newest first. */
  checks?: string[];
  /** The task's newest recorded activity: the only source of the live stage below. */
  latest?: JarvisState["activity"][number];
}) {
  const [details, setDetails] = useState(false);
  const total = task.plan.length;
  const done = FINISHED.includes(task.status);
  // A step count and bar only where there is a real plan to measure against.
  const step = Math.min(task.current_step + 1, total);
  const progress = total ? Math.round((Math.min(task.current_step, total) / total) * 100) : 0;
  return (
    <section
      aria-label="Task"
      className="ocade-pop rounded-2xl border border-border/70 bg-card p-4"
      data-testid="jarvis-task"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-sm font-medium">{task.title}</h2>
        <span
          className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          data-testid="jarvis-task-status"
        >
          {TASK_STATUS[task.status]}
        </span>
      </div>
      {using ? <p className="mt-1 text-xs text-muted-foreground">Using: {using}</p> : null}
      {!done && total ? (
        <>
          <p className="mt-2 text-xs">
            {task.status === "running" ? "Working" : TASK_STATUS[task.status]} · Step {step} of{" "}
            {total}
          </p>
          <div
            role="progressbar"
            aria-label="Task progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-border/70"
          >
            <div
              className="h-full bg-info transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      ) : null}
      {task.status === "running" && running ? (
        <div className="mt-2">
          <LiveStage task={task} latest={latest} />
        </div>
      ) : null}
      {task.blocker && !done ? <p className="mt-2 text-xs">{task.blocker}</p> : null}
      {done && task.result ? (
        <p className="mt-2 whitespace-pre-wrap text-sm" data-testid="jarvis-task-result">
          {task.result}
        </p>
      ) : null}
      {task.status === "completed" && task.checkpoint?.deliverables?.length ? (
        <ul className="mt-2 space-y-1" aria-label="Files">
          {task.checkpoint.deliverables.map((file) => (
            <Deliverable key={file.id} file={file} />
          ))}
        </ul>
      ) : null}
      {!running && task.status === "running" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          This task is not being worked on in this tab.
        </p>
      ) : null}
      {details ? (
        <div className="mt-3 border-t border-border/60 pt-2 text-xs">
          {steps.length ? (
            <ol aria-label="Progress" className="mb-2 space-y-1 border-l border-border/60 pl-3">
              {steps.map((step, index) => (
                <li key={`${index}-${step}`} className="text-muted-foreground">
                  {plainStep(step)}
                </li>
              ))}
            </ol>
          ) : null}
          {task.plan.length ? (
            <ol className="list-decimal pl-5 text-muted-foreground">
              {task.plan.map((item, index) => (
                <li
                  key={`${index}-${item}`}
                  aria-current={!done && index === task.current_step ? "step" : undefined}
                  className={cn(
                    !done && index === task.current_step && "font-medium text-foreground",
                  )}
                >
                  {item}
                </li>
              ))}
            </ol>
          ) : null}
          {/* JARVIS's own words above; what the device itself read back here. */}
          {done && checks.length ? (
            <div className="mt-2" data-testid="jarvis-task-checks">
              <p className="font-medium">Checked on the device</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {checks.map((check, index) => (
                  <li key={`${index}-${check}`}>{check}</li>
                ))}
              </ul>
            </div>
          ) : done && task.status === "completed" ? (
            <p className="mt-2 text-muted-foreground">
              No device check is recorded for this result.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={details}
          onClick={() => setDetails((open) => !open)}
          className={button}
        >
          {done ? "Details" : "View progress"}
        </button>
        {onRetry && (task.status === "failed" || task.status === "blocked") && !running ? (
          <button type="button" onClick={onRetry} className={button}>
            Try again
          </button>
        ) : null}
        {onRepeat && task.status === "completed" && !running ? (
          <button type="button" onClick={onRepeat} className={button}>
            Repeat with new inputs
          </button>
        ) : null}
        <Controls task={task} onStop={onStop} onTakeOver={onTakeOver} onResume={onResume} />
      </div>
    </section>
  );
}

const button =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs transition-colors duration-150 hover:bg-accent";

/**
 * A finished file kept in the Library: Open in a new tab (opened in the click itself, which is
 * the only time a browser allows it) or Download, each through a fresh short-lived link.
 */
function Deliverable({ file }: { file: { id: string; name: string } }) {
  const [problem, setProblem] = useState<string | null>(null);
  async function get(download: boolean) {
    const tab = download ? null : window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const { url } = await signLibraryItem({ data: { id: file.id, download } });
      if (tab) tab.location.href = url;
      else {
        const link = document.createElement("a");
        link.href = url;
        link.rel = "noopener noreferrer";
        link.click();
      }
    } catch (error) {
      tab?.close();
      setProblem(error instanceof Error ? error.message : "That file could not be opened.");
    }
  }
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{file.name}</span>
      <button type="button" onClick={() => void get(false)} className={button}>
        Open
      </button>
      <button type="button" onClick={() => void get(true)} className={button}>
        Download
      </button>
      {problem ? <span className="w-full text-xs text-destructive">{problem}</span> : null}
    </li>
  );
}

/** Which stage the record shows the task in; never a guess from the clock or the model's words. */
function stageOf(latest: JarvisState["activity"][number] | undefined) {
  if (!latest || latest.status === "note") return "Thinking";
  if (latest.research) return "Searching the web";
  if (latest.status === "failed" || latest.status === "blocked") return "Fixing";
  if (latest.check) return "Checking";
  return "Working";
}

function LiveStage({
  task,
  latest,
}: {
  task: JarvisTaskRow;
  latest?: JarvisState["activity"][number];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - new Date(task.created_at).getTime()) / 1000));
  const failed = latest?.status === "failed" || latest?.status === "blocked";
  return (
    <p className="mb-2 text-xs" data-testid="jarvis-task-live">
      <span aria-live="polite">
        <span className="font-medium">{stageOf(latest)}</span>
        {latest ? (
          <span className={cn(failed ? "text-destructive" : "text-muted-foreground")}>
            {failed ? " · Did not work: " : " · "}
            {plainStep(latest.summary)}
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground">
        {" · "}
        {Math.floor(seconds / 60)} min {seconds % 60} s
      </span>
    </p>
  );
}

export function BrowserPanel({
  task,
  open,
  onToggle,
}: {
  task: JarvisTaskRow;
  open: boolean;
  onToggle: () => void;
}) {
  // Held with the task it shows: another task's picture is never shown under this one.
  const [shown, setShown] = useState<{
    taskId: string;
    frame: string | null;
    at: string | null;
  } | null>(null);
  const frame = shown?.taskId === task.id ? shown.frame : null;
  const at = shown?.taskId === task.id && shown.at ? new Date(shown.at) : null;
  // Older than a few polls, or the task is not running: the picture is history, not "now".
  const stale = !at || Date.now() - at.getTime() > 10_000 || task.status !== "running";
  const when = at ? at.toLocaleTimeString() : null;
  useEffect(() => {
    if (!open) return;
    let live = true;
    const pull = () =>
      readJarvisFrame({ data: { taskId: task.id } })
        .then((value) => live && setShown({ taskId: task.id, frame: value.frame, at: value.at }))
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
      className="glass-strong pointer-events-auto relative z-10 mx-3 mb-2 flex flex-col rounded-xl lg:mx-0 lg:mb-0 lg:mr-3 lg:w-[420px]"
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
            <figure>
              <img
                src={`data:image/jpeg;base64,${frame}`}
                alt={
                  stale
                    ? `What the browser showed at ${when ?? "an unknown time"}`
                    : "What JARVIS currently sees in the browser"
                }
                className={cn("w-full rounded-md border border-border/60", stale && "opacity-60")}
                data-testid="jarvis-live-frame"
              />
              <figcaption
                className="pt-1 text-xs text-muted-foreground"
                data-testid="jarvis-frame-time"
              >
                {stale
                  ? `Not current: captured ${when ?? "at an unknown time"}`
                  : `Live, captured ${when}`}
              </figcaption>
            </figure>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">No live view yet.</p>
          )}
        </div>
      ) : null}
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
      className="ocade-pop rounded-xl border border-foreground/40 bg-background p-3 shadow-lg"
    >
      <p className="mb-2 text-sm [overflow-wrap:anywhere]">{summary}</p>
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
    <div className="glass mb-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs">
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
