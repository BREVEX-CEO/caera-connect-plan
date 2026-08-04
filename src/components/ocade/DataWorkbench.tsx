import { useMemo, useState } from "react";
import { Table2, Play, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import { createDefaultExecutors, type DataInput } from "@/lib/skills/default-executors";
import { runPlannedStep, type RunOutcome } from "@/lib/skills/executor-registry";
import { planStep } from "@/lib/skills/work-session";
import { createTaskScope, expireScopeIfDue } from "@/lib/skills/task-scope";
import { PackRegistry } from "@/lib/skills/pack-registry";
import { parseCsv, type DataTable } from "@/lib/skills/packs/data-pack";
import type { AdapterHealth } from "@/lib/skills/adapter-health";
import type { ControlMethod, SkillCapability } from "@/lib/skills/skill-pack";

/**
 * The first surface where OCADE genuinely plans and PERFORMS work end to end,
 * entirely on this device.
 *
 * It runs the real pipeline — scope check, pack match, confidence assessment,
 * execution, verification, receipt — against the same code the tests exercise.
 * Nothing here is illustrative: if a step is refused, it is refused by the real
 * decision layer, and the reason shown is the reason it produced.
 */
/** A fresh, read-only approval for the analysis surface. */
function newScope() {
  return createTaskScope({
    id: `data-workbench-${Date.now()}`,
    summary: "Analyse data you paste here",
    capabilities: ["file.open"],
    paths: ["memory"],
  });
}

export function DataWorkbench() {
  const registry = useMemo(() => new PackRegistry(), []);
  const [csv, setCsv] = useState("region,amount\nNorth,120\nSouth,80\nEast,40");
  const [column, setColumn] = useState("amount");
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [table, setTable] = useState<DataTable | null>(null);

  /*
   * One approval covering the analysis session — data work is read-only, so a
   * single scope genuinely bounds it.
   *
   * The scope EXPIRES after 30 minutes, which is correct: an approval should
   * not outlive the task. But a `useMemo` with an empty dependency list would
   * then leave this surface permanently dead — the user returns to an open tab
   * and every action refuses with "approve it again", with nothing to click.
   * So expiry is detected and renewal is offered as an explicit action, rather
   * than renewed silently (which would make the expiry meaningless).
   */
  const [scope, setScope] = useState(() => newScope());
  const scopeExpired = expireScopeIfDue(scope).status !== "active";

  function renewScope() {
    setScope(newScope());
    setOutcome(null);
  }

  const pack = registry.get("ocade.data");

  async function run(capabilityId: string, input: DataInput) {
    const capability = pack?.capabilities.find((c) => c.id === capabilityId);
    if (!pack || !capability) return;

    const planned = planStep({
      action: { kind: "file.open", path: "memory/table" },
      capability: capability as SkillCapability,
      app: { appId: pack.appId, displayName: pack.displayName, version: "1.0" },
      packs: registry.list(),
      scope,
      health: new Map<ControlMethod, AdapterHealth>(),
      availableMethods: ["file"],
      recording: "video_off",
    });

    if (planned.status !== "ready") {
      setOutcome({
        status: "unavailable",
        reason:
          planned.status === "refused"
            ? planned.reason
            : planned.status === "over_budget"
              ? planned.reason
              : planned.reason,
      });
      return;
    }

    const executors = createDefaultExecutors(() => input);
    setOutcome(await runPlannedStep(executors, planned.plan));
  }

  function loadTable() {
    const parsed = parseCsv(csv);
    if (parsed.ok) setTable(parsed.data);
    else setTable(null);
    void run("data.parse_csv", { text: csv });
  }

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Table2 className="h-4 w-4" aria-hidden /> Analyse data on this device
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Runs entirely here, including offline. Nothing is uploaded. OCADE checks its own result and
        shows you the evidence — or refuses, and says why.
      </p>

      <label htmlFor="workbench-csv" className="text-xs font-medium text-foreground">
        Paste CSV
      </label>
      <textarea
        id="workbench-csv"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={5}
        spellCheck={false}
        className="mt-1 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 font-mono text-xs text-foreground"
      />

      {/*
        An expired approval must offer a way forward. Without this the surface
        looks broken rather than simply needing renewal.
      */}
      {scopeExpired ? (
        <div
          role="status"
          className="mt-2 rounded-lg border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-3 text-xs"
        >
          <p className="font-medium text-foreground">This session's approval has expired</p>
          <p className="mt-0.5 text-muted-foreground">
            Approvals don't outlive the task they were given for. Nothing was lost — your data is
            still here.
          </p>
          <Button size="sm" variant="ghost" className="mt-2 h-7 text-[11px]" onClick={renewScope}>
            Continue analysing
          </Button>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="workbench-col" className="text-[11px] text-muted-foreground">
            Column to summarise
          </label>
          <input
            id="workbench-col"
            value={column}
            onChange={(e) => setColumn(e.target.value)}
            className="mt-0.5 block h-8 w-40 rounded-md border border-border/60 bg-transparent px-2 text-xs"
          />
        </div>
        <Button size="sm" className="h-8" onClick={loadTable} disabled={scopeExpired}>
          <Play className="mr-1.5 h-3.5 w-3.5" /> Read
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={!table || scopeExpired}
          onClick={() => void run("data.summarise", { table: table ?? undefined, column })}
        >
          Summarise
        </Button>
      </div>

      {outcome ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs",
            outcome.status === "done"
              ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10"
              : "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {outcome.status === "done" ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
            {outcome.status === "done"
              ? "Done, and checked"
              : outcome.status === "failed"
                ? "Didn't work"
                : "Not attempted"}
          </p>

          {/* The receipt is the evidence — shown verbatim, including a refusal. */}
          <p className="mt-1 text-muted-foreground">
            {outcome.status === "unavailable" ? outcome.reason : outcome.receipt.evidence}
          </p>

          {outcome.status !== "unavailable" ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {outcome.receipt.verified
                ? "OCADE confirmed this result itself."
                : "OCADE could not confirm this, and has said so rather than assuming."}
            </p>
          ) : null}
        </div>
      ) : null}
    </GlassPanel>
  );
}
