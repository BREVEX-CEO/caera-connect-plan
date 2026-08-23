import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, Loader2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { TruthfulFailurePanel } from "@/components/ocade/TruthfulFailurePanel";
import { useSession } from "@/lib/session";
import { listAutomations, listAutomationRuns } from "@/lib/ocade-automations.functions";
import { taskFromAutomationRun } from "@/lib/tasks/unified-task";

export const Route = createFileRoute("/_authenticated/ocade/inbox")({
  head: () => ({ meta: [{ title: "Inbox — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: InboxPage,
});

const PENDING = new Set(["PLANNING", "WAITING_PERMISSION", "WAITING_USER"]);
const FAILURE = new Set(["FAILED", "CANCELLED"]);

function InboxPage() {
  const { user } = useSession();
  const fetchAutomations = useServerFn(listAutomations);
  const fetchRuns = useServerFn(listAutomationRuns);
  const automations = useQuery({
    queryKey: ["ocade-inbox", "automations", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchAutomations(),
  });
  const runs = useQuery({
    queryKey: ["ocade-inbox", "runs", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchRuns({ data: {} }),
    refetchInterval: 15_000,
  });
  const nameOf = (id: string) =>
    automations.data?.find((item) => item.id === id)?.name ?? "Automation";
  const tasks = (runs.data ?? []).map((run) =>
    taskFromAutomationRun(run, nameOf(run.automation_id)),
  );
  const pending = tasks.filter((task) => PENDING.has(task.status));
  const outcomes = tasks.filter((task) => !PENDING.has(task.status)).slice(0, 30);
  const loading = automations.isPending || runs.isPending;
  const error = automations.error ?? runs.error;

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Inbox"
        description="Approvals and background outcomes that actually exist on this account. OCADE does not invent notifications for work that never ran."
      />
      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading background work…
        </div>
      ) : error ? (
        <TruthfulFailurePanel
          className="mt-6"
          title="Inbox could not be read"
          failed={error instanceof Error ? error.message : String(error)}
          safe="No approval or automation state was changed by this read failure."
          notDone="OCADE did not mark any task completed, approved, cancelled or failed on your behalf."
          alternative="Open Tasks or Automations directly; their underlying records remain authoritative."
          retry={() => {
            void automations.refetch();
            void runs.refetch();
          }}
        />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <GlassPanel className="p-5">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Needs attention</h2>
            </div>
            {pending.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing is waiting for you right now.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/40">
                {pending.map((task) => (
                  <li key={task.id} className="py-3">
                    <div className="flex items-start gap-2">
                      {task.status === "WAITING_PERMISSION" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-[color:var(--state-warning)]" />
                      ) : (
                        <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {task.currentStep ?? task.status.replaceAll("_", " ").toLowerCase()}
                        </p>
                        <Link
                          to="/ocade/tasks"
                          className="mt-2 inline-block text-xs underline underline-offset-4"
                        >
                          Review task
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
          <GlassPanel className="p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Recent outcomes</h2>
            </div>
            {outcomes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No completed background runs yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border/40">
                {outcomes.map((task) => (
                  <li key={task.id} className="flex items-start gap-2 py-3">
                    {FAILURE.has(task.status) ? (
                      <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--state-success)]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.status.toLowerCase()} ·{" "}
                        {new Date(task.finishedAt ?? task.updatedAt).toLocaleString()}
                      </p>
                      {task.lastError ? (
                        <p className="mt-1 text-xs text-destructive">{task.lastError}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </div>
      )}
    </>
  );
}
