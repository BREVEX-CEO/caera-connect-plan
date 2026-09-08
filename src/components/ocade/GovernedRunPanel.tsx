import { useState } from "react";
import { GitBranch, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import { createDefaultExecutors } from "@/lib/skills/default-executors";
import { PackRegistry } from "@/lib/skills/pack-registry";
import { createTaskScope } from "@/lib/skills/task-scope";
import { runAndRecord, type GovernedRunResult, type GovernedStep } from "@/lib/skills/governed-run";
import type { AdapterHealth } from "@/lib/skills/adapter-health";
import type { ControlMethod, SkillCapability } from "@/lib/skills/skill-pack";

/**
 * The whole governed pipeline, on one button.
 *
 * plan → govern confidence → require recovery → execute → receipt → save as an
 * Evidence Ledger artifact. Every number shown comes from running the real
 * orchestrator against the real data executors — nothing is illustrative.
 *
 * The second button demonstrates halt-on-block: the same task under an approval
 * that doesn't cover it stops at step one and records why, rather than pressing
 * on. Showing the stop is the point.
 */

const CSV = "region,amount\nNorth,120\nSouth,80\nEast,40";

const parseCap = (registry: PackRegistry): SkillCapability | null =>
  registry.get("ocade.data")?.capabilities.find((c) => c.id === "data.parse_csv") ?? null;

async function runDemo(granted: boolean): Promise<GovernedRunResult | { error: string }> {
  const registry = new PackRegistry();
  const pack = registry.get("ocade.data");
  const capability = parseCap(registry);
  if (!pack || !capability) return { error: "The data pack isn't available." };

  const step: GovernedStep = {
    action: { kind: "file.open", path: "memory/table" },
    capability,
    app: { appId: pack.appId, displayName: pack.displayName, version: "1.0" },
    // Reading data needs no recovery — it changes nothing.
    risk: "read",
    recovery: [],
    canReobserve: false,
  };

  const result = await runAndRecord({
    taskId: `demo-${Date.now()}`,
    intent: "Read the pasted data",
    initialState: "CSV pasted, nothing parsed",
    finalState: "CSV parsed and its shape reported",
    steps: [step],
    packs: registry.list(),
    // When not granted, the scope covers a different capability, so planning
    // this step is refused and the run halts — honestly.
    scope: createTaskScope({
      id: "scope-refusal-example",
      summary: granted ? "Read the pasted data" : "Something else entirely",
      capabilities: granted ? ["file.open"] : ["clipboard.read"],
      paths: ["memory"],
    }),
    health: new Map<ControlMethod, AdapterHealth>(),
    availableMethods: ["file"],
    recording: "video_off",
    registry: createDefaultExecutors(() => ({ text: CSV })),
  });

  if (!result.ok) return { error: result.reason };
  return result.data;
}

export function GovernedRunPanel() {
  const [result, setResult] = useState<GovernedRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function run(granted: boolean) {
    setRunning(true);
    setError(null);
    setResult(null);
    const outcome = await runDemo(granted);
    if ("error" in outcome) setError(outcome.error);
    else setResult(outcome);
    setRunning(false);
  }

  const halted = result && result.haltedAt !== -1;
  const receiptFailed = result?.receiptRecording.status === "failed";
  const fullyRecorded =
    result?.ledger.outcome === "succeeded" && result.receiptRecording.status === "saved";

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <GitBranch className="h-4 w-4" aria-hidden /> Run a governed task
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        One button runs the whole contract: plan and check the approval, govern the confidence,
        require a recovery path, execute, verify, and save a receipt to Artifacts. The second runs
        the same task under an approval that doesn&rsquo;t cover it — and stops at the first step
        rather than pressing on.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-8" disabled={running} onClick={() => void run(true)}>
          {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          Run it
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={running}
          onClick={() => void run(false)}
        >
          Run one that isn&rsquo;t allowed
        </Button>
      </div>

      {error ? (
        <p role="status" className="mt-3 text-xs text-[color:var(--state-warning)]">
          {error}
        </p>
      ) : null}

      {result ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs",
            fullyRecorded
              ? "border-[color:var(--state-success-line-strong)] bg-[color:var(--state-success-surface)]"
              : "border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)]",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {fullyRecorded ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
            {result.ledger.headline}
          </p>

          <ul className="mt-2 flex flex-col gap-1">
            {result.ledger.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    s.status === "done"
                      ? "bg-[color:var(--state-success)]"
                      : s.status === "failed"
                        ? "bg-[color:var(--state-warning)]"
                        : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                {s.intent} — {s.status}
              </li>
            ))}
          </ul>

          {receiptFailed ? (
            <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-[color:var(--state-warning)]">
              The task result is shown above, but its receipt could not be saved:{" "}
              {result.receiptRecording.status === "failed" ? result.receiptRecording.reason : ""}
            </p>
          ) : halted ? (
            <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
              Stopped at step {result.haltedAt + 1}: {result.haltReason}
            </p>
          ) : (
            <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
              {result.receiptRecording.status === "saved"
                ? "A receipt for this run was saved to Artifacts, with its provenance and a fingerprint."
                : "No receipt save was requested for this run."}
            </p>
          )}
        </div>
      ) : null}
    </GlassPanel>
  );
}
