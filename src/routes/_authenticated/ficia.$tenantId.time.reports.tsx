import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { executeAction } from "@/lib/actions";
import { reportRollup, lockPeriod } from "@/lib/timesheet.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId/time/reports")({
  head: () => ({
    meta: [{ title: "Timesheet Reports — FICIA" }, { name: "robots", content: "noindex" }],
  }),
  component: ReportsPage,
});

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function ReportsPage() {
  const { tenantId } = Route.useParams();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<"user" | "project">("user");

  const q = useQuery({
    queryKey: ["time.report", tenantId, from, to],
    queryFn: () => reportRollup({ data: { tenant_id: tenantId, from, to } }),
  });

  async function lock() {
    const res = await executeAction("ficia.time.period.lock", {
      confirmPhrase: "LOCK",
      tenantId,
      metadata: { from, to },
      run: () => lockPeriod({ data: { tenant_id: tenantId, period_start: from, period_end: to } }),
    });
    if ((res as any).ok === false) toast.error((res as any).message);
    else toast.success("Period locked. Approved entries in this range are now immutable.");
  }

  const rows = (() => {
    const d = q.data;
    if (!d)
      return [] as Array<{
        key: string;
        total_seconds: number;
        billable_seconds: number;
        manual_seconds: number;
        ai_assisted_seconds: number;
        autonomous_seconds: number;
        overtime_seconds: number;
        amount_cents?: number;
        currency?: string | null;
      }>;
    if (groupBy === "user") {
      return Object.entries(d.byUser).map(([uid, v]) => ({
        key: `user ${uid.slice(0, 8)}…`,
        total_seconds: v.seconds,
        billable_seconds: v.billable_seconds,
        manual_seconds: v.manual,
        ai_assisted_seconds: v.assisted,
        autonomous_seconds: v.autonomous,
        overtime_seconds: 0,
      }));
    }
    return Object.entries(d.byProject).map(([pid, v]) => ({
      key: pid === "_unassigned" ? "— Unassigned —" : `project ${pid.slice(0, 8)}…`,
      total_seconds: v.seconds,
      billable_seconds: v.billable_seconds,
      manual_seconds: 0,
      ai_assisted_seconds: 0,
      autonomous_seconds: 0,
      overtime_seconds: 0,
      amount_cents: v.amount_cents,
      currency: v.currency,
    }));
  })();
  const totalSec = rows.reduce((a, r) => a + (r.total_seconds ?? 0), 0);
  const billableSec = rows.reduce((a, r) => a + (r.billable_seconds ?? 0), 0);
  const otSec = rows.reduce((a, r) => a + (r.overtime_seconds ?? 0), 0);

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          to="/ficia/$tenantId/time"
          params={{ tenantId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Timesheets
        </Link>
      </div>
      <PageHeader
        eyebrow="FICIA — Time"
        title="Reports"
        description="Reconcile approved entries. Payroll- and client-billing-ready views."
      />

      <GlassPanel className="mt-4 p-4">
        <div className="grid gap-3 md:grid-cols-5 items-end">
          <div className="grid gap-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Group by</Label>
            <select
              aria-label="Group time report by"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
            >
              <option value="user">Employee</option>
              <option value="project">Project</option>
            </select>
          </div>
          <div />
          <Button size="sm" variant="destructive" onClick={lock}>
            <Lock className="size-4 mr-1" /> Lock period
          </Button>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-3 text-sm">
          <SummaryCard label="Total approved" value={fmt(totalSec)} />
          <SummaryCard label="Billable" value={fmt(billableSec)} />
          <SummaryCard label="Overtime" value={fmt(otSec)} />
        </div>

        <div className="mt-4 overflow-auto">
          {q.isLoading && <Loader2 className="size-4 animate-spin" />}
          {!q.isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No approved entries in range.</p>
          )}
          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground text-left">
                <tr>
                  <th className="py-2">Key</th>
                  <th>Total</th>
                  <th>Billable</th>
                  <th>Overtime</th>
                  <th>Manual</th>
                  <th>AI-assisted</th>
                  <th>Autonomous</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="py-2 font-medium">{r.key ?? "—"}</td>
                    <td className="font-mono tabular-nums">{fmt(r.total_seconds ?? 0)}</td>
                    <td className="font-mono tabular-nums">{fmt(r.billable_seconds ?? 0)}</td>
                    <td className="font-mono tabular-nums">{fmt(r.overtime_seconds ?? 0)}</td>
                    <td className="font-mono tabular-nums">{fmt(r.manual_seconds ?? 0)}</td>
                    <td className="font-mono tabular-nums">{fmt(r.ai_assisted_seconds ?? 0)}</td>
                    <td className="font-mono tabular-nums">{fmt(r.autonomous_seconds ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Reports include only approved entries. Locking a period marks approved entries as
          immutable — future edits require an authorized unlock action.
        </p>
      </GlassPanel>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold font-mono tabular-nums mt-1">{value}</div>
    </div>
  );
}
