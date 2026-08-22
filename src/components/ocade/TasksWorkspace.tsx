import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Loader2, Pause, Play, RefreshCw, Square, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { useSession } from "@/lib/session";
import {
  listAutomations,
  listAutomationRuns,
  updateAutomation,
  cancelAutomationRun,
  pauseAutomationRun,
  resumeAutomationRun,
} from "@/lib/ocade-automations.functions";

/**
 * The tasks surface, shared by `/ocade/tasks` and `/settings/tasks`.
 *
 * It was written inside the settings route, which made Tasks a settings page —
 * but a run you can stop is work, not a preference, and OCADE's tool list needs
 * the same screen. Extracted rather than copied: two task lists that could
 * disagree about whether a run is still live is exactly the kind of drift that
 * makes a Stop button untrustworthy.
 *
 * Everything shown here comes from `ocade_automations` and
 * `ocade_automation_runs`. There is no placeholder row: an account with no
 * automations sees that it has none.
 */

const LIVE = new Set(["queued", "running", "awaiting_approval", "paused"]);

export function TasksWorkspace({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const fetchAutomations = useServerFn(listAutomations);
  const fetchRuns = useServerFn(listAutomationRuns);
  const patch = useServerFn(updateAutomation);
  const cancel = useServerFn(cancelAutomationRun);
  const pause = useServerFn(pauseAutomationRun);
  const resume = useServerFn(resumeAutomationRun);

  const automations = useQuery({
    queryKey: ["settings-tasks", "automations", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchAutomations(),
  });

  const runs = useQuery({
    queryKey: ["settings-tasks", "runs", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchRuns({ data: {} }),
    refetchInterval: 10_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["settings-tasks"] });
  };

  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled?: boolean; paused?: boolean }) => patch({ data: v }),
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
  });

  const runAction = useMutation({
    mutationFn: async (v: { runId: string; kind: "cancel" | "pause" | "resume" }) => {
      if (v.kind === "cancel") return cancel({ data: { runId: v.runId } });
      if (v.kind === "pause") return pause({ data: { runId: v.runId } });
      return resume({ data: { runId: v.runId } });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
  });

  const nameOf = (id: string) =>
    automations.data?.find((a) => a.id === id)?.name ?? "Removed automation";

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Automations & runs"
        description="Every scheduled task on this account, and every run it has produced. Pause, resume or stop a run from here."
        actions={
          <Link
            to={backTo}
            className="inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← {backLabel}
          </Link>
        }
      />

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}

      {/* Automations */}
      <GlassPanel className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Automations</h2>
          </div>
          <button
            onClick={() => void automations.refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>

        {automations.isPending ? (
          <Loading label="Reading automations…" />
        ) : automations.isError ? (
          <ErrorRow
            message={
              automations.error instanceof Error ? automations.error.message : "Could not load."
            }
            onRetry={() => void automations.refetch()}
          />
        ) : automations.data.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No automations yet.{" "}
            <Link to="/ocade/automations" className="text-foreground underline underline-offset-2">
              Create one in OCADE
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/40">
            {automations.data.map((a) => {
              const busy = toggle.isPending && toggle.variables?.id === a.id;
              return (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{a.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={a.enabled && !a.paused ? "active" : "planned"} />
                      <span>{a.dry_run ? "dry run" : "live"}</span>
                      <span>
                        Next{" "}
                        {a.next_run_at ? new Date(a.next_run_at).toLocaleString() : "on demand"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : null}
                    <button
                      onClick={() => toggle.mutate({ id: a.id, paused: !a.paused })}
                      disabled={busy}
                      className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
                    >
                      {a.paused ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={() => toggle.mutate({ id: a.id, enabled: !a.enabled })}
                      disabled={busy}
                      className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
                    >
                      {a.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>

      {/* Runs */}
      <GlassPanel className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent runs</h2>
          <button
            onClick={() => void runs.refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>

        {runs.isPending ? (
          <Loading label="Reading runs…" />
        ) : runs.isError ? (
          <ErrorRow
            message={runs.error instanceof Error ? runs.error.message : "Could not load."}
            onRetry={() => void runs.refetch()}
          />
        ) : runs.data.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing has run yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/40">
            {runs.data.slice(0, 40).map((r) => {
              const busy = runAction.isPending && runAction.variables?.runId === r.id;
              const live = LIVE.has(r.status);
              return (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">
                      {nameOf(r.automation_id)}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded border border-border/60 px-1.5 py-0.5">
                        {r.status}
                      </span>
                      <span>attempt {r.attempt}</span>
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                      {r.error ? (
                        <span className="text-destructive">{r.error}</span>
                      ) : r.blocked_reason ? (
                        <span className="text-[color:var(--state-warning)]">
                          {r.blocked_reason}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : null}
                    {r.status === "paused" ? (
                      <IconButton
                        label="Resume run"
                        disabled={busy}
                        onClick={() => runAction.mutate({ runId: r.id, kind: "resume" })}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </IconButton>
                    ) : live ? (
                      <IconButton
                        label="Pause run"
                        disabled={busy}
                        onClick={() => runAction.mutate({ runId: r.id, kind: "pause" })}
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </IconButton>
                    ) : null}
                    {live ? (
                      <IconButton
                        label="Stop run"
                        disabled={busy}
                        onClick={() => runAction.mutate({ runId: r.id, kind: "cancel" })}
                      >
                        <Square className="h-3.5 w-3.5" />
                      </IconButton>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.finished_at ? "finished" : "—"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>
    </>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <span className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {message}
      </span>
      <button onClick={onRetry} className="underline underline-offset-2">
        Retry
      </button>
    </div>
  );
}
