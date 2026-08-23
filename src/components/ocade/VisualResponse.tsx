import { useMemo, useState } from "react";
import { Sparkles, Download, Save, X, Volume2, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppearance } from "@/lib/use-appearance";
import {
  planVisualResponse,
  chooseVisualMode,
  describeRenderCost,
  visualPlanToText,
  type VisualBlock,
  type ChartPoint,
  type DiagramStep,
} from "@/lib/ocade-visual";
import { createLocalOutput } from "@/lib/projects/local-projects";
import { useSession } from "@/lib/session";

/**
 * OCADE visual response (Plan §38–41).
 *
 * Renders a structured panel beside an ORIGINAL OCADE presence — an abstract
 * mark built from OCADE's own tokens. It imitates no real person and no
 * copyrighted character.
 *
 * Behaviour: text+voice stay the default, so this is only shown when the user
 * asks for it. Visuals are temporary until explicitly saved, protected content
 * is already redacted by `planVisualResponse`, and low-resource devices get a
 * reduced presentation rather than a fake one.
 */
export function VisualResponse({
  answer,
  onClose,
  onNarrate,
  projectId,
  conversationId,
}: {
  answer: string;
  onClose: () => void;
  onNarrate?: (text: string) => void;
  projectId?: string | null;
  conversationId?: string | null;
}) {
  const { reducedMotion, lowPerformance } = useAppearance();
  const { user } = useSession();
  const [saving, setSaving] = useState(false);

  const plan = useMemo(() => planVisualResponse(answer), [answer]);
  const mode = useMemo(
    () =>
      chooseVisualMode(
        {
          renderer: true,
          speech: typeof window !== "undefined" && "speechSynthesis" in window,
          lowResource: Boolean(reducedMotion || lowPerformance),
        },
        plan,
      ),
    [plan, reducedMotion, lowPerformance],
  );

  const reduced = mode.mode === "reduced";

  function exportVisual() {
    const blob = new Blob([visualPlanToText(plan)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ocade-visual-response.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveToOutputs() {
    setSaving(true);
    try {
      if (!user?.id) throw new Error("Sign in to save this output.");
      await createLocalOutput(user.id, {
        projectId: projectId ?? null,
        conversationId: conversationId ?? null,
        kind: "visual",
        title: plan.blocks.find((b) => b.kind === "heading")?.title ?? "Visual response",
        content: visualPlanToText(plan),
        mime: "text/plain",
      });
      toast.success("Saved to Outputs.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save this output on the device.");
    } finally {
      setSaving(false);
    }
  }

  if (mode.mode === "unavailable") {
    return (
      <div className="rounded-lg border border-border/60 bg-secondary/25 p-3 text-xs text-muted-foreground">
        {mode.reason}
      </div>
    );
  }

  return (
    <section
      aria-label="Visual response"
      className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-secondary/20"
    >
      <header className="flex items-center gap-3 border-b border-border/60 px-3 py-2">
        <OcadePresence animated={!reduced} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium">OCADE visual response</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {reduced ? mode.reason : describeRenderCost(plan)}
          </p>
        </div>
        {onNarrate ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNarrate(visualPlanToText(plan))}
            title="Read this answer aloud"
          >
            <Volume2 className="h-4 w-4" />
            <span className="sr-only">Narrate</span>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onClose} title="Close visual response">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </header>

      <div className="flex flex-col gap-3 p-3">
        {plan.blocks.map((b, i) => (
          <Block key={i} block={b} reduced={reduced} />
        ))}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-2">
        <p className="mr-auto text-[11px] text-muted-foreground">
          Temporary — not stored unless you save it.
        </p>
        <Button size="sm" variant="ghost" onClick={exportVisual}>
          <Download className="mr-1.5 h-4 w-4" /> Export
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void saveToOutputs()} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Save to Outputs
        </Button>
      </footer>
    </section>
  );
}

/**
 * Original OCADE presence: concentric arcs from the app's own tokens. Purely
 * abstract and brand-native — not a face, character or likeness.
 */
function OcadePresence({ animated }: { animated: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        "bg-[color:var(--sidebar-accent)]",
      )}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full border border-foreground/25",
          animated && "motion-safe:animate-ping",
        )}
        style={animated ? { animationDuration: "2.4s" } : undefined}
      />
      <Sparkles className="h-3.5 w-3.5 text-foreground/80" />
    </span>
  );
}

