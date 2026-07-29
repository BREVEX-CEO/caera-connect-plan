import { useMemo } from "react";
import { ClipboardCheck } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { PackRegistry } from "@/lib/skills/pack-registry";
import {
  buildScorecard,
  describeScorecard,
  SCORECARD_SCOPE,
} from "@/lib/skills/criteria-scorecard";

/**
 * How OCADE holds up on the criteria that matter for agentic work.
 *
 * A component rather than markup inside the route, so it can be render-tested.
 * The two things that must never come apart on screen are the numbers and the
 * statement of what they do NOT mean — a scorecard read as a comparison would
 * be a claim nobody measured. `SCORECARD_SCOPE` is therefore rendered in the
 * same panel, not a tooltip or a separate section, and a test asserts it.
 */
export function CriteriaScorecard({ registry }: { registry?: PackRegistry }) {
  const scorecard = useMemo(() => buildScorecard(registry ?? new PackRegistry()), [registry]);

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <ClipboardCheck className="h-4 w-4" aria-hidden /> How OCADE holds up
      </h3>
      <p className="text-xs text-muted-foreground">{describeScorecard(scorecard)}</p>

      <ul className="mt-2.5 flex flex-col gap-2">
        {scorecard.rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border/60 p-3">
            <p className="text-[13px] font-medium">{row.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{row.mechanism}</p>
            {/*
              The gap sits beside the mechanism, in the same weight. A limitation
              in a footnote is a limitation nobody reads.
            */}
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Still missing: </span>
              {row.gap}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
        {SCORECARD_SCOPE}
      </p>
    </GlassPanel>
  );
}
