import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { ResearchPanel } from "@/components/ocade/ResearchPanel";
import { ScenePanel } from "@/components/ocade/ScenePanel";
import { PatchPanel } from "@/components/ocade/PatchPanel";
import { GovernedRunPanel } from "@/components/ocade/GovernedRunPanel";
import { DiagnosticsPanel } from "@/components/ocade/DiagnosticsPanel";
import { ConversationControls } from "@/components/ocade/ConversationControls";
import { EngineeringControlPanel } from "@/components/ocade/EngineeringControlPanel";
import { ResourceGovernorPanel } from "@/components/ocade/ResourceGovernorPanel";
import { LocalJobPlanPanel } from "@/components/ocade/LocalJobPlanPanel";
import { AppCoveragePanel } from "@/components/ocade/AppCoveragePanel";
import { PreflightPanel } from "@/components/ocade/PreflightPanel";
import { AnswerQualityPanel } from "@/components/ocade/AnswerQualityPanel";

export const Route = createFileRoute("/_authenticated/ocade/lab")({
  head: () => ({ meta: [{ title: "Lab — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: LabPage,
});

function LabPage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Lab"
        description="Engineering diagnostics, governed execution, research verification and runtime validation. This is intentionally technical; creative work lives in Studio."
        actions={<Link to="/ocade/studio" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Open Studio</Link>}
      />
      <div className="flex flex-col gap-5">
        <GlassPanel className="p-4">
          <p className="text-sm text-muted-foreground">Lab surfaces inspect what OCADE can prove before a run, patch, browser/research claim or visual output is accepted. A diagnostic result is evidence, not a substitute for production runtime verification.</p>
        </GlassPanel>
        <ConversationControls />
        <GovernedRunPanel />
        <PreflightPanel />
        <ResearchPanel />
        <AnswerQualityPanel />
        <PatchPanel />
        <DiagnosticsPanel />
        <EngineeringControlPanel />
        <ResourceGovernorPanel />
        <LocalJobPlanPanel />
        <AppCoveragePanel />
        <ScenePanel />
      </div>
    </>
  );
}