/**
 * Horizontal bar chart, drawn inline with no charting dependency.
 *
 * Accessibility: the bars are `aria-hidden` and the same data is exposed as a
 * real table to assistive tech, so nothing is conveyed by colour or shape alone.
 * Values are shown as the ORIGINAL display strings ("42%", "$1.2k"), never the
 * normalised number, so the chart cannot misstate the answer.
 */
export function BarChart({
  title,
  series,
  animated,
}: {
  title?: string;
  series: ChartPoint[];
  animated: boolean;
}) {
  if (series.length === 0) return null;

  // Include zero in the scale so bar lengths stay proportional, and handle
  // negatives and an all-zero series without dividing by zero.
  const values = series.map((p) => p.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const zero = ((0 - min) / span) * 100;

  return (
    <figure className="flex flex-col gap-1.5">
      {title ? (
        <figcaption className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {title}
        </figcaption>
      ) : null}

      <div className="flex flex-col gap-1.5" aria-hidden>
        {series.map((p, i) => {
          const from = ((Math.min(p.value, 0) - min) / span) * 100;
          const width = (Math.abs(p.value) / span) * 100;
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-24 shrink-0 truncate text-[11px] text-muted-foreground"
                title={p.label}
              >
                {p.label}
              </span>
              <span className="relative h-4 flex-1 overflow-hidden rounded bg-background/70">
                {min < 0 ? (
                  <span
                    className="absolute inset-y-0 w-px bg-border"
                    style={{ left: `${zero}%` }}
                  />
                ) : null}
                <span
                  className={cn(
                    "absolute inset-y-0 rounded bg-[color:var(--sidebar-accent)]",
                    animated && "motion-safe:transition-[width] motion-safe:duration-500",
                  )}
                  style={{ left: `${from}%`, width: `${Math.max(width, 1)}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] tabular-nums">{p.display}</span>
            </div>
          );
        })}
      </div>

      {/* The same data, available to screen readers and to copy/paste. */}
      <table className="sr-only">
        <caption>{title ?? "Chart data"}</caption>
        <tbody>
          {series.map((p, i) => (
            <tr key={i}>
              <th scope="row">{p.label}</th>
              <td>{p.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Left-to-right flow. Wraps on narrow screens rather than scrolling, and reads
 * as an ordered list to assistive tech.
 */
export function FlowDiagram({ steps }: { steps: DiagramStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Process flow">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px]">
            {s.label}
          </span>
          {i < steps.length - 1 ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Block({ block, reduced }: { block: VisualBlock; reduced: boolean }) {
  switch (block.kind) {
    case "heading":
      return <h3 className="text-sm font-semibold text-foreground">{block.title}</h3>;

    case "metrics":
      return (
        <dl className="grid gap-2 sm:grid-cols-2">
          {(block.metrics ?? []).map((m, i) => (
            <div key={i} className="rounded-lg border border-border/60 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {m.label}
              </dt>
              <dd className="text-sm font-medium tabular-nums text-foreground">{m.value}</dd>
            </div>
          ))}
        </dl>
      );

    case "steps":
      return (
        <ol className="flex flex-col gap-1.5">
          {(block.lines ?? []).map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px]">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span>{l}</span>
            </li>
          ))}
        </ol>
      );

    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              {(block.rows ?? []).map((row, r) => (
                <tr key={r} className={r === 0 ? "border-b border-border/60" : ""}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={cn(
                        "px-2 py-1 align-top",
                        r === 0 ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "chart":
      return <BarChart title={block.title} series={block.series ?? []} animated={!reduced} />;

    case "diagram":
      return <FlowDiagram steps={block.steps ?? []} />;

    case "code":
      return (
        <pre
          className={cn(
            "overflow-x-auto rounded-lg bg-background/70 p-3 text-[11px] leading-relaxed",
            reduced && "max-h-48",
          )}
        >
          <code>{(block.lines ?? []).join("\n")}</code>
        </pre>
      );

    default:
      return (
        <div className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {(block.lines ?? []).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      );
  }
}
