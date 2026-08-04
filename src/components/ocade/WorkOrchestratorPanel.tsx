import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import {
  BrowserWorkCheckpointStore,
  runWorkMission,
  type WorkCheckpoint,
  type WorkHost,
  type WorkHostObservation,
  type WorkMissionSpec,
  type WorkReceiptRecording,
  type WorkStep,
  type WorkSupervisorCommand,
} from "@/lib/work/orchestrator";

const REPORT_KEY_PREFIX = "ocade.work.proof.report.v1:";
const JOURNAL_KEY_PREFIX = "ocade.work.proof.journal.v1:";

function proofSpec(id: string): WorkMissionSpec {
  return {
    id,
    intent: "Prepare and verify a local work-session report",
    initialState: "Two local sources exist; no report has been written.",
    finalState: "A report exists in local proof storage and its contents were verified.",
    steps: [
      {
        id: "read-source-a",
        intent: "Read the first local source",
        kind: "read",
        role: "researcher",
        dependsOn: [],
        estimatedMs: 20,
        maxAttempts: 2,
      },
      {
        id: "read-source-b",
        intent: "Read the second local source",
        kind: "read",
        role: "researcher",
        dependsOn: [],
        estimatedMs: 20,
        maxAttempts: 2,
      },
      {
        id: "write-report",
        intent: "Write the combined report to local proof storage",
        kind: "mutation",
        role: "operator",
        dependsOn: ["read-source-a", "read-source-b"],
        estimatedMs: 30,
        maxAttempts: 2,
      },
      {
        id: "verify-report",
        intent: "Read back and verify the report",
        kind: "read",
        role: "verifier",
        dependsOn: ["write-report"],
        estimatedMs: 10,
        maxAttempts: 1,
      },
    ],
    budget: {
      maxDurationMs: 500,
      maxParallelReads: 2,
      maxMutations: 1,
    },
  };
}

function journalFor(missionId: string): Record<string, WorkHostObservation> {
  const raw = globalThis.localStorage?.getItem(`${JOURNAL_KEY_PREFIX}${missionId}`);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The local operation journal is corrupt.");
  }
  return parsed as Record<string, WorkHostObservation>;
}

function saveJournal(missionId: string, journal: Record<string, WorkHostObservation>): void {
  if (!globalThis.localStorage) throw new Error("Local operation-journal storage is unavailable.");
  globalThis.localStorage.setItem(`${JOURNAL_KEY_PREFIX}${missionId}`, JSON.stringify(journal));
}

