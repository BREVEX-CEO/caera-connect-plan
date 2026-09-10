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

/**
 * THE LAB, INSIDE CUSTOMIZE.
 *
 * `PLAN.md` §4: "labs into Settings or Customize." These panels inspect what
 * OCADE can prove before a run, a patch, a browser or research claim or a
 * visual output is accepted — genuinely useful, and genuinely not something
 * most people open. A destination in the rail for a dozen diagnostics is the
 * shape §17 asks to remove.
 *
 * LOADED WHEN IT IS OPENED. Twelve panels, several of which probe runtimes on
 * mount, do not belong in the bundle of a screen somebody opened to change
 * their theme.
 */

export function EngineeringLab() {
  return (
    <section aria-label="Engineering diagnostics">
      <div className="flex flex-col gap-5">
        <GlassPanel className="p-4">
          <p className="text-sm text-muted-foreground">
            Lab surfaces inspect what OCADE can prove before a run, patch, browser/research claim or
            visual output is accepted. A diagnostic result is evidence, not a substitute for
            production runtime verification.
          </p>
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
    </section>
  );
}
