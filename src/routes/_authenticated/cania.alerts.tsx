import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { listAlerts, updateAlert, deleteAlert } from "@/lib/cania.functions";
import { CANIA_SECTIONS } from "@/lib/cania-sections";
import { toast } from "sonner";
import { recordAction } from "@/lib/actions";

export const Route = createFileRoute("/_authenticated/cania/alerts")({
  head: () => ({ meta: [{ title: "CANIA · Alerts" }, { name: "robots", content: "noindex" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cania", "alerts"], queryFn: () => listAlerts() });
  const updateFn = useServerFn(updateAlert);
  const delFn = useServerFn(deleteAlert);

  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => updateFn({ data: v }),
    onSuccess: async () => {
      await recordAction({ actionId: "cania.alert.toggle" });
      qc.invalidateQueries({ queryKey: ["cania", "alerts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: async () => {
      await recordAction({ actionId: "cania.alert.delete" });
      qc.invalidateQueries({ queryKey: ["cania", "alerts"] });
      toast.success("Alert removed");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <GlassPanel className="p-6 text-sm text-muted-foreground">Loading…</GlassPanel>;
  const alerts = q.data ?? [];
  if (alerts.length === 0) {
    return (
      <EmptyState
        title="No alerts configured"
        description="Open any CANIA section and use Add alert. Alerts fire only after their provider is connected."
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Alerts you configure here are stored per user. They will start firing once the underlying provider adapter is connected.
      </p>
      <GlassPanel className="divide-y divide-border/60">
        {alerts.map((a) => {
          const s = CANIA_SECTIONS.find((sec) => sec.id === a.section);
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{a.label}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {s?.title ?? a.section} · {a.channel === "in_app" ? "In-app" : a.channel === "email" ? "Email" : "Push"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={a.enabled}
                  onCheckedChange={(v) => toggle.mutate({ id: a.id, enabled: v })}
                  aria-label="Enable alert"
                />
                <Button size="sm" variant="ghost" onClick={() => del.mutate(a.id)} aria-label="Remove alert">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </GlassPanel>
    </div>
  );
}