function createProofHost(missionId: string): WorkHost {
  const sourceA = "North: 120";
  const sourceB = "South: 80";

  return {
    async execute(step, operationId) {
      const journal = journalFor(missionId);
      if (journal[operationId]) return journal[operationId];

      let observation: WorkHostObservation;
      if (step.id === "read-source-a" || step.id === "read-source-b") {
        const content = step.id === "read-source-a" ? sourceA : sourceB;
        observation = {
          operationId,
          outcome: "succeeded",
          observed: true,
          verified: content.includes(":"),
          committed: false,
          evidence: `${step.id} read and its expected shape verified.`,
          durationMs: step.estimatedMs,
        };
      } else if (step.id === "write-report") {
        if (!globalThis.localStorage) {
          observation = {
            operationId,
            outcome: "failed",
            observed: true,
            verified: false,
            committed: false,
            evidence: "Local proof storage is unavailable; no report was written.",
            durationMs: step.estimatedMs,
          };
        } else {
          const report = JSON.stringify({
            sources: [sourceA, sourceB],
            total: 200,
            generatedBy: "ocade.work.local-proof",
          });
          globalThis.localStorage.setItem(`${REPORT_KEY_PREFIX}${missionId}`, report);
          const readBack = globalThis.localStorage.getItem(`${REPORT_KEY_PREFIX}${missionId}`);
          observation = {
            operationId,
            outcome: readBack === report ? "succeeded" : "failed",
            observed: true,
            verified: readBack === report,
            committed: readBack !== null,
            evidence:
              readBack === report
                ? "The local report was written and read back byte-for-byte."
                : "The local report write could not be verified.",
            durationMs: step.estimatedMs,
          };
        }
      } else {
        const raw = globalThis.localStorage?.getItem(`${REPORT_KEY_PREFIX}${missionId}`) ?? null;
        let verified = false;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { total?: unknown; sources?: unknown };
            verified =
              parsed.total === 200 && Array.isArray(parsed.sources) && parsed.sources.length === 2;
          } catch {
            verified = false;
          }
        }
        observation = {
          operationId,
          outcome: verified ? "succeeded" : "failed",
          observed: true,
          verified,
          committed: false,
          evidence: verified
            ? "The report was read back and its source count and total were verified."
            : "The report was missing or did not match the expected result.",
          durationMs: step.estimatedMs,
        };
      }

      // The operation journal is written before acknowledgement. If the UI
      // disappears after this point, recover(operationId) returns this exact
      // observation and the mutation is not executed twice.
      journal[operationId] = observation;
      saveJournal(missionId, journal);
      return observation;
    },

    async recover(operationId: string, _step: WorkStep) {
      try {
        const observation = journalFor(missionId)[operationId];
        return (
          observation ?? { outcome: "not_found", evidence: "Operation is absent from the journal." }
        );
      } catch (error) {
        return {
          outcome: "unknown",
          evidence:
            error instanceof Error ? error.message : "The operation journal could not be read.",
        };
      }
    },
  };
}

function statusLabel(checkpoint: WorkCheckpoint | null): string {
  if (!checkpoint) return "Not started";
  return checkpoint.status.replace("_", " ");
}

