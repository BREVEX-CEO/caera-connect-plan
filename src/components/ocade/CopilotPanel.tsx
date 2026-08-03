import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  MonitorSmartphone,
  ShieldCheck,
  ShieldAlert,
  OctagonX,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/use-online";
import {
  getCompanion,
  guardAction,
  riskOf,
  redactForAudit,
  classifyCompanionCompletion,
  COMPANION_UNAVAILABLE_REASON,
  type CompanionAction,
  type CompanionStatus,
} from "@/lib/native/companion-bridge";
import {
  bootstrapCompanion,
  onCompanionEvent,
  TauriCompanion,
  type AuditEntry,
} from "@/lib/native/tauri-companion";
import { createDefaultRegistry, type AdapterCapability } from "@/lib/native/adapter-sdk";
import { requestApproval } from "@/lib/mobile/approval-store";
import {
  createTaskScope,
  checkScope,
  recordStep,
  cancelScope,
  describeScope,
  type TaskScope,
} from "@/lib/skills/task-scope";
import { WorkSessionPanel, seedHealth, applyOutcome } from "@/components/ocade/WorkSessionPanel";
import type { ResumableJob } from "@/lib/skills/adapter-health";
import { useShell } from "@/components/shell/shell-context";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import {
  computerUseChannelDecision,
  computerUsePermissionDecision,
} from "@/lib/computer-use-settings";

/**
 * Registers the Copilot panel with the surrounding WorkspaceShell so the shell
 * can show it in its adaptive right-hand slot. Render this INSIDE the shell
 * (e.g. within <AppShell>) — it renders nothing itself.
 */
export function CopilotMount() {
  const shell = useShell();
  const setCopilotContent = shell?.setCopilotContent;
  useEffect(() => {
    if (!setCopilotContent) return;
    // Boundary keeps a Copilot failure from taking down the workspace.
    setCopilotContent(
      <ErrorBoundary label="Desktop Copilot">
        <CopilotPanel />
      </ErrorBoundary>,
    );
    return () => setCopilotContent(null);
  }, [setCopilotContent]);
  return null;
}

/**
 * OCADE Desktop Copilot panel (Plan §21).
 *
 * The adaptive right-hand surface: companion health, what OCADE can do on this
 * machine, a risk-checked preview of any proposed action, and an always-present
 * emergency stop.
 *
 * Honesty: this panel reflects the REAL companion status. With no signed
 * companion connected, every capability is shown as unavailable with the reason
 * — it never renders a control that would silently do nothing.
 */
