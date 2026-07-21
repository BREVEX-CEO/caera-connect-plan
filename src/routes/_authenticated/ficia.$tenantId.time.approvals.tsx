import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, RotateCcw, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { executeAction } from "@/lib/actions";
import { listPendingApprovals, decideEntry } from "@/lib/timesheet.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId/time/approvals")({
  head: () => ({ meta: [{ title: "Timesheet Approvals — FICIA" }, { name: "robots", content: "noindex" }] }),
  component: ApprovalsPage,
});

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function ApprovalsPage() {
  const { tenantId } = Route.useParams();
  const qc = useQueryClient();
  const pendingQ = useQuery({
    queryKey: ["time.pending", tenantId],
    queryFn: () => listPendingApprovals({ data: { tenant_id: tenantId } }),
  });

  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, decision: "approve" | "reject" | "request_correction") {
    const reason = reasons[id] ?? "";
    if ((decision === "reject" || decision === "request_correction") && reason.trim().length < 3) {
      toast.error("Reason required."); return;
    }
    setBusy(id);
    try {
      const actionId = decision === "approve" ? "ficia.time.entry.approve"
        : decision === "reject" ? "ficia.time.entry.reject"
        : "ficia.time.entry.request_correction";
      const res = await executeAction(actionId, {
        confirmed: true, tenantId,
        run: () => decideEntry({ data: { tenant_id: tenantId, id, decision, reason: reason || null } }),
      });
      if ((res as any).ok === false) toast.error((res as any).message);
      else { qc.invalidateQueries({ queryKey: ["time.pending", tenantId] }); }
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
    finally { setBusy(null); }
  }

  const rows = (pendingQ.data?.entries ?? []) as any[];

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/ficia/$tenantId/time" params={{ tenantId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Timesheets
        </Link>
      </div>
      <PageHeader eyebrow="FICIA — Time" title="Approval queue" description="Review submitted entries from workers you manage." />

      <GlassPanel className="mt-4 p-4">
        {pendingQ.isLoading && <Loader2 className="size-4 animate-spin" />}
        {!pendingQ.isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending. All caught up.</p>}
        <ul className="divide-y divide-border/40">
          {rows.map((e) => (
            <li key={e.id} className="py-3 text-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="w-24 text-muted-foreground">{e.entry_date}</span>
                <span className="font-mono w-20 tabular-nums">{fmt(e.duration_seconds ?? 0)}</span>
                <StatusBadge status="pending">submitted</StatusBadge>
                <span className="text-xs uppercase text-muted-foreground">{e.source}</span>
                {e.billable && <span className="text-xs text-[color:var(--state-info)]">billable</span>}
                <span className="text-xs text-muted-foreground">user {String(e.user_id).slice(0, 8)}…</span>
                <span className="truncate flex-1">{e.description ?? <span className="italic text-muted-foreground">no description</span>}</span>
              </div>
              <div className="mt-2 flex gap-2 items-center">
                <Input
                  placeholder="Reason (required to reject or request correction)"
                  value={reasons[e.id] ?? ""}
                  onChange={(ev) => setReasons((r) => ({ ...r, [e.id]: ev.target.value }))}
                  className="h-8 text-xs flex-1"
                />
                <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => decide(e.id, "request_correction")}>
                  <RotateCcw className="size-3.5 mr-1" /> Request fix
                </Button>
                <Button size="sm" variant="destructive" disabled={busy === e.id} onClick={() => decide(e.id, "reject")}>
                  <X className="size-3.5 mr-1" /> Reject
                </Button>
                <Button size="sm" disabled={busy === e.id} onClick={() => decide(e.id, "approve")}>
                  {busy === e.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 mr-1" />} Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </AppShell>
  );
}
