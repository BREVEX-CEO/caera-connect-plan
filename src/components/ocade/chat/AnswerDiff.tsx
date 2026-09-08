import { CheckCheck, GitCompare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { diffAnswers, driftRatio, type RepeatVerdict } from "@/lib/edge/reproducible";

/**
 * The same question, asked twice, with the difference shown.
 *
 * WHY THIS VIEW IS THE POINT OF REPRODUCIBILITY. Pinning a run is bookkeeping;
 * nobody benefits from a stored seed they cannot act on. What people actually
 * need is the answer to "is this thing stable?" — and the honest form of that
 * answer is not a percentage, it is the words that changed.
 *
 * No mainstream assistant can show this, and not because they have not thought
 * of it: they cannot pin the model. Their weights change under you without
 * notice, so a re-run compares two unknowns and any difference is
 * uninterpretable. Here both runs name the same engine file by digest, so a
 * difference means something specific.
 *
 * CONDITIONS BEFORE CONTENT, on screen as well as in the data. If the user
 * changed the temperature, the headline says so and the diff is context rather
 * than evidence. Leading with "the answer changed" would be technically true
 * and would misdirect every reader who did not scroll.
 */
export function AnswerDiff({
  before,
  after,
  verdict,
  className,
}: {
  before: string;
  after: string;
  verdict: RepeatVerdict;
  className?: string;
}) {
  const spans = diffAnswers(before, after);
  const drift = driftRatio(spans);

  const tone = verdict.identical
    ? "identical"
    : verdict.conditionsMatched
      ? // Changed with nothing else changed — the one case worth alarming about.
        "unstable"
      : "explained";

  const Icon = tone === "identical" ? CheckCheck : tone === "unstable" ? AlertTriangle : GitCompare;

  return (
    <section
      aria-label="Comparison with the previous answer"
      className={cn(
        "rounded-xl border border-border/60 bg-secondary/20 p-3 text-[12px]",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-start gap-2",
          tone === "identical" && "text-[color:var(--state-success)]",
          tone === "unstable" && "text-[color:var(--state-warning)]",
          tone === "explained" && "text-muted-foreground",
        )}
      >
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p className="leading-relaxed">{verdict.summary}</p>
      </header>

      {/*
        The conditions that changed, named individually. "Something changed" is
        not actionable; "the seed and the temperature changed" tells the reader
        exactly which knob to put back.
      */}
      {verdict.changes.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {verdict.changes.map((change) => (
            <li
              key={change.field}
              className="rounded border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10.5px] text-muted-foreground"
            >
              <span className="text-foreground">{change.field}</span>{" "}
              <span className="tabular-nums">
                {String(change.before).slice(0, 10)} → {String(change.after).slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {verdict.identical ? null : (
        <>
          <p className="mt-2.5 text-[10.5px] text-muted-foreground">
            {/* A number, so "a bit different" and "rewritten" are separable. */}
            {(drift * 100).toFixed(0)}% of the wording changed
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
            {spans.map((span, index) => (
              <span
                key={`${span.kind}-${index}`}
                className={cn(
                  span.kind === "added" &&
                    "rounded bg-[color:var(--state-success-surface-strong)] text-[color:var(--state-success)]",
                  span.kind === "removed" &&
                    "rounded bg-destructive/15 text-destructive line-through decoration-1",
                )}
              >
                {span.text}
              </span>
            ))}
          </p>
          <p className="mt-2 text-[10.5px] text-muted-foreground">
            <span className="text-destructive">struck through</span> was in the first answer;{" "}
            <span className="text-[color:var(--state-success)]">highlighted</span> is new.
          </p>
        </>
      )}
    </section>
  );
}