export function WorkOrchestratorPanel() {
  const [missionId, setMissionId] = useState("ocade-work-local-proof-v1");
  const [checkpoint, setCheckpoint] = useState<WorkCheckpoint | null>(null);
  const [receipt, setReceipt] = useState<WorkReceiptRecording>({ status: "not_requested" });
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const spec = useMemo(() => proofSpec(missionId), [missionId]);

  useEffect(() => {
    let active = true;
    const store = new BrowserWorkCheckpointStore();
    void store
      .load(missionId)
      .then((loaded) => {
        if (active) setCheckpoint(loaded);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "The work checkpoint could not be read.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [missionId]);

  async function execute(command?: WorkSupervisorCommand, checkpointLimit?: number) {
    setRunning(true);
    setError(null);
    const result = await runWorkMission({
      spec,
      host: createProofHost(missionId),
      store: new BrowserWorkCheckpointStore(),
      ...(command ? { supervisorCommand: command } : {}),
      ...(checkpointLimit ? { checkpointLimit } : {}),
      recordReceipt: true,
    });
    if (!result.ok) {
      setError(result.reason);
      if (result.checkpoint) setCheckpoint(result.checkpoint);
    } else {
      setCheckpoint(result.data.checkpoint);
      setReceipt(result.data.receiptRecording);
    }
    setRunning(false);
  }

  function command(kind: WorkSupervisorCommand["kind"]): WorkSupervisorCommand {
    return {
      sequence: (checkpoint?.lastSupervisorSequence ?? 0) + 1,
      source: "mobile",
      kind,
      issuedAt: new Date().toISOString(),
    };
  }

  function newProof() {
    const id =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMissionId(`ocade-work-local-proof-${id}`);
    setCheckpoint(null);
    setReceipt({ status: "not_requested" });
    setError(null);
  }

  const nodes = checkpoint?.nodes ?? {};
  const completed = Object.values(nodes).filter((node) => node.status === "done").length;
  const paused = checkpoint?.status === "paused";
  const terminal = checkpoint?.status === "succeeded" || checkpoint?.status === "cancelled";

  return (
    <div className="flex flex-col gap-4">
      <GlassPanel className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <GitBranch className="h-4 w-4" aria-hidden /> Durable Work mission
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              This proof resolves a dependency graph, sends each step to a specialized role, runs
              safe reads in parallel, serializes the mutation, checkpoints before dispatch, and
              stores a verified receipt only after the final observation.
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] capitalize",
              checkpoint?.status === "succeeded"
                ? "border-[color:var(--state-success)]/50 text-[color:var(--state-success)]"
                : checkpoint?.status === "recovery_required" || checkpoint?.status === "blocked"
                  ? "border-[color:var(--state-warning)]/50 text-[color:var(--state-warning)]"
                  : "border-border text-muted-foreground",
            )}
          >
            {statusLabel(checkpoint)}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Fact label="Dependency graph" value="3 waves / 4 steps" />
          <Fact label="Specialized roles" value="Research · Operate · Verify" />
          <Fact label="Resource budget" value="500 ms · 2 parallel reads" />
          <Fact
            label="Durable checkpoint"
            value={checkpoint ? `Revision ${checkpoint.revision}` : "Created before execution"}
          />
          <Fact
            label="Mobile supervision"
            value={checkpoint ? `Command ${checkpoint.lastSupervisorSequence}` : "Ordered commands"}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={running || paused || terminal}
            onClick={() => void execute(undefined, 1)}
          >
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            Run next checkpoint
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={running || !checkpoint || terminal || paused}
            onClick={() => void execute(command("pause"))}
          >
            <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={running || !checkpoint || terminal || !paused}
            onClick={() => void execute(command("resume"), 1)}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" /> Resume
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={running || !checkpoint || terminal}
            onClick={() => void execute(command("cancel"))}
          >
            <Square className="mr-1.5 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button size="sm" variant="ghost" disabled={running} onClick={newProof}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> New local proof
          </Button>
        </div>

        {error ? (
          <p role="alert" className="mt-3 flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        ) : null}
      </GlassPanel>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <GlassPanel className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" aria-hidden /> Task graph and progress
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {checkpoint
              ? `${completed} of ${spec.steps.length} steps have verified receipts.`
              : "Nothing has run. The first checkpoint will admit both independent reads together."}
          </p>
          <ol className="mt-3 flex flex-col gap-2">
            {spec.steps.map((step) => {
              const node = nodes[step.id];
              return (
                <li key={step.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start gap-2">
                    {node?.status === "done" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-success)]" />
                    ) : (
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{step.intent}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {step.role} · {step.kind} · depends on{" "}
                        {step.dependsOn.length ? step.dependsOn.join(", ") : "nothing"}
                      </p>
                      {node?.reason ? (
                        <p className="mt-1 text-[11px] text-[color:var(--state-warning)]">
                          {node.reason}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-[10px] capitalize text-muted-foreground">
                      {node?.status ?? "pending"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </GlassPanel>

        <GlassPanel className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Evidence and recovery
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Every operation id is written before dispatch. After a lost acknowledgement, the host
            journal is queried; an ambiguous mutation is never repeated.
          </p>
          <dl className="mt-3 space-y-2 text-xs">
            <ReceiptRow label="Elapsed budget" value={`${checkpoint?.elapsedMs ?? 0} / 500 ms`} />
            <ReceiptRow
              label="Recovered steps"
              value={`${Object.values(nodes).filter((node) => node.recovered).length}`}
            />
            <ReceiptRow
              label="Receipt"
              value={
                receipt.status === "saved"
                  ? `Saved · ${receipt.artifactId.slice(0, 12)}`
                  : receipt.status === "failed"
                    ? "Not saved"
                    : "Not earned yet"
              }
            />
          </dl>
          {checkpoint?.reason ? (
            <p className="mt-3 rounded-md border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/10 p-2 text-[11px]">
              {checkpoint.reason}
            </p>
          ) : null}
          <p className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            This route changes local proof data only. Real mouse, keyboard, terminal, filesystem,
            and application work still requires the CAERA Native Companion and its permission
            boundary; no PC action is claimed here.
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-medium">{value}</p>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
