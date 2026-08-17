import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ocade/activity")({
  head: () => ({ meta: [{ title: "Activity — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: ActivityPage,
});

type ActivityRow = {
  id: string;
  created_at: string;
  action: string;
  feature_id: string | null;
  metadata: Record<string, unknown> | null;
};

function ActivityPage() {
  const activity = useQuery<ActivityRow[]>({
    queryKey: ["ocade-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, created_at, action, feature_id, metadata")
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
    refetchInterval: 30_000,
  });
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Activity"
        description="Recent recorded actions from the real account activity ledger. For compliance-chain inspection and clearing controls, use the full Activity settings page."
        actions={<button onClick={() => void activity.refetch()} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>}
      />
      <GlassPanel className="mt-6 overflow-hidden p-0">
        {activity.isPending ? (
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading activity…</div>
        ) : activity.isError ? (
          <div role="alert" className="p-5 text-sm text-destructive">Activity could not be read: {activity.error instanceof Error ? activity.error.message : String(activity.error)}</div>
        ) : activity.data.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No recorded activity yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {activity.data.map((row) => (
              <li key={row.id} className="flex gap-3 px-4 py-3">
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-foreground">{row.action}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.feature_id ?? "system"} · {new Date(row.created_at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
      <Link to="/settings/activity" className="mt-4 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Open full operational & compliance activity</Link>
    </>
  );
}
