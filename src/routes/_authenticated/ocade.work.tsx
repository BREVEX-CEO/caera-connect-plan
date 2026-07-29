import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { WorkOrchestratorPanel } from "@/components/ocade/WorkOrchestratorPanel";

export const Route = createFileRoute("/_authenticated/ocade/work")({
  head: () => ({
    meta: [{ title: "OCADE Work — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: WorkPage,
});

function WorkPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="OCADE"
        title="Work"
        description="Coordinate dependency-safe roles, checkpoints, pause and recovery, with success derived only from verified evidence."
      />
      <WorkOrchestratorPanel />
    </AppShell>
  );
}
