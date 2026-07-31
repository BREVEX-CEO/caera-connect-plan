import { UsersRound } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { STAKEHOLDER_RESEARCH_DIMENSIONS } from "@/lib/stakeholder-research";

export function StakeholderResearchBoundary() {
  return (
    <GlassPanel className="mt-6 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UsersRound className="h-4 w-4" aria-hidden /> Stakeholder research
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Intake is source-ready, but no production participant is recorded. Synthetic personas and
        fixtures never count as interviews or observation.
      </p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {STAKEHOLDER_RESEARCH_DIMENSIONS.map((dimension) => (
          <li
            key={dimension.id}
            className="rounded-md border border-border/50 px-2 py-1 text-[11px] text-muted-foreground"
          >
            {dimension.id} · {dimension.label}
          </li>
        ))}
      </ul>
      <p role="status" className="mt-3 text-xs text-[color:var(--state-warning)]">
        Externally blocked: recruit consenting human stakeholders and retain independently reviewed,
        privacy-preserving evidence.
      </p>
    </GlassPanel>
  );
}
