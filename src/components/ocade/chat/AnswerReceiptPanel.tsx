import { useEffect, useState } from "react";
import { ShieldCheck, Globe, HelpCircle, Copy, FileText, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  verdict,
  describeSourceUse,
  receiptDigest,
  receiptToText,
  type AnswerReceipt,
} from "@/lib/provenance/receipt";

/**
 * The receipt for one answer, shown under it.
 *
 * COLLAPSED BY DEFAULT, and that is a deliberate limit on the idea. A privacy
 * indicator that shouts on every message stops being read within a day, and an
 * assistant that spends more pixels on its own trustworthiness than on the
 * answer is uncomfortable to use. One quiet line, expandable when somebody
 * actually wants to check — which is rare, and is exactly when it must be
 * there.
 *
 * The three tones are not decoration. "Private" is a positive claim backed by
 * a measurement; "sent" names the destinations; "unknown" refuses to imply
 * either. Nothing here is styled to reassure — the colour follows the finding.
 */
export function AnswerReceiptPanel({
  receipt,
  className,
}: {
  receipt: AnswerReceipt;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const { tone, headline } = verdict(receipt);

  useEffect(() => {
    let live = true;
    void receiptDigest(receipt).then((d) => {
      if (live) setDigest(d);
    });
    return () => {
      live = false;
    };
  }, [receipt]);

  const Icon = tone === "private" ? ShieldCheck : tone === "sent" ? Globe : HelpCircle;

  const copy = async () => {
    if (!digest) return;
    try {
      await navigator.clipboard.writeText(receiptToText(receipt, digest));
      toast.success("Receipt copied.", {
        description: "Anyone can re-check its fingerprint against the contents.",
      });
    } catch {
      toast.error("This browser would not allow copying to the clipboard.");
    }
  };

  return (
    <section
      aria-label="How this answer was produced"
      className={cn("mt-1.5 text-[11.5px]", className)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tone === "private" && "text-[color:var(--state-success)]",
          tone === "sent" && "text-[color:var(--state-warning)]",
          tone === "unknown" && "text-muted-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          {tone === "private"
            ? "Produced on this device"
            : tone === "sent"
              ? `Sent to ${receipt.contacted.length} ${receipt.contacted.length === 1 ? "server" : "servers"}`
              : "Not checked"}
        </span>
        <ChevronDown
          className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mt-1.5 flex flex-col gap-2 rounded-lg border border-border/60 bg-secondary/25 p-3">
          <p className="text-[12px] leading-relaxed text-foreground">{headline}</p>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <dt>Engine</dt>
            <dd className="text-foreground">{receipt.engineLabel}</dd>
            <dt>Took</dt>
            <dd className="tabular-nums text-foreground">{receipt.durationMs} ms</dd>
            <dt>Question</dt>
            <dd className="truncate font-mono text-[10px]">{receipt.promptSha256.slice(0, 24)}…</dd>
            <dt>Answer</dt>
            <dd className="truncate font-mono text-[10px]">{receipt.answerSha256.slice(0, 24)}…</dd>
          </dl>

          {receipt.sources.length > 0 ? (
            <div>
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <FileText className="h-3 w-3" aria-hidden /> What it read
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                {receipt.sources.map((source) => (
                  <li key={`${source.name}-${source.sha256}`}>{describeSourceUse(source)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
            The limits of the measurement, in the same panel that makes the
            claim. Putting them anywhere else would be choosing which half of
            the truth is convenient.
          */}
          {receipt.blindSpots.length > 0 ? (
            <details className="text-[10.5px] text-muted-foreground">
              <summary className="cursor-pointer">What this check cannot see</summary>
              <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                {receipt.blindSpots.map((spot) => (
                  <li key={spot}>{spot}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {digest ? `${digest.slice(0, 20)}…` : "fingerprinting…"}
            </span>
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!digest}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 text-[10.5px] text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              <Copy className="h-2.5 w-2.5" aria-hidden /> Copy receipt
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
