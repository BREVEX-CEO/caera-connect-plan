import { Link } from "@tanstack/react-router";
import { BarChart3, Code2, FileText } from "lucide-react";
import { CreativeControlPanel } from "@/components/ocade/CreativeControlPanel";

/**
 * WHAT STUDIO ACTUALLY WAS, KEPT AND MADE SMALLER.
 *
 * `PLAN.md` §4: "Studio, templates, generated outputs, and live outputs into
 * Artifacts." Studio was a page of nine cards, five of which said a medium is
 * not connected. §17 calls that shape out by name — a wall of buttons, and
 * five of them controls that do nothing.
 *
 * WHAT SURVIVED AND WHY. Two facts were worth keeping. The first is where work
 * actually happens: documents and reports are written in Chat, executable
 * analysis in Code, and everything saved lands here. The second is the refusal
 * — images, diagrams, presentations and spreadsheets have no runtime in this
 * build, and saying so once in a sentence is more honest than four cards that
 * look like features with the lights off.
 */

export function WhatOcadeCanProduce() {
  return (
    <section aria-labelledby="artifacts-production" className="mt-8">
      <h2 id="artifacts-production" className="text-sm font-semibold text-foreground">
        Where this work is made
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Link
          to="/ocade"
          className="rounded-xl border border-border/60 bg-card/25 p-4 transition hover:bg-accent/25"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
            Documents and reports
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Drafted and revised in Chat. Anything you save is versioned here, with the integrity
            check it was written with.
          </p>
        </Link>

        <Link
          to="/ocade/code"
          className="rounded-xl border border-border/60 bg-card/25 p-4 transition hover:bg-accent/25"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Code2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            Analysis, sites and applications
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            The Code workspace holds source files, patches and sandboxed execution where it is
            available.
          </p>
        </Link>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Image generation, diagram editing, presentation authoring and spreadsheet workbooks have
          no runtime in this build. OCADE does not offer a control for a medium it cannot produce.
        </span>
      </p>

      <div className="mt-4">
        <CreativeControlPanel />
      </div>
    </section>
  );
}
