import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { ResearchPanel } from "@/components/ocade/ResearchPanel";
import { ScenePanel } from "@/components/ocade/ScenePanel";
import { PatchPanel } from "@/components/ocade/PatchPanel";
import { GovernedRunPanel } from "@/components/ocade/GovernedRunPanel";
import { DiagnosticsPanel } from "@/components/ocade/DiagnosticsPanel";
import { ControlSimulatorPanel } from "@/components/ocade/ControlSimulatorPanel";
import { ConversationControls } from "@/components/ocade/ConversationControls";
import { CreativeControlPanel } from "@/components/ocade/CreativeControlPanel";
import { EngineeringControlPanel } from "@/components/ocade/EngineeringControlPanel";
import { ResourceGovernorPanel } from "@/components/ocade/ResourceGovernorPanel";
import { LocalJobPlanPanel } from "@/components/ocade/LocalJobPlanPanel";
import { AppCoveragePanel } from "@/components/ocade/AppCoveragePanel";
import { PreflightPanel } from "@/components/ocade/PreflightPanel";
import { AnswerQualityPanel } from "@/components/ocade/AnswerQualityPanel";

export const Route = createFileRoute("/_authenticated/ocade/studio")({
  head: () => ({
    meta: [{ title: "Studio — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: StudioPage,
});

/**
 * Research and 3D, in one place because they share a failure mode: both produce
 * output that looks finished and is wrong, and in both cases the check that
 * catches it is cheap and runs before the expensive part.
 *
 * A red road is not an accident. A video with no parallax is not a model. The
 * panels below run the real code on exactly those cases.
 */
function StudioPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="OCADE"
        title="Studio"
        description="Research judgment and 3D validation — the checks that run before OCADE commits to an answer or a render."
      />

      <div className="flex flex-col gap-5">
        <GlassPanel className="p-4">
          <p className="text-sm text-muted-foreground">
            These surfaces share a failure mode: output that looks finished and is wrong.
            Corroboration that was really one wire story; a patch fuzzed into the wrong function; a
            mesh with no geometry behind it. Every check here is cheap and runs first.
          </p>
        </GlassPanel>

        <ConversationControls />
        <GovernedRunPanel />
        <PreflightPanel />
        <ResearchPanel />
        <AnswerQualityPanel />
        <PatchPanel />
        <DiagnosticsPanel />
        <ControlSimulatorPanel />
        <CreativeControlPanel />
        <EngineeringControlPanel />
        <ResourceGovernorPanel />
        <LocalJobPlanPanel />
        <AppCoveragePanel />
        <ScenePanel />
      </div>
    </AppShell>
  );
}
