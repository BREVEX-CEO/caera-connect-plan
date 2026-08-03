import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  startLocalRuntimeFn,
  stopLocalRuntimeFn,
  localRuntimeStatusFn,
  type LocalRuntimeStatus,
} from "@/lib/local-runtime.functions";

/**
 * Production owner for the OCADE Local Engine supervisor (B1).
 *
 * Before this, every local-engine surface assumed the runtime was already
 * listening — which meant local mode worked only for someone who had already
 * opened a terminal and started it by hand. That is exactly the manual step the
 * product exists to remove, and it is the reason this control exists rather
 * than a line in the documentation telling the user to run a command.
 *
 * The engine is only ever bound to loopback. That is not enforced here — the
 * server function does not accept a bind address at all, and the supervisor
 * refuses anything that is not loopback — but it is STATED here, because a user
 * deciding whether to start a local AI server is entitled to know it will not
 * be reachable from the rest of their network.
 */

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
      // A status probe that fails is reported, not swallowed into "stopped" —
      // "we could not tell" and "it is not running" are different facts.
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
            ? "OCADE Local Engine was already running."
            : `OCADE Local Engine started in ${(result.waitedMs / 1000).toFixed(1)}s.`,
        );
      } else {
        // Failures name the specific cause; a generic "failed to start" would
        // leave a user with no idea whether to install something, free a port,
        // or wait longer.
        setProblem(result.reason);
        toast.error("The local engine did not start.");
      }
    } catch (error) {
      setProblem(String(error));
      toast.error("The local engine did not start.");
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
            ? "OCADE Local Engine was already stopped."
            : "OCADE Local Engine stopped.",
        );
      } else {
        setProblem(result.reason);
        toast.error("The local engine did not stop.");
      }
    } catch (error) {
      setProblem(String(error));
      toast.error("The local engine did not stop.");
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
        OCADE Local Engine
      </h3>

      <p className="mt-1 text-xs text-muted-foreground">
        Runs on this machine and listens on {status?.baseUrl ?? "127.0.0.1:11434"} only. Nothing it
        does is reachable from your network, and no prompt sent to it leaves this computer.
      </p>

      <p className="mt-2 text-xs" aria-live="polite">
        <span className="font-medium">Status: </span>
        {phase === "checking" && "Checking…"}
        {phase === "starting" && "Starting…"}
        {phase === "stopping" && "Stopping…"}
        {phase === "idle" && status === null && "Unknown"}
        {phase === "idle" && status !== null && (running ? "Running" : "Stopped")}
      </p>

      {status !== null && !installed && (
        <p className="mt-2 text-xs text-muted-foreground">
          The engine is not installed in any location OCADE recognises, so it cannot be started from
          here. OCADE will not search your PATH for it — that would let anything with a matching
          name be launched.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
          onClick={() => void start()}
          disabled={busy || running || !installed}
        >
          {phase === "starting" ? "Starting…" : "Start engine"}
        </button>

        <button
          type="button"
          className="rounded border border-border px-3 py-1 text-xs disabled:opacity-50"
          onClick={() => void stop()}
          disabled={busy || !running}
        >
          {phase === "stopping" ? "Stopping…" : "Stop engine"}
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
        <p className="mt-3 text-xs text-destructive" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
