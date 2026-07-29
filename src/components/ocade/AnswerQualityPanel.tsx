import { useState } from "react";
import { ListChecks, Quote, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import {
  composeAnswer,
  renderAnswer,
  type Claim as AnswerClaim,
} from "@/lib/chat/answer-composition";
import { buildCitedAnswer } from "@/lib/research/cited-answer";
import type { Claim as ResearchClaim } from "@/lib/research/claim-check";
import type { SourceRecord } from "@/lib/research/source-ranking";

/**
 * Answer-quality checks, on this device. Two rules OCADE applies to what it
 * says, each running its real module:
 *
 *  - SEPARATE (chat/answer-composition): every claim is labelled by kind —
 *    Observed / Fact / Inference / Possibility / Suggestion / Action — and a
 *    fact with no source is refused rather than shown as if grounded (§4.3).
 *  - CITE (research/cited-answer): a supported claim carries a LOCATED passage
 *    from each source whose text actually contains its terms; a source with no
 *    matching passage is listed as evidence-less, never cited (§5.1).
 */

const NOW = new Date();
const minsAgo = (n: number) => new Date(NOW.getTime() - n * 60000);

function composeDemo(): { rendered: string; evidence: string } {
  const claims: AnswerClaim[] = [
    { kind: "observation", text: "The build finished with exit code 0." },
    { kind: "retrieved_fact", text: "The ledger records 2,567 passing tests.", source: "OCADE_EXECUTION_PROGRESS.md" },
    { kind: "inference", text: "So the suite is currently green." },
    { kind: "recommendation", text: "Re-run the full gate before committing." },
  ];
  const r = composeAnswer(claims);
  if (!r.ok) return { rendered: r.reason, evidence: "" };
  return { rendered: renderAnswer(r.data), evidence: r.evidence };
}

function mislabelDemo(): string {
  // A fact with no source must be refused — not quietly shown as grounded.
  const r = composeAnswer([{ kind: "retrieved_fact", text: "Sales rose 20% last quarter." }]);
  return r.ok ? "unexpectedly accepted" : r.reason;
}

function citeDemo(): { summary: string; cited: string[]; without: string[] } {
  const src = (id: string, publisher: string): SourceRecord => ({
    id,
    title: `${publisher} report`,
    publisher,
    kind: "news",
    publishedAt: minsAgo(30),
    retrievedAt: NOW,
  });
  const claim: ResearchClaim = {
    text: "The council approved the new bridge.",
    topic: "local government",
    supporting: [src("S1", "City Herald"), src("S2", "Morning News")],
  };
  const texts = new Map<string, string>([
    ["S1", "At last night's meeting the council approved the new bridge by a clear majority."],
    ["S2", "Tomorrow's weather will be mild with light showers."], // no matching passage
  ]);
  const r = buildCitedAnswer(claim, texts, NOW);
  return {
    summary: r.summary,
    cited: r.citations.map((c) => `[${c.sourceId}] ${c.publisher}: “${c.snippet}”`),
    without: r.sourcesWithoutEvidence,
  };
}

type Demo = "separate" | "cite";

export function AnswerQualityPanel() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const compose = demo === "separate" ? composeDemo() : null;
  const mislabel = demo === "separate" ? mislabelDemo() : null;
  const cite = demo === "cite" ? citeDemo() : null;

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <ListChecks className="h-4 w-4" aria-hidden /> Answer quality
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Two rules OCADE applies to what it says: label every claim by kind so an inference is never
        read as a fact, and cite the located passage under a supported claim. Both run their real
        module here.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={demo === "separate" ? "default" : "ghost"} className="h-8" onClick={() => setDemo("separate")}>
          Separate the claims
        </Button>
        <Button size="sm" variant={demo === "cite" ? "default" : "ghost"} className="h-8" onClick={() => setDemo("cite")}>
          Cite the evidence
        </Button>
      </div>

      {compose ? (
        <div role="status" className="mt-3 rounded-lg border border-border/60 p-3 text-xs">
          <p className="font-medium text-foreground">Every claim labelled by kind</p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{compose.rendered}</pre>
          <p className="mt-1.5 text-[10px] text-muted-foreground">{compose.evidence}</p>
          <p className="mt-1.5 flex items-center gap-1 border-t border-border/60 pt-1.5 text-[11px] text-[color:var(--state-warning)]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> A fact with no source is refused: {mislabel}
          </p>
        </div>
      ) : null}

      {cite ? (
        <div role="status" className="mt-3 rounded-lg border border-border/60 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Quote className="h-3.5 w-3.5" aria-hidden /> Located citations
          </p>
          <p className="mt-1 text-muted-foreground">{cite.summary}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {cite.cited.map((c, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">{c}</li>
            ))}
          </ul>
          {cite.without.length > 0 ? (
            <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
              No matching passage, so not cited: {cite.without.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </GlassPanel>
  );
}
