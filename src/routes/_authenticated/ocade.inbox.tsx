import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, Loader2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useSession } from "@/lib/session";
import { listAutomations, listAutomationRuns } from "@/lib/ocade-automations.functions";

export const Route = createFileRoute("/_authenticated/ocade/inbox")({
  head: () => ({ meta: [{ title: "Inbox — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: InboxPage,
});

const PENDING = new Set(["awaiting_approval", "paused", "queued"]);
const FAILURE = new Set(["failed", "cancelled"]);

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
  const nameOf = (id: string) => automations.data?.find((item) => item.id === id)?.name ?? "Automation";
  const pending = (runs.data ?? []).filter((run) => PENDING.has(run.status));
  const outcomes = (runs.data ?? []).filter((run) => !PENDING.has(run.status)).slice(0, 30);
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
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading background work…</div>
      ) : error ? (
        <div role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Inbox data could not be read: {error instanceof Error ? error.message : String(error)}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <GlassPanel className="p-5">
            <div className="flex items-center gap-2"><Inbox className="h-4 w-4" /><h2 className="text-sm font-semibold">Needs attention</h2></div>
            {pending.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing is waiting for you right now.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/40">
                {pending.map((run) => (
                  <li key={run.id} className="py-3">
                    <div className="flex items-start gap-2">
                      {run.status === "awaiting_approval" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-[color:var(--state-warning)]" /> : <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{nameOf(run.automation_id)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{run.blocked_reason ?? run.status.replaceAll("_", " ")}</p>
                        <Link to="/ocade/tasks" className="mt-2 inline-block text-xs underline underline-offset-4">Review task</Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
          <GlassPanel className="p-5">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /><h2 className="text-sm font-semibold">Recent outcomes</h2></div>
            {outcomes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No completed background runs yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/40">
                {outcomes.map((run) => (
                  <li key={run.id} className="flex items-start gap-2 py-3">
                    {FAILURE.has(run.status) ? <XCircle className="mt-0.5 h-4 w-4 text-destructive" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--state-success)]" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{nameOf(run.automation_id)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{run.status} · {new Date(run.finished_at ?? run.created_at).toLocaleString()}</p>
                      {run.error ? <p className="mt-1 text-xs text-destructive">{run.error}</p> : null}
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
