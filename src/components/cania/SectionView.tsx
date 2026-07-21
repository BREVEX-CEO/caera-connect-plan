import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookmarkPlus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { DataCard } from "./DataCard";
import { CANIA_SECTIONS, type CaniaSectionDef } from "@/lib/cania-sections";
import { providersForSection } from "@/lib/cania-providers";
import { isDemoActive } from "@/lib/demo/context";
import { listSavedTopics, saveTopic, listAlerts, saveAlert } from "@/lib/cania.functions";
import { recordAction } from "@/lib/actions";
import { toast } from "sonner";

/**
 * SectionView — one reusable body for every CANIA section leaf.
 *
 * Renders provider adapter cards as truthful DataCards (setup_required until
 * an operator connects them). Adds Save Topic / Add Alert actions that write
 * to the user's Supabase rows. Demo Mode shows one labelled sample card.
 */
export function SectionView({ sectionId }: { sectionId: string }) {
  const def = CANIA_SECTIONS.find((s) => s.id === sectionId);
  if (!def) {
    return (
      <SetupRequiredState
        title="Unknown CANIA section"
        description="This section is not registered. Return to the overview."
      />
    );
  }
  return <SectionViewInner def={def} />;
}

function SectionViewInner({ def }: { def: CaniaSectionDef }) {
  const qc = useQueryClient();
  const demo = typeof window !== "undefined" && isDemoActive();
  const providers = providersForSection(def.id);

  const topicsQ = useQuery({
    queryKey: ["cania", "topics"],
    queryFn: () => listSavedTopics(),
  });
  const alertsQ = useQuery({
    queryKey: ["cania", "alerts"],
    queryFn: () => listAlerts(),
  });

  const saveTopicFn = useServerFn(saveTopic);
  const saveAlertFn = useServerFn(saveAlert);

  const saveTopicMut = useMutation({
    mutationFn: (label: string) =>
      saveTopicFn({ data: { section: def.id, label, query: null } }),
    onSuccess: async () => {
      await recordAction({ actionId: "cania.topic.save", metadata: { section: def.id } });
      qc.invalidateQueries({ queryKey: ["cania", "topics"] });
      toast.success("Topic saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveAlertMut = useMutation({
    mutationFn: (label: string) =>
      saveAlertFn({ data: { section: def.id, label, channel: "in_app", enabled: true } }),
    onSuccess: async () => {
      await recordAction({ actionId: "cania.alert.create", metadata: { section: def.id } });
      qc.invalidateQueries({ queryKey: ["cania", "alerts"] });
      toast.success("Alert created");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const sectionTopics = (topicsQ.data ?? []).filter((t) => t.section === def.id);
  const sectionAlerts = (alertsQ.data ?? []).filter((a) => a.section === def.id);

  return (
    <div className="flex flex-col gap-4">
      {def.supportsTopics || def.supportsAlerts ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {sectionTopics.length} saved topic{sectionTopics.length === 1 ? "" : "s"} ·{" "}
            {sectionAlerts.length} alert{sectionAlerts.length === 1 ? "" : "s"} in this section
          </div>
          <div className="flex flex-wrap gap-2">
            {def.supportsTopics ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const label = window.prompt("Save this section as a topic. Give it a short name:");
                  if (label && label.trim()) saveTopicMut.mutate(label.trim());
                }}
                disabled={saveTopicMut.isPending}
              >
                <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" /> Save topic
              </Button>
            ) : null}
            {def.supportsAlerts ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const label = window.prompt("Create an alert for this section. Short name:");
                  if (label && label.trim()) saveAlertMut.mutate(label.trim());
                }}
                disabled={saveAlertMut.isPending}
              >
                <Bell className="mr-1.5 h-3.5 w-3.5" /> Add alert
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {providers.length === 0 ? (
        <SetupRequiredState
          title="No adapters registered"
          description="This section has no data adapters yet. Nothing will be fabricated."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => (
            <DataCard
              key={p.id}
              title={p.displayName}
              meta={{
                source: p.displayName,
                retrievedAt: null,
                label: p.defaultLabel,
                providerStatus: "setup_required",
                permission: def.requiresLocation ? "needs_prompt" : "not_required",
              }}
            >
              <p className="text-xs text-muted-foreground">{p.coverage}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Setup: {p.setupHint}</p>
            </DataCard>
          ))}
        </div>
      )}

      {demo ? (
        <GlassPanel className="p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--state-warning)]">
            Sample content (Demo Mode)
          </div>
          <DataCard
            title={`Sample ${def.title.toLowerCase()} card`}
            meta={{
              source: "Demo Mode sample",
              retrievedAt: new Date().toISOString(),
              label: "ai_summary",
              providerStatus: "connected",
              permission: "not_required",
              demo: true,
            }}
          >
            This is a labelled sample so you can see the intended card layout. It is not real world data.
          </DataCard>
        </GlassPanel>
      ) : null}
    </div>
  );
}
