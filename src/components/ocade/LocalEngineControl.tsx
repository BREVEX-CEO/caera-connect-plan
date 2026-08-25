import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  startLocalRuntimeFn,
  stopLocalRuntimeFn,
  localRuntimeStatusFn,
  type LocalRuntimeStatus,
} from "@/lib/local-runtime.functions";

type Phase = "idle" | "checking" | "starting" | "stopping";

export function LocalEngineControl() {
  const [status, setStatus] = useState<LocalRuntimeStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPhase("checking");
    try {
      setStatus(await localRuntimeStatusFn());
      setProblem(null);
    } catch (error) {
      setProblem(`Could not read the engine status: ${String(error)}`);
    } finally {
      setPhase("idle");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = useCallback(async () => {
    setPhase("starting");
    setProblem(null);
    try {
      const result = await startLocalRuntimeFn();
      if (result.ok) {
        toast.success(
          result.alreadyRunning
            ? "OCADE Local Intelligence was already running."
            : "OCADE Local Intelligence is ready.",
        );
      } else {
        setProblem(result.reason);
        toast.error("OCADE Local Intelligence did not start.");
      }
    } catch (error) {
      setProblem(String(error));
      toast.error("OCADE Local Intelligence did not start.");
    } finally {
      setPhase("idle");
      void refresh();
    }
  }, [refresh]);

  const stop = useCallback(async () => {
    setPhase("stopping");
    setProblem(null);
    try {
      const result = await stopLocalRuntimeFn();
      if (result.ok) {
        toast.success(
          result.alreadyStopped
            ? "OCADE Local Intelligence was already stopped."
            : "OCADE Local Intelligence stopped.",
        );
      } else {
        setProblem(result.reason);
        toast.error("OCADE Local Intelligence did not stop.");
      }
    } catch (error) {
      setProblem(String(error));
      toast.error("OCADE Local Intelligence did not stop.");
    } finally {
      setPhase("idle");
      void refresh();
    }
  }, [refresh]);

  const busy = phase !== "idle";
  const running = status?.running === true;
  const installed = status?.binaryFound === true;

  return (
    <section className="rounded-lg border border-border p-4" aria-labelledby="local-engine-heading">
      <h3 id="local-engine-heading" className="text-sm font-medium">
        OCADE Local Intelligence
      </h3>

      <p className="mt-1 text-xs text-muted-foreground">
        Runs only on this device. OCADE manages the local runtime automatically; network addresses,
        process details and engine identifiers stay in Advanced diagnostics.
      </p>

      <p className="mt-2 text-xs" aria-live="polite">
        <span className="font-medium">Status: </span>
        {phase === "checking" && "Checking…"}
        {phase === "starting" && "Starting…"}
        {phase === "stopping" && "Stopping…"}
        {phase === "idle" && status === null && "Unknown"}
        {phase === "idle" && status !== null && (running ? "Ready" : "Stopped")}
      </p>

      {status !== null && !installed && (
        <p className="mt-2 text-xs text-muted-foreground">
          Local Intelligence is not installed on this device yet.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
          onClick={() => void start()}
          disabled={busy || running || !installed}
        >
          {phase === "starting" ? "Starting…" : "Start"}
        </button>

        <button
          type="button"
          className="rounded border border-border px-3 py-1 text-xs disabled:opacity-50"
          onClick={() => void stop()}
          disabled={busy || !running}
        >
          {phase === "stopping" ? "Stopping…" : "Stop"}
        </button>

        <button
          type="button"
          className="rounded border border-border px-3 py-1 text-xs disabled:opacity-50"
          onClick={() => void refresh()}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {problem && (
        <details className="mt-3 text-xs text-destructive">
          <summary className="cursor-pointer">Technical details</summary>
          <p className="mt-1 break-words" role="alert">
            {problem}
          </p>
        </details>
      )}
    </section>
  );
}
