import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Workflow,
  Plus,
  Loader2,
  Play,
  Eye,
  Pause,
  PlayCircle,
  Trash2,
  ShieldAlert,
  Check,
  X,
  OctagonX,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  previewAutomation,
  startAutomationRun,
  listAutomationRuns,
  decideAutomationRun,
  cancelAutomationRun,
  cancelAllRuns,
  type AutomationRow,
  type RunRow,
} from "@/lib/ocade-automations.functions";
import { selectDueAutomations, describeSkip, retryReadyAt } from "@/lib/ocade-scheduler";
import { describeRunEnqueue, IN_FLIGHT_STATUSES, type RunStatus } from "@/lib/ocade-automations";
import { useOnline } from "@/lib/use-online";
import { computerUseChannelDecision } from "@/lib/computer-use-settings";
import {
  getCompanion,
  subscribeCompanionAdapter,
  type CompanionAction,
  type NativeCompanionAdapter,
} from "@/lib/native/companion-bridge";
import { bootstrapCompanion } from "@/lib/native/tauri-companion";
import { AutomationVerifierRegistry } from "@/lib/automation-supervisor";
import {
  createNativeObservationVerifierRegistry,
  isNativeObservationAdapter,
} from "@/lib/native/automation-observer";
import {
  DesktopAutomationWorkerHost,
  describeAutomationWorkerHost,
  type AutomationWorkerHostSupabase,
} from "@/lib/automation-worker-host";
import { AutomationWorkerCompanionSession } from "@/lib/automation-worker-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ocade/automations")({
  head: () => ({
    meta: [{ title: "OCADE Automations — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: AutomationsPage,
});

interface PlanPreview {
  steps: { summary: string; risk: string; requiresConfirmation: boolean }[];
  highestRisk: string;
  blocked: boolean;
  blockedReason?: string;
  requiresApproval: boolean;
}

const RISK_LABEL: Record<string, string> = {
  read_only: "Read only",
  low: "Low risk",
  confirm: "Needs confirmation",
  high: "High risk",
  prohibited: "Prohibited",
};

const ACTION_LABEL: Record<CompanionAction["kind"], string> = {
  "screen.read": "Read the visible screen",
  "window.list": "List open windows",
  "accessibility.read": "Read the focused accessibility tree",
  "window.focus": "Focus a window",
  "window.arrange": "Arrange a window",
  "app.open": "Open an application",
  "file.open": "Open a file",
  "text.type": "Type approved text",
  "clipboard.read": "Read the clipboard",
  "clipboard.write": "Write to the clipboard",
  "selection.read": "Read the current selection",
  "selection.replace": "Replace the current selection",
};

const ACTION_KINDS = Object.keys(ACTION_LABEL) as CompanionAction["kind"][];

function actionNeedsValue(kind: CompanionAction["kind"]): boolean {
  return ![
    "screen.read",
    "window.list",
    "accessibility.read",
    "clipboard.read",
    "selection.read",
    "window.arrange",
  ].includes(kind);
}

function draftAction(
  kind: CompanionAction["kind"],
  value: string,
  layout: "left" | "right" | "maximize" | "restore",
): CompanionAction | null {
  const trimmed = value.trim();
  switch (kind) {
    case "screen.read":
    case "window.list":
    case "accessibility.read":
    case "clipboard.read":
    case "selection.read":
      return { kind };
    case "window.focus":
      return trimmed ? { kind, target: trimmed } : null;
    case "window.arrange":
      return { kind, layout };
    case "app.open":
      return trimmed ? { kind, appId: trimmed } : null;
    case "file.open":
      return trimmed ? { kind, path: trimmed } : null;
    case "text.type":
    case "clipboard.write":
    case "selection.replace":
      return trimmed ? { kind, text: value } : null;
  }
}

function describeTrigger(t: AutomationRow["trigger"]): string {
  switch (t.kind) {
    case "manual":
      return "Runs only when you start it";
    case "interval":
      return `Every ${t.everyMinutes} minute${t.everyMinutes === 1 ? "" : "s"}`;
    case "daily":
      return `Daily at ${String(t.atHourUtc).padStart(2, "0")}:${String(t.atMinuteUtc ?? 0).padStart(2, "0")} UTC`;
    case "condition":
      return `When: ${t.expression}`;
    default:
      return "Unknown trigger";
  }
}

function AutomationsPage() {
  const [rows, setRows] = useState<AutomationRow[] | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [workerStatus, setWorkerStatus] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const online = useOnline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Why the scheduler passed over each automation, keyed by id. */
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ name: string; plan: PlanPreview } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AutomationRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editTrigger, setEditTrigger] = useState<AutomationRow["trigger"]>({
    kind: "manual",
  });
  const [editActions, setEditActions] = useState<CompanionAction[]>([]);
  const [editRequiresApproval, setEditRequiresApproval] = useState(true);
  const [editMaxAttempts, setEditMaxAttempts] = useState(3);
  const [newActionKind, setNewActionKind] = useState<CompanionAction["kind"]>("screen.read");
  const [newActionValue, setNewActionValue] = useState("");
  const [newActionLayout, setNewActionLayout] = useState<"left" | "right" | "maximize" | "restore">(
    "left",
  );

  const refresh = useCallback(async () => {
    setUnavailable(null);
    try {
      const list = await listAutomations();
      setRows(list);
      setSelectedId((cur) => (cur && list.some((r) => r.id === cur) ? cur : (list[0]?.id ?? null)));
      setRuns(await listAutomationRuns({ data: {} }));
    } catch (e) {
      setRows(null);
      setRuns(null);
      setUnavailable(
        e instanceof Error
          ? e.message
          : "Automations aren't available until the database is set up.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;
    const computerRefusal =
      computerUseChannelDecision("thisComputer") ?? computerUseChannelDecision("backgroundTasks");
    if (computerRefusal) {
      setWorkerStatus(computerRefusal);
      return;
    }
    const session = new AutomationWorkerCompanionSession({
      bootstrap: () => bootstrapCompanion(),
      getCompanion,
      subscribe: subscribeCompanionAdapter,
      createHost: (companion: NativeCompanionAdapter) => {
        // Real native builds install observation-backed verifiers here. An
        // empty registry is intentionally not enough to start a queue worker.
        const verifiers = isNativeObservationAdapter(companion)
          ? createNativeObservationVerifierRegistry(companion)
          : new AutomationVerifierRegistry();
        return new DesktopAutomationWorkerHost({
          supabase: supabase as unknown as AutomationWorkerHostSupabase,
          companion,
          verifiers,
          controllerOptions: { isOnline: () => navigator.onLine },
          onStateChange: (state) => {
            if (active) setWorkerStatus(describeAutomationWorkerHost(state));
          },
        });
      },
      onBootstrapUnavailable: (reason) => {
        if (active) setWorkerStatus(reason);
      },
      onError: (reason) => {
        if (active) setWorkerStatus(reason);
      },
    });
    void session.start();
    return () => {
      active = false;
      void session.stop();
    };
  }, []);

  /**
   * Scheduler tick. It decides which automations may be queued and records
   * those run requests. Actual action execution belongs to a separate worker;
   * creating a pending row here must never be presented as completed work.
   */
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    if (computerUseChannelDecision("backgroundTasks")) return;
    /*
     * Offline recovery.
     *
     * Starting a run needs the server. Without this guard every 60s tick fired
     * a request that could not succeed, the catch swallowed it, and the failure
     * counted against the automation's retry budget — so a laptop that spent an
     * hour offline could exhaust its attempts without a single real execution.
     *
     * Worse, a start can be RECEIVED and its response lost, leaving the client
     * unsure whether a run began. Not asking while offline avoids that entirely;
     * the next online tick re-evaluates from the server's actual state.
     */
    if (!online) return;

    let cancelled = false;

    async function tick() {
      const now = new Date();
      const decision = selectDueAutomations(
        (rows ?? []).map((a) => ({
          id: a.id,
          enabled: a.enabled,
          paused: a.paused,
          maxAttempts: a.max_attempts,
          nextRunAt: a.next_run_at,
          lastRunAt: a.last_run_at,
        })),
        (runs ?? []).map((r) => ({
          id: r.id,
          automationId: r.automation_id,
          status: r.status,
          attempt: r.attempt,
          createdAt: r.created_at,
          nextAttemptAt: null,
        })),
        now,
      );

      // Surface WHY nothing is running. Without this the scheduler silently
      // decides, and a user whose automation isn't firing has no way to tell
      // "paused" from "not due yet" from "already running".
      if (!cancelled) {
        setSkipReasons(
          Object.fromEntries(decision.skipped.map((s) => [s.automationId, describeSkip(s.reason)])),
        );
      }

      if (decision.due.length === 0 || cancelled) return;

      for (const id of decision.due) {
        if (cancelled) return;
        try {
          await startAutomationRun({ data: { id } });
        } catch {
          // The next refresh reconciles with server state; do not assume a
          // failed response means the request was recorded.
        }
      }
      if (!cancelled) await refresh();
    }

    void tick();
    const timer = setInterval(() => void tick(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // `online` is a dependency, so reconnecting restarts the tick immediately
    // rather than waiting out the remainder of the 60s interval.
  }, [rows, runs, refresh, online]);

  const selected = rows?.find((r) => r.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditEnabled(selected.enabled);
    setEditTrigger(selected.trigger);
    setEditActions(selected.actions);
    setEditRequiresApproval(selected.requires_approval);
    setEditMaxAttempts(selected.max_attempts);
    setNewActionKind("screen.read");
    setNewActionValue("");
    setNewActionLayout("left");
  }, [selected]);
  const selectedRuns = runs?.filter((r) => !selectedId || r.automation_id === selectedId) ?? [];
  // Uses the shared list, not a hand-written copy — the same definition backs
  // the server-side double-start guard and the database index.
  const activeRuns = (runs ?? []).filter((r) => IN_FLIGHT_STATUSES.includes(r.status as RunStatus));

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const a = await createAutomation({ data: { name } });
      toast.success(
        `Automation “${a.name}” created. It runs only when you start it until you add a schedule.`,
      );
      setNewName("");
      await refresh();
      setSelectedId(a.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the automation.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause(a: AutomationRow) {
    try {
      await updateAutomation({ data: { id: a.id, paused: !a.paused } });
      toast.success(a.paused ? "Automation resumed." : "Automation paused.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the automation.");
    }
  }

  function addDraftAction() {
    const action = draftAction(newActionKind, newActionValue, newActionLayout);
    if (!action) {
      toast.error("Enter the target or content for this step.");
      return;
    }
    if (editActions.length >= 50) {
      toast.error("An automation can contain at most 50 steps.");
      return;
    }
    setEditActions((current) => [...current, action]);
    setNewActionValue("");
  }

  async function saveDefinition(a: AutomationRow) {
    const name = editName.trim();
    if (!name) {
      toast.error("Give this automation a name.");
      return;
    }
    setBusy(true);
    try {
      await updateAutomation({
        data: {
          id: a.id,
          name,
          enabled: editEnabled,
          trigger: editTrigger,
          actions: editActions,
          requiresApproval: editRequiresApproval,
          maxAttempts: editMaxAttempts,
        },
      });
      toast.success("Automation definition saved. Preview it before the next real run.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the automation.");
    } finally {
      setBusy(false);
    }
  }

  async function showPreview(a: AutomationRow) {
    try {
      const plan = (await previewAutomation({ data: { id: a.id } })) as unknown as PlanPreview;
      setPreview({ name: a.name, plan });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the preview.");
    }
  }

  async function run(a: AutomationRow, dryRun: boolean) {
    if (!dryRun) {
      const channelRefusal = computerUseChannelDecision("thisComputer");
      if (channelRefusal) {
        toast.error(channelRefusal);
        return;
      }
    }
    setBusy(true);
    try {
      const r = await startAutomationRun({ data: { id: a.id, dryRun } });
      const notice = describeRunEnqueue(r);
      toast[notice.tone](notice.message);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the run.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(runId: string, decision: "approved" | "denied") {
    try {
      await decideAutomationRun({ data: { runId, decision } });
      toast.success(
        decision === "approved"
          ? "Run approved and queued — no action has executed yet."
          : "Run denied — nothing was executed.",
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the decision.");
    }
  }

  async function cancel(runId: string) {
    try {
      const result = await cancelAutomationRun({ data: { runId } });
      toast.success(
        result.status === "cancelled"
          ? "Run cancelled before execution."
          : "Cancellation requested — waiting for the worker to confirm it stopped.",
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel the run.");
    }
  }

  async function emergencyStop() {
    try {
      const result = await cancelAllRuns();
      toast.success(
        `Emergency stop recorded: ${result.cancelled} queued run(s) cancelled; ${result.cancellationRequested} running worker(s) told to stop.`,
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stop the runs.");
    }
  }

  async function reallyDelete(a: AutomationRow) {
    setBusy(true);
    try {
      await deleteAutomation({ data: { id: a.id } });
      toast.success("Automation deleted.");
      setConfirmDelete(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the automation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="OCADE"
        title="Automations"
        description="Repeatable OCADE tasks. Every run is previewed and risk-checked first, and anything that touches protected information is refused outright."
        actions={
          activeRuns.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => void emergencyStop()}>
              <OctagonX className="mr-1.5 h-4 w-4" /> Stop all ({activeRuns.length})
            </Button>
          ) : undefined
        }
      />

      {/*
        The scheduler genuinely stops while offline, so say so. Otherwise a
        scheduled automation appears to be broken rather than waiting.
      */}
      {!online && !unavailable ? (
        <GlassPanel className="mb-4 flex items-start gap-2 p-3 text-xs">
          <WifiOff
            className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]"
            aria-hidden
          />
          <span className="text-muted-foreground">
            You're offline, so scheduled runs are paused rather than failed — nothing is retried
            against a connection that isn't there. They resume as soon as you reconnect.
          </span>
        </GlassPanel>
      ) : null}

      {workerStatus ? (
        <GlassPanel className="mb-4 flex items-start gap-2 p-3 text-xs">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]"
            aria-hidden
          />
          <span className="text-muted-foreground">{workerStatus}</span>
        </GlassPanel>
      ) : null}

      {unavailable ? (
        <SetupRequiredState
          title="Automations need the database migration"
          description={`${unavailable} The migration, RLS policies, rollback and verification SQL are prepared and ready to apply. Applying them enables persistence; real execution still requires a connected, verified worker.`}
        />
      ) : rows === null ? (
        <GlassPanel className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading automations…
        </GlassPanel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <GlassPanel className="p-3">
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
                  placeholder="New automation name"
                  aria-label="New automation name"
                  className="h-9 text-sm"
                />
                <Button
                  onClick={() => void handleCreate()}
                  disabled={busy || !newName.trim()}
                  size="sm"
                  className="h-9 shrink-0"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span className="sr-only">Create automation</span>
                </Button>
              </div>
            </GlassPanel>

            {rows.length === 0 ? (
              <EmptyState
                icon={<Workflow className="h-6 w-6" aria-hidden />}
                title="No automations yet"
                description="Create one to repeat an OCADE task on demand or on a schedule."
              />
            ) : (
              <nav aria-label="Automations" className="flex flex-col gap-1">
                {rows.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    aria-current={a.id === selectedId ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                      a.id === selectedId
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                    )}
                  >
                    <Workflow className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{a.name}</span>
                      {/* Honest scheduler state — why this isn't running now. */}
                      {skipReasons[a.id] ? (
                        <span className="block truncate text-[10px] opacity-70">
                          {skipReasons[a.id]}
                        </span>
                      ) : null}
                    </span>
                    {a.paused ? <span className="ml-auto text-[9px] uppercase">Paused</span> : null}
                  </button>
                ))}
              </nav>
            )}
          </div>

          {selected ? (
            <div className="flex flex-col gap-5">
              <GlassPanel className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{selected.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {describeTrigger(selected.trigger)}
                    </p>
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void showPreview(selected)}>
                      <Eye className="mr-1.5 h-4 w-4" /> Preview
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void run(selected, true)}
                      disabled={busy}
                    >
                      Dry run
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void run(selected, false)}
                      disabled={busy || selected.paused}
                    >
                      <Play className="mr-1.5 h-4 w-4" /> Run
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void togglePause(selected)}>
                      {selected.paused ? (
                        <PlayCircle className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                      <span className="sr-only">{selected.paused ? "Resume" : "Pause"}</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(selected)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selected.actions.length === 0
                    ? "No steps yet. This automation will do nothing until steps are added."
                    : `${selected.actions.length} step${selected.actions.length === 1 ? "" : "s"} · ${
                        selected.requires_approval ? "Requires approval" : "Runs without approval"
                      }`}
                </p>
                {selected.actions.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Steps execute through the Native Companion. Until it is connected and verified,
                    runs are recorded and previewed but no computer action is performed.
                  </p>
                ) : null}

                <details className="rounded-md border border-border/60 p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Edit definition and steps
                  </summary>
                  <div className="mt-3 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium">
                        Name
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="mt-1 h-8 text-xs"
                          maxLength={200}
                        />
                      </label>
                      <label className="text-xs font-medium">
                        Schedule
                        <select
                          value={editTrigger.kind}
                          onChange={(event) => {
                            const kind = event.target.value as AutomationRow["trigger"]["kind"];
                            if (kind === "manual") setEditTrigger({ kind });
                            else if (kind === "interval") {
                              setEditTrigger({ kind, everyMinutes: 60 });
                            } else if (kind === "daily") {
                              setEditTrigger({ kind, atHourUtc: 9, atMinuteUtc: 0 });
                            }
                          }}
                          className="mt-1 block h-8 w-full rounded-md border border-border/60 bg-transparent px-2 text-xs"
                        >
                          <option value="manual">Manual only</option>
                          <option value="interval">Recurring interval</option>
                          <option value="daily">Daily UTC</option>
                          {editTrigger.kind === "condition" ? (
                            <option value="condition">
                              Condition (saved; evaluator unavailable)
                            </option>
                          ) : null}
                        </select>
                      </label>
                    </div>

                    {editTrigger.kind === "interval" ? (
                      <label className="block text-xs font-medium">
                        Every minutes
                        <Input
                          type="number"
                          min={1}
                          max={43_200}
                          value={editTrigger.everyMinutes}
                          onChange={(event) =>
                            setEditTrigger({
                              kind: "interval",
                              everyMinutes: Math.max(
                                1,
                                Math.min(43_200, Number(event.target.value) || 1),
                              ),
                            })
                          }
                          className="mt-1 h-8 text-xs"
                        />
                      </label>
                    ) : editTrigger.kind === "daily" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium">
                          Hour UTC
                          <Input
                            type="number"
                            min={0}
                            max={23}
                            value={editTrigger.atHourUtc}
                            onChange={(event) =>
                              setEditTrigger({
                                ...editTrigger,
                                atHourUtc: Math.max(
                                  0,
                                  Math.min(23, Number(event.target.value) || 0),
                                ),
                              })
                            }
                            className="mt-1 h-8 text-xs"
                          />
                        </label>
                        <label className="text-xs font-medium">
                          Minute UTC
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            value={editTrigger.atMinuteUtc ?? 0}
                            onChange={(event) =>
                              setEditTrigger({
                                ...editTrigger,
                                atMinuteUtc: Math.max(
                                  0,
                                  Math.min(59, Number(event.target.value) || 0),
                                ),
                              })
                            }
                            className="mt-1 h-8 text-xs"
                          />
                        </label>
                      </div>
                    ) : editTrigger.kind === "condition" ? (
                      <p className="text-xs text-[color:var(--state-warning)]">
                        Conditional evaluation is not connected in this build. Switch to a supported
                        schedule before expecting automatic runs.
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-4 text-xs">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editEnabled}
                          onChange={(event) => setEditEnabled(event.target.checked)}
                        />
                        Enabled
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editRequiresApproval}
                          onChange={(event) => setEditRequiresApproval(event.target.checked)}
                        />
                        Always require approval
                      </label>
                      <label className="flex items-center gap-2">
                        Attempts
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={editMaxAttempts}
                          onChange={(event) =>
                            setEditMaxAttempts(
                              Math.max(1, Math.min(10, Number(event.target.value) || 1)),
                            )
                          }
                          className="h-7 w-16 text-xs"
                        />
                      </label>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium">Steps</p>
                      {editActions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Add at least one step. Empty real runs are blocked rather than left
                          permanently queued.
                        </p>
                      ) : (
                        <ol className="space-y-1.5">
                          {editActions.map((action, index) => (
                            <li
                              key={`${action.kind}-${index}`}
                              className="flex items-center gap-2 rounded-md bg-secondary/40 px-2 py-1.5 text-xs"
                            >
                              <span className="text-muted-foreground">{index + 1}.</span>
                              <span className="flex-1">{ACTION_LABEL[action.kind]}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7"
                                onClick={() =>
                                  setEditActions((current) =>
                                    current.filter((_, actionIndex) => actionIndex !== index),
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <select
                        value={newActionKind}
                        onChange={(event) => {
                          setNewActionKind(event.target.value as CompanionAction["kind"]);
                          setNewActionValue("");
                        }}
                        className="h-8 rounded-md border border-border/60 bg-transparent px-2 text-xs"
                        aria-label="New step type"
                      >
                        {ACTION_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {ACTION_LABEL[kind]}
                          </option>
                        ))}
                      </select>
                      {newActionKind === "window.arrange" ? (
                        <select
                          value={newActionLayout}
                          onChange={(event) =>
                            setNewActionLayout(event.target.value as typeof newActionLayout)
                          }
                          className="h-8 rounded-md border border-border/60 bg-transparent px-2 text-xs"
                          aria-label="Window layout"
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                          <option value="maximize">Maximize</option>
                          <option value="restore">Restore</option>
                        </select>
                      ) : actionNeedsValue(newActionKind) ? (
                        <Input
                          value={newActionValue}
                          onChange={(event) => setNewActionValue(event.target.value)}
                          placeholder="Target or approved content"
                          className="h-8 text-xs"
                          maxLength={5_000}
                        />
                      ) : (
                        <span className="self-center text-xs text-muted-foreground">
                          No target needed
                        </span>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={addDraftAction}
                      >
                        Add step
                      </Button>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => void saveDefinition(selected)}
                        disabled={busy || !editName.trim()}
                      >
                        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                        Save definition
                      </Button>
                    </div>
                  </div>
                </details>
              </GlassPanel>

              <GlassPanel className="p-4">
                <h3 className="mb-2 text-sm font-semibold">Run history</h3>
                {selectedRuns.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No runs yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {selectedRuns.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sidebar-accent/40"
                      >
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                            r.status === "succeeded" &&
                              "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]",
                            r.status === "failed" && "bg-destructive/15 text-destructive",
                            r.status === "blocked" && "bg-destructive/15 text-destructive",
                            r.status === "awaiting_approval" &&
                              "bg-[color:var(--state-warning)]/15 text-[color:var(--state-warning)]",
                            !["succeeded", "failed", "blocked", "awaiting_approval"].includes(
                              r.status,
                            ) && "bg-secondary text-muted-foreground",
                          )}
                        >
                          {r.cancel_requested_at
                            ? "cancellation requested"
                            : r.status.replace("_", " ")}
                        </span>
                        {r.dry_run ? (
                          <span className="text-[10px] uppercase text-muted-foreground">
                            dry run
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                        {r.blocked_reason ? (
                          <span className="text-xs text-destructive">{r.blocked_reason}</span>
                        ) : null}
                        {/*
                          A failed run either retries or is finished. Saying
                          which — and when — is the difference between "OCADE
                          gave up" and "OCADE is backing off".
                        */}
                        {r.status === "failed"
                          ? (() => {
                              const retry = retryReadyAt(
                                { attempt: r.attempt, createdAt: r.created_at },
                                selected?.max_attempts ?? 3,
                              );
                              return (
                                <span className="text-xs text-muted-foreground">
                                  {retry.retry && retry.readyAt
                                    ? `Retrying after ${retry.readyAt.toLocaleTimeString()}`
                                    : retry.reason}
                                </span>
                              );
                            })()
                          : null}
                        {r.status === "awaiting_approval" ? (
                          <span className="ml-auto flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void decide(r.id, "approved")}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void decide(r.id, "denied")}
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Deny
                            </Button>
                          </span>
                        ) : ["pending", "running"].includes(r.status) && !r.cancel_requested_at ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto"
                            onClick={() => void cancel(r.id)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </GlassPanel>
            </div>
          ) : (
            <EmptyState
              icon={<Workflow className="h-6 w-6" aria-hidden />}
              title="Select an automation"
              description="Choose one on the left, or create a new automation."
            />
          )}
        </div>
      )}

      {/* Plan / permission preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview — {preview?.name}</DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className="space-y-3 text-sm">
              {preview.plan.blocked ? (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {preview.plan.blockedReason ??
                      "This automation contains a step that can never run."}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Highest risk:{" "}
                  <span className="font-medium text-foreground">
                    {RISK_LABEL[preview.plan.highestRisk] ?? preview.plan.highestRisk}
                  </span>
                  {preview.plan.requiresApproval ? " · needs your approval" : ""}
                </p>
              )}
              {preview.plan.steps.length === 0 ? (
                <p className="text-xs text-muted-foreground">This automation has no steps.</p>
              ) : (
                <ol className="flex flex-col gap-1.5">
                  {preview.plan.steps.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-md bg-secondary/40 px-2.5 py-1.5 text-[13px]"
                    >
                      <span className="mt-0.5 text-[10px] text-muted-foreground">{i + 1}</span>
                      <span className="flex-1">{s.summary}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {RISK_LABEL[s.risk] ?? s.risk}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this automation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            “{confirmDelete?.name}” and its run history will be permanently deleted. This cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmDelete && void reallyDelete(confirmDelete)}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete automation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
