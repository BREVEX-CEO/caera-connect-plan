import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, GitBranch, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  verifyChain,
  exportChain,
  chainLimits,
  type LedgerEntry,
  type LedgerVerdict,
} from "@/lib/edge/ledger";
import { describeTree, branchPoints, stats, type Tree } from "@/lib/edge/checkpoints";

/**
 * Is this conversation the one that happened?
 *
 * TWO QUESTIONS, ONE SURFACE, and they are genuinely different:
 *
 *   - THE CHAIN answers "has this record been altered?" Each turn commits to
 *     the one before it, so an edited, inserted, deleted or reordered message
 *     breaks every hash after it. Nobody has to be trusted; the check is
 *     recomputation.
 *
 *   - THE TREE answers "what else did I try?" A chat is a tree pretending to
 *     be a list, and the branches a user explored are part of the record of how
 *     they got to an answer.
 *
 * They are shown together because a person asking either one is usually really
 * asking a third: can I rely on this? Splitting them across two screens would
 * make that question take two trips.
 *
 * VERIFICATION RUNS ON OPEN, not on a button. A panel that showed a green tick
 * until you asked it to check would be reporting the absence of a check as a
 * pass — which is the specific dishonesty this whole area exists to avoid.
 */
export function ConversationIntegrity({
  chain,
  tree,
  messages,
  className,
}: {
  chain: readonly LedgerEntry[];
  tree: Tree;
  /** Plaintext, so the digests can be checked against the real messages. */
  messages?: readonly string[];
  className?: string;
}) {
  const [verdict, setVerdict] = useState<LedgerVerdict | null>(null);

  const check = useCallback(async () => {
    setVerdict(await verifyChain(chain, messages));
  }, [chain, messages]);

  useEffect(() => {
    void check();
  }, [check]);

  const shape = stats(tree);
  const forks = branchPoints(tree);

  const download = () => {
    try {
      const blob = new Blob([exportChain(chain)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ocade-conversation-ledger-${Date.now()}.json`;
      link.click();
      // Released immediately: a retained object URL pins the blob in memory for
      // the lifetime of the document.
      URL.revokeObjectURL(url);
      toast.success("Ledger saved.", {
        description: "Anyone can re-check it — the chain verifies without trusting OCADE.",
      });
    } catch {
      toast.error("This browser would not allow the download.");
    }
  };

  if (chain.length === 0) {
    return (
      <section className={cn("text-[12px] text-muted-foreground", className)}>
        Nothing has been recorded in this conversation yet.
      </section>
    );
  }

  return (
    <section
      aria-label="Conversation integrity"
      className={cn("flex flex-col gap-3 text-[12px]", className)}
    >
      {/* ------------------------------------------------ the chain --- */}
      <div
        className={cn(
          "rounded-xl border p-3",
          verdict?.intact
            ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/5"
            : verdict
              ? "border-destructive/50 bg-destructive/5"
              : "border-border/60 bg-secondary/20",
        )}
      >
        <p className="flex items-start gap-2">
          {verdict === null ? (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : verdict.intact ? (
            <ShieldCheck
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-success)]"
              aria-hidden
            />
          ) : (
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
          )}
          <span className="leading-relaxed text-foreground">
            {verdict === null ? "Checking every turn…" : verdict.summary}
          </span>
        </p>

        {/*
          Every fault, not just the first. The SHAPE of the tampering — one
          edited turn versus a rewritten second half — is what somebody
          examining a disputed transcript actually needs.
        */}
        {verdict && verdict.faults.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 border-t border-destructive/30 pt-2">
            {verdict.faults.map((fault) => (
              <li
                key={`${fault.kind}-${fault.index}`}
                className="text-[11px] text-muted-foreground"
              >
                <span className="font-medium text-foreground">Turn {fault.index + 1}:</span>{" "}
                {fault.detail}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
          <span className="text-[10.5px] text-muted-foreground">
            {verdict?.checked ?? chain.length} turns fingerprinted
          </span>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 text-[10.5px] text-foreground transition hover:bg-accent"
          >
            <Download className="h-2.5 w-2.5" aria-hidden /> Save ledger
          </button>
        </div>
      </div>

      {/* ------------------------------------------------- the tree --- */}
      <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
        <p className="flex items-start gap-2 text-foreground">
          <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="leading-relaxed">{describeTree(tree)}</span>
        </p>

        {forks.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 border-t border-border/40 pt-2">
            {forks.map((fork, index) => (
              <li
                key={fork.node?.id ?? `root-${index}`}
                className="text-[11px] text-muted-foreground"
              >
                {/*
                  Named by what was asked, not by an id. "After you asked about
                  the contract" is navigable; "after node a-1735…" is not.
                */}
                After “{(fork.node?.content ?? "the start").slice(0, 44)}
                {(fork.node?.content?.length ?? 0) > 44 ? "…" : ""}” — {fork.branches.length}{" "}
                different answers were explored.
              </li>
            ))}
          </ul>
        ) : null}

        {shape.depth > 0 ? (
          <p className="mt-2 text-[10.5px] text-muted-foreground">
            Longest path {shape.depth} {shape.depth === 1 ? "turn" : "turns"} · {shape.leaves}{" "}
            {shape.leaves === 1 ? "ending" : "endings"} kept
          </p>
        ) : null}
      </div>

      {/*
        The bound on the claim, in the same panel that makes it. "Cryptographic"
        does a lot of misleading work if nobody says what it does not cover.
      */}
      <details className="text-[10.5px] text-muted-foreground">
        <summary className="cursor-pointer">What this proves, and what it does not</summary>
        <ul className="mt-1 flex flex-col gap-0.5 pl-3">
          {chainLimits().map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
