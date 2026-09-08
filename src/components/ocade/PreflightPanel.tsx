import { useState } from "react";
import { ShieldQuestion, ShieldCheck, AlertTriangle, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import {
  rehearseTask,
  REHEARSAL_REALITY,
  type RehearsalStep,
  type RehearsalContext,
} from "@/lib/skills/rehearsal";
import { shadowApplyPatch, SHADOW_RULE } from "@/lib/skills/shadow-execution";
import { buildReplay, serialiseReplay } from "@/lib/artifacts/learning-replay";
import { buildTaskLedger, type LedgerStep } from "@/lib/artifacts/evidence-ledger";
import { PackRegistry } from "@/lib/skills/pack-registry";
import { createTaskScope } from "@/lib/skills/task-scope";
import { parseUnifiedDiff } from "@/lib/code/patch";
import type { AdapterHealth } from "@/lib/skills/adapter-health";
import type { ControlMethod, SkillCapability } from "@/lib/skills/skill-pack";
import type { EvidenceReceipt } from "@/lib/skills/skill-pack";

/**
 * Pre-flight checks, on this device. Three safety gates that run BEFORE OCADE
 * commits to a task, each exercising its real module (nothing illustrative):
 *
 *  - REHEARSE (skills/rehearsal): walk the whole step graph without executing and
 *    surface every blocker at once, so a step-2 permission gap is seen before
 *    step 1 changes anything.
 *  - SHADOW (skills/shadow-execution): apply a code change to a COPY and check its
 *    postconditions before the real file is touched — "it applied" is not "it worked".
 *  - REPLAY (artifacts/learning-replay): turn a finished task's ledger into an
 *    honest tutorial that KEEPS the mistakes in, never a sanitised success story.
 *
 * These modules compose into the governed pipeline; this surface makes them
 * directly runnable and inspectable.
 */

const CSV = "region,amount\nNorth,120";

const FILE = ["function greet(name) {", '  return "hi " + name;', "}", ""].join("\n");
const GOOD_DIFF = [
  "--- a/greet.js",
  "+++ b/greet.js",
  "@@ -1,3 +1,3 @@",
  " function greet(name) {",
  '-  return "hi " + name;',
  "+  return `Hello, ${name}`;",
  " }",
  "",
].join("\n");

function runRehearsal(): string[] {
  const registry = new PackRegistry();
  const pack = registry.get("ocade.data");
  const cap = pack?.capabilities.find((c) => c.id === "data.parse_csv") ?? null;
  if (!pack || !cap) return ["The data pack isn't available."];
  const app = { appId: pack.appId, displayName: pack.displayName, version: "1.0" };

  // Two steps: a read the scope allows, then a write it does NOT — so rehearsal
  // reports the step-2 blocker up front, before step 1 would run.
  const steps: RehearsalStep[] = [
    {
      action: { kind: "file.open", path: "memory/table" },
      capability: cap as SkillCapability,
      app,
    },
    { action: { kind: "clipboard.write", text: CSV }, capability: cap as SkillCapability, app },
  ];
  const context: RehearsalContext = {
    packs: registry.list(),
    scope: createTaskScope({
      id: "preflight",
      summary: "Read the pasted data",
      capabilities: ["file.open"], // clipboard.write deliberately NOT granted
      paths: ["memory"],
    }),
    health: new Map<ControlMethod, AdapterHealth>(),
    availableMethods: ["file"],
    recording: "video_off",
  };

  const r = rehearseTask(steps, context);
  if (!r.ok) return [r.reason];
  return [
    r.data.headline,
    ...r.data.steps.map((s) => `Step ${s.index + 1}: ${s.status} — ${s.reason}`),
  ];
}

function runShadow(): { safe: boolean; lines: string } {
  const parsed = parseUnifiedDiff(GOOD_DIFF);
  if (!parsed.ok) return { safe: false, lines: parsed.reason };
  const r = shadowApplyPatch(FILE, parsed.data, {
    mustContain: ["Hello, ${name}"],
    mustNotContain: ['"hi " + name'],
    mustChange: true,
  });
  if (!r.ok) return { safe: false, lines: r.reason };
  return { safe: r.data.safeToApply, lines: r.evidence };
}

function runReplay(): string {
  const receipt = (verified: boolean): EvidenceReceipt => ({
    appId: "ocade.data",
    capabilityId: "data.summarise",
    method: "file",
    at: "2026-07-24T10:00:05.000Z",
    verified,
    evidence: verified ? "mean 80.00" : "NOT CONFIRMED: no check was possible",
  });
  const steps: LedgerStep[] = [
    { intent: "Read the pasted data", receipt: receipt(true), status: "done", attempts: 1 },
    {
      intent: "Write the summary file",
      receipt: null,
      status: "failed",
      attempts: 2,
      recovery: { action: "undo", evidence: "reverted the partial write" },
    },
  ];
  const ledger = buildTaskLedger({
    taskId: "preflight-demo",
    intent: "Summarise and save",
    initialState: "CSV pasted, nothing computed",
    finalState: "First step done, second reverted",
    steps,
    startedAt: "2026-07-24T10:00:00.000Z",
    finishedAt: "2026-07-24T10:00:12.000Z",
  });
  if (!ledger.ok) return ledger.reason;
  return serialiseReplay(buildReplay(ledger.data));
}

type Demo = "rehearse" | "shadow" | "replay";

export function PreflightPanel() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const rehearsal = demo === "rehearse" ? runRehearsal() : null;
  const shadow = demo === "shadow" ? runShadow() : null;
  const replay = demo === "replay" ? runReplay() : null;

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <ShieldQuestion className="h-4 w-4" aria-hidden /> Pre-flight safety checks
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Three checks OCADE runs before it commits to a task — rehearse the whole plan without
        acting, prove a code change on a copy first, and turn a finished task into an honest replay
        that keeps the mistakes in. Each runs its real module here.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={demo === "rehearse" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDemo("rehearse")}
        >
          Rehearse a plan
        </Button>
        <Button
          size="sm"
          variant={demo === "shadow" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDemo("shadow")}
        >
          Shadow a code change
        </Button>
        <Button
          size="sm"
          variant={demo === "replay" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDemo("replay")}
        >
          Replay a task
        </Button>
      </div>

      {rehearsal ? (
        <div role="status" className="mt-3 rounded-lg border border-border/60 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Rehearsal — blockers surfaced before
            step one
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
            {rehearsal.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
            {REHEARSAL_REALITY}
          </p>
        </div>
      ) : null}

      {shadow ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs",
            shadow.safe
              ? "border-[color:var(--state-success-line-strong)] bg-[color:var(--state-success-surface)]"
              : "border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)]",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {shadow.safe ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
            {shadow.safe ? "Shadow run clean — safe to apply" : "Shadow held the real file back"}
          </p>
          <p className="mt-1 text-muted-foreground">{shadow.lines}</p>
          <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
            {SHADOW_RULE}
          </p>
        </div>
      ) : null}

      {replay ? (
        <div role="status" className="mt-3 rounded-lg border border-border/60 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <ScrollText className="h-3.5 w-3.5" aria-hidden /> Replay — the mistakes are kept in on
            purpose
          </p>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
            {replay}
          </pre>
        </div>
      ) : null}
    </GlassPanel>
  );
}