export function CopilotPanel() {
  const online = useOnline();
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState<CompanionAction | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [log, setLog] = useState<{ at: string; text: string; ok: boolean }[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [halted, setHalted] = useState(false);
  const [hostCaps, setHostCaps] = useState<string[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [allowApps, setAllowApps] = useState<string[]>([]);
  const [allowPaths, setAllowPaths] = useState<string[]>([]);
  const [allowDraft, setAllowDraft] = useState("");
  /** The single approval covering the task currently in progress. */
  const [scope, setScope] = useState<TaskScope | null>(null);
  const [job, setJob] = useState<ResumableJob | null>(null);
  /**
   * Route health, seeded with the methods the companion can actually offer.
   * Real outcomes are folded in as actions run, so the panel reports observed
   * behaviour rather than an assumption.
   */
  const [health, setHealth] = useState(() =>
    seedHealth(["adapter", "accessibility", "vision_input"]),
  );

  const registry = createDefaultRegistry();
  const capabilities: { adapter: string; caps: AdapterCapability[] }[] = registry
    .list()
    .map((a) => ({ adapter: a.id, caps: a.capabilities }));

  /** The host is the authority on what this build can do; the registry is only a catalogue. */
  const supported = useCallback(
    (kind: string) => (hostCaps === null ? false : hostCaps.includes(kind)),
    [hostCaps],
  );

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      // Inside the signed companion this opens a MAC-signed session first; in an
      // ordinary browser it is a no-op and the unavailable adapter stays active.
      const boot = await bootstrapCompanion();
      if (!boot.installed) {
        setStatus({ available: false, reason: boot.reason });
        return;
      }
      const companion = getCompanion();
      const next = await companion.status();
      setStatus(next);
      if (companion instanceof TauriCompanion) {
        setHostCaps(companion.capabilities());
        setHalted(companion.isHalted());
        setAudit(await companion.auditLog());
        // Hydrate from the HOST, which owns the allowlist. Starting from an
        // empty local list would show permissions the user does not have — and
        // the next edit would replace the host's list with just that entry.
        const allow = await companion.getAllowlist();
        setAllowApps(allow.apps);
        setAllowPaths(allow.paths);
      }
    } catch {
      setStatus({ available: false, reason: COMPANION_UNAVAILABLE_REASON });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live progress straight from the host, so the panel reflects what is actually
  // happening rather than only what this tab initiated.
  useEffect(() => {
    const offStart = onCompanionEvent("action-started", (p) => setRunning(String(p ?? "")));
    const offEnd = onCompanionEvent("action-finished", () => setRunning(null));
    const offStop = onCompanionEvent("emergency-stop", () => {
      setHalted(true);
      setRunning(null);
      setPending(null);
      appendLog("Emergency stop — all companion actions halted.", true);
    });
    return () => {
      offStart();
      offEnd();
      offStop();
    };
  }, []);

  function appendLog(text: string, ok: boolean) {
    setLog((l) =>
      [{ at: new Date().toLocaleTimeString(), text: redactForAudit(text), ok }, ...l].slice(0, 20),
    );
  }

  /** Preview an action: risk-check it before anything is proposed to the user. */
  function propose(action: CompanionAction) {
    const channelRefusal = computerUseChannelDecision("thisComputer");
    if (channelRefusal) {
      toast.error(channelRefusal);
      appendLog(`Refused: ${channelRefusal}`, false);
      return;
    }
    const risk = riskOf(action);
    const permissionRefusal = computerUsePermissionDecision(risk);
    if (permissionRefusal) {
      toast.error(permissionRefusal);
      appendLog(`Refused: ${permissionRefusal}`, false);
      return;
    }
    const refusal = guardAction(action, { confirmed: false });
    if (refusal && risk === "prohibited") {
      toast.error(refusal);
      appendLog(`Refused: ${refusal}`, false);
      return;
    }

    /*
     * Scoped approval: if a task is already approved and covers this action,
     * run it without asking again. Re-prompting inside an approved task trains
     * people to click through without reading.
     */
    const decision = checkScope(action, scope);
    if (decision.allow) {
      appendLog(`Covered by “${decision.scope.summary}” — running without asking again.`, true);
      void runAction(action, decision.scope);
      return;
    }
    if (!decision.escalate) {
      // No approval can cover this; refuse outright rather than prompting.
      toast.error(decision.reason);
      appendLog(`Refused: ${decision.reason}`, false);
      return;
    }

    setPending(action);

    /*
     * Raise a matching approval so a paired phone can answer it too. Without a
     * producer here the approvals queue had nothing in it and the whole
     * approve-from-mobile path was unreachable.
     *
     * The summary is redacted before it is stored — an approval is displayed on
     * a lock screen, and `describe()` can include an app name or file path.
     */
    if (risk === "confirm" || risk === "high") {
      try {
        requestApproval({ summary: redactForAudit(`OCADE wants to ${describe(action)}`), risk });
      } catch (error) {
        setPending(null);
        const detail = error instanceof Error ? error.message : "The approval could not be saved.";
        appendLog(`Approval unavailable: ${detail}`, false);
        toast.error(detail);
      }
    }
  }

  /** Execute one action. Shared by the confirm button and the scoped path. */
  async function runAction(action: CompanionAction, coveredScope?: TaskScope): Promise<boolean> {
    const channelRefusal = computerUseChannelDecision("thisComputer");
    if (channelRefusal) {
      appendLog(`Refused: ${channelRefusal}`, false);
      toast.error(channelRefusal);
      setPending(null);
      return false;
    }
    const permissionRefusal = computerUsePermissionDecision(riskOf(action));
    if (permissionRefusal) {
      appendLog(`Refused: ${permissionRefusal}`, false);
      toast.error(permissionRefusal);
      setPending(null);
      return false;
    }
    const id = crypto.randomUUID();
    setRunId(id);
    try {
      const startedAt = Date.now();
      const result = await getCompanion().execute(action, { runId: id, confirmed: true });
      // Fold the real outcome into route health so a failing route is skipped
      // next time rather than retried into the ground.
      setHealth((h) =>
        applyOutcome(h, "adapter", {
          ok: result.ok,
          latencyMs: Date.now() - startedAt,
          reason: result.ok ? undefined : result.detail,
        }),
      );
      const completion = classifyCompanionCompletion(result);
      if (completion.status === "completed_verified") {
        appendLog(completion.evidence, true);
        if (coveredScope) setScope(recordStep(coveredScope));
        toast.success("Action completed.");
        return true;
      }
      appendLog(completion.evidence, false);
      if (completion.status === "completed_unverified") {
        toast.warning("Action executed, but independent verification is unavailable.");
      } else {
        toast.error(completion.evidence);
      }
      return false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The companion could not run this action.";
      appendLog(msg, false);
      toast.error(msg);
      return false;
    } finally {
      setPending(null);
      setRunId(null);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    await runAction(pending);
  }

  async function cancelRun() {
    if (!runId) {
      setPending(null);
      return;
    }
    try {
      await getCompanion().cancel(runId);
      appendLog("Cancellation acknowledged by the companion.", true);
      toast.success("Cancellation acknowledged.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "The companion did not acknowledge cancellation.";
      appendLog(`Cancellation not confirmed: ${message}`, false);
      toast.error(message);
    } finally {
      setRunId(null);
      setPending(null);
    }
  }

  async function emergencyStop() {
    try {
      await getCompanion().emergencyStop();
      setHalted(true);
      appendLog("Emergency stop issued — all companion actions halted.", true);
      toast.success("Emergency stop acknowledged.");
      setPending(null);
      setRunId(null);
      setRunning(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not reach the companion to stop it.";
      appendLog(`Emergency stop not confirmed: ${message}`, false);
      toast.error(message);
    }
  }

  /** Clearing a latched stop is deliberately explicit — never automatic. */
  async function resumeAfterStop() {
    const companion = getCompanion();
    if (!(companion instanceof TauriCompanion)) return;
    try {
      await companion.resetEmergencyStop();
      setHalted(false);
      appendLog("Emergency stop cleared. OCADE can run actions again.", true);
      await refresh();
    } catch {
      toast.error("Could not clear the emergency stop.");
    }
  }

  /** Push the allowlist to the host, which re-checks it on every action. */
  async function saveAllowlist(apps: string[], paths: string[]): Promise<boolean> {
    const companion = getCompanion();
    if (!(companion instanceof TauriCompanion)) {
      toast.error("The companion is not connected, so permissions were not changed.");
      return false;
    }
    try {
      await companion.setAllowlist(apps, paths);
      setAllowApps(apps);
      setAllowPaths(paths);
      toast.success("Permitted apps and folders updated.");
      return true;
    } catch {
      toast.error("Couldn't update permissions on the companion.");
      return false;
    }
  }

  async function addAllowEntry() {
    const value = allowDraft.trim();
    if (!value) return;
    // A path-looking entry is a folder; anything else is an application name.
    const isPath = /[\\/]/.test(value);
    const apps = isPath ? allowApps : [...new Set([...allowApps, value])];
    const paths = isPath ? [...new Set([...allowPaths, value])] : allowPaths;
    if (await saveAllowlist(apps, paths)) setAllowDraft("");
  }

  const available = status?.available === true;

  return (
    <div className="flex h-full flex-col gap-4 text-sm">
      <div>
        <h2 className="text-[13px] font-semibold">Desktop Copilot</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          What OCADE can do on this computer, and everything it is doing right now.
        </p>
      </div>

      {/* Companion health */}
      <div className="rounded-lg border border-border/60 p-3">
        <div className="flex items-center gap-2">
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          ) : available ? (
            <ShieldCheck className="h-4 w-4 text-[color:var(--state-success)]" aria-hidden />
          ) : (
            <ShieldAlert className="h-4 w-4 text-[color:var(--state-warning)]" aria-hidden />
          )}
          <span className="font-medium">
            {checking
              ? "Checking companion…"
              : available
                ? "Companion connected"
                : "Companion not connected"}
          </span>
          {status?.version ? (
            <span className="ml-auto text-[11px] text-muted-foreground">v{status.version}</span>
          ) : null}
        </div>
        {!available && !checking ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {status?.reason ?? COMPANION_UNAVAILABLE_REASON}
          </p>
        ) : null}
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => void refresh()}>
          Re-check
        </Button>
      </div>

      {/* Latched emergency stop — recovery is explicit, never automatic */}
      {halted ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <OctagonX className="h-4 w-4" aria-hidden /> Emergency stop is active
          </p>
          <p className="mt-1 text-muted-foreground">
            Everything is halted and no action can run. Clear this when you're ready to continue.
          </p>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => void resumeAfterStop()}>
            Clear emergency stop
          </Button>
        </div>
      ) : null}

      {/* Live progress from the host */}
      {running ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3 text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          <span className="flex-1">Running {running}…</span>
          <Button size="sm" variant="ghost" onClick={() => void cancelRun()}>
            Cancel
          </Button>
        </div>
      ) : null}

      {/* Connectivity */}
      {!online ? (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-[color:var(--state-warning)]/10 p-3 text-xs">
          <WifiOff
            className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]"
            aria-hidden
          />
          <span>
            You're offline. On-device work continues; anything needing the cloud is paused.
          </span>
        </div>
      ) : null}

      {/* Capabilities — honest availability */}
      <div className="rounded-lg border border-border/60 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Capabilities
        </h3>
        <ul className="flex flex-col gap-1.5">
          {capabilities.map(({ adapter, caps }) => (
            <li key={adapter}>
              <p className="text-[12px] font-medium capitalize">{adapter}</p>
              <ul className="mt-0.5 flex flex-wrap gap-1">
                {caps.map((c) => {
                  // Only the HOST decides what this build can actually do.
                  const usable = available && supported(c.kind);
                  return (
                    <li
                      key={c.kind}
                      title={
                        usable
                          ? c.label
                          : available
                            ? "This companion build doesn't provide that yet."
                            : COMPANION_UNAVAILABLE_REASON
                      }
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px]",
                        usable
                          ? "bg-secondary text-muted-foreground"
                          : "bg-secondary/50 text-muted-foreground/60 line-through",
                      )}
                    >
                      {c.label}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        {!available ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Struck-through capabilities need the signed companion. Nothing here runs until it is
            connected.
          </p>
        ) : null}
      </div>

      {/* Demonstrable, risk-checked action preview */}
      <div className="rounded-lg border border-border/60 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Action preview
        </h3>
        {pending ? (
          <div className="space-y-2">
            <p className="text-[12px]">
              OCADE wants to: <span className="font-medium">{describe(pending)}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Risk: {riskOf(pending)}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void confirmPending()}>
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void cancelRun()}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              Nothing proposed. Actions always appear here for confirmation before they run.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => propose({ kind: "window.list" })}>
                Preview: list windows
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => propose({ kind: "text.type", text: "my password is hunter2" })}
              >
                Preview: protected text
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Activity */}
      <div className="min-h-0 flex-1 rounded-lg border border-border/60 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Activity
        </h3>
        {log.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No companion activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {log.map((l, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                {l.ok ? (
                  <CheckCircle2
                    className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--state-success)]"
                    aria-hidden
                  />
                ) : (
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" aria-hidden />
                )}
                <span className="text-muted-foreground">{l.at}</span>
                <span className="flex-1">{l.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Scoped task approval — approve once, not at every step */}
      <div className="rounded-lg border border-border/60 p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Task approval
        </h3>
        {scope && scope.status === "active" ? (
          <>
            <p className="text-[12px] font-medium">{scope.summary}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{describeScope(scope)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {scope.steps} {scope.steps === 1 ? "step" : "steps"} done under this approval.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => {
                setScope(cancelScope(scope));
                appendLog("Task approval cancelled.", true);
              }}
            >
              End approval
            </Button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              Approving a task once lets OCADE finish it without interrupting you at every step. It
              still asks for anything outside what you approved, and protected information is always
              refused.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => {
                // Scoped to exactly the read-only preview actions this panel offers.
                setScope(
                  createTaskScope({
                    id: crypto.randomUUID(),
                    summary: "Inspect this computer (read-only)",
                    capabilities: ["window.list", "screen.read", "selection.read"],
                  }),
                );
                toast.success("Task approved. OCADE won't ask again for these read-only steps.");
              }}
            >
              Approve a read-only task
            </Button>
          </>
        )}
      </div>

      {/* Allowlist — the host refuses anything not listed here */}
      {available ? (
        <div className="rounded-lg border border-border/60 p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Permitted apps and folders
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">
            OCADE can only open what's listed here. The companion re-checks this itself, so nothing
            else can be opened even if something asks.
          </p>
          <div className="flex gap-2">
            <input
              value={allowDraft}
              onChange={(e) => setAllowDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addAllowEntry();
              }}
              placeholder="App name, or a folder path"
              aria-label="App or folder to permit"
              className="h-8 flex-1 rounded-md border border-border/60 bg-transparent px-2 text-xs"
            />
            <Button
              size="sm"
              className="h-8"
              onClick={() => void addAllowEntry()}
              disabled={!allowDraft.trim()}
            >
              Add
            </Button>
          </div>
          {allowApps.length === 0 && allowPaths.length === 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Nothing permitted yet — OCADE cannot open any app or file.
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1">
              {[
                ...allowApps.map((a) => ({ value: a, isPath: false })),
                ...allowPaths.map((p) => ({ value: p, isPath: true })),
              ].map(({ value, isPath }) => (
                <li
                  key={`${isPath ? "p" : "a"}:${value}`}
                  className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px]"
                >
                  <span className="max-w-[14rem] truncate">{value}</span>
                  <button
                    onClick={() =>
                      void saveAllowlist(
                        isPath ? allowApps : allowApps.filter((a) => a !== value),
                        isPath ? allowPaths.filter((p) => p !== value) : allowPaths,
                      )
                    }
                    aria-label={`Remove ${value}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <XCircle className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* Host audit trail — redacted before it is stored */}
      {audit.length > 0 ? (
        <div className="rounded-lg border border-border/60 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Companion audit
          </h3>
          <ul className="flex flex-col gap-1">
            {audit
              .slice(-15)
              .reverse()
              .map((e, i) => (
                <li key={`${e.runId}-${i}`} className="flex items-start gap-1.5 text-[11px]">
                  {e.ok ? (
                    <CheckCircle2
                      className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--state-success)]"
                      aria-hidden
                    />
                  ) : (
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" aria-hidden />
                  )}
                  <span className="text-muted-foreground">
                    {new Date(e.at * 1000).toLocaleTimeString()}
                  </span>
                  <span className="flex-1">{e.detail}</span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Recorded by the companion itself and redacted before storage — protected input never
            appears here.
          </p>
        </div>
      ) : null}

      {/* Live work session — routes, keys, replay and undo */}
      <ErrorBoundary label="Work session">
        <WorkSessionPanel
          scope={scope}
          onScopeChange={setScope}
          job={job}
          onJobChange={setJob}
          health={health}
          inputs={[]}
          protectedFieldIds={[]}
          controls={{
            ...(runId ? { cancel: cancelRun } : {}),
            emergency_stop: emergencyStop,
          }}
        />
      </ErrorBoundary>

      {/* Devices + emergency stop */}
      <div className="flex flex-col gap-2">
        <Link
          to="/settings/devices"
          className="flex items-center gap-2 rounded-lg border border-border/60 p-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <MonitorSmartphone className="h-4 w-4" aria-hidden /> Paired devices
        </Link>
        <Button variant="ghost" size="sm" onClick={() => void emergencyStop()}>
          <OctagonX className="mr-1.5 h-4 w-4" /> Emergency stop
        </Button>
      </div>
    </div>
  );
}

function describe(a: CompanionAction): string {
  switch (a.kind) {
    case "screen.read":
      return "read the visible screen";
    case "window.list":
      return "list open windows";
    case "window.focus":
      return `focus “${a.target}”`;
    case "window.arrange":
      return `arrange a window (${a.layout})`;
    case "app.open":
      return `open “${a.appId}”`;
    case "file.open":
      return `open “${a.path}”`;
    case "text.type":
      return "type text";
    case "clipboard.read":
      return "read the clipboard";
    case "clipboard.write":
      return "write to the clipboard";
    case "selection.read":
      return "read what you have selected";
    case "selection.replace":
      return "replace what you have selected";
    default:
      return "run an action";
  }
}
