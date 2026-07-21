import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button } from "@/components/ui/button";
import { listSavedTopics, deleteTopic } from "@/lib/cania.functions";
import { CANIA_SECTIONS } from "@/lib/cania-sections";
import { toast } from "sonner";
import { recordAction } from "@/lib/actions";

export const Route = createFileRoute("/_authenticated/cania/saved")({
  head: () => ({ meta: [{ title: "CANIA · Saved topics" }, { name: "robots", content: "noindex" }] }),
  component: SavedPage,
});

function SavedPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cania", "topics"], queryFn: () => listSavedTopics() });
  const delFn = useServerFn(deleteTopic);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: async () => {
      await recordAction({ actionId: "cania.topic.delete" });
      qc.invalidateQueries({ queryKey: ["cania", "topics"] });
      toast.success("Topic removed");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <GlassPanel className="p-6 text-sm text-muted-foreground">Loading…</GlassPanel>;
  const topics = q.data ?? [];
  if (topics.length === 0) {
    return (
      <EmptyState
        title="No saved topics yet"
        description="Open any CANIA section and use Save topic to follow it here."
      />
    );
  }
  return (
    <GlassPanel className="divide-y divide-border/60">
      {topics.map((t) => {
        const s = CANIA_SECTIONS.find((sec) => sec.id === t.section);
        return (
          <div key={t.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{t.label}</div>
              <div className="truncate text-xs text-muted-foreground">
                {s?.title ?? t.section} · saved {new Date(t.created_at).toLocaleDateString()}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => del.mutate(t.id)}
              disabled={del.isPending}
              aria-label="Remove topic"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </GlassPanel>
  );
}
