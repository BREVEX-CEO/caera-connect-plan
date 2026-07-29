import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Lock, Paperclip, Mic } from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { useDemo } from "@/lib/demo/context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo/ocade")({
  component: DemoOcade,
});

const SAMPLES = [
  "Summarize a document",
  "Draft an email",
  "Explain a concept",
  "Plan a work session",
];

function DemoOcade() {
  const { state, addOcadeMessage } = useDemo();
  const [draft, setDraft] = useState("");

  function sendCanned() {
    const text = draft.trim();
    if (!text) return;
    addOcadeMessage("user", text);
    addOcadeMessage(
      "assistant",
      "OCADE by CAERA CADANE — Demo Mode: paid model calls are disabled. Sign in and connect a model in Settings to get real replies.",
    );
    setDraft("");
  }

  const hasMessages = state.ocadeMessages.length > 0;

  return (
    <DemoShell>
      <div className="-mx-5 -my-6 flex h-[calc(100vh-2.75rem-2.5rem)] min-h-0 flex-col sm:-mx-8">
        {/* Header strip */}
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-2 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 uppercase tracking-wide text-amber-300">
            Demo · sample data
          </span>
          <span>OCADE by CAERA CADANE — replies are illustrative, model calls disabled.</span>
        </div>

        {/* Conversation column */}
        <div className="flex-1 overflow-y-auto ocade-scroll">
          <div className="mx-auto w-full max-w-2xl px-5 py-6">
            {!hasMessages ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-border/70 text-[color:var(--accent-ocade)]"
                  aria-hidden
                >
                  <span className="text-[15px] font-semibold tracking-tighter">CC</span>
                </div>
                <h1 className="text-[20px] font-semibold text-foreground">
                  Try OCADE in Demo Mode
                </h1>
                <p className="max-w-md text-[13px] text-muted-foreground">
                  Type a question below to see a sample reply. Sample data is isolated from real
                  accounts.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/*
                  The visible h1 above only exists in the empty state, so once a
                  conversation starts the page would have no heading at all.
                  This keeps the document outline intact for screen readers.
                */}
                <h1 className="sr-only">OCADE demo conversation</h1>
                {state.ocadeMessages.map((m, i) => (
                  <div
                    key={i}
                    className={cn("group", m.role === "assistant" ? "" : "flex flex-col items-end")}
                  >
                    {m.role === "assistant" ? (
                      <>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-ocade)]">
                          OCADE
                        </div>
                        <div className="text-[14px] leading-relaxed text-foreground">
                          {m.content}
                        </div>
                      </>
                    ) : (
                      <div className="max-w-[85%] rounded-2xl bg-secondary/70 px-3.5 py-2 text-[14px] text-foreground">
                        {m.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border/60 bg-background/60 px-5 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-300">
              <Lock className="h-3 w-3" aria-hidden />
              Paid model providers are disabled in demo.
            </div>
            <div className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendCanned();
                  }
                }}
                rows={2}
                placeholder="Ask OCADE anything (sample reply only)…"
                className="min-h-[52px] w-full resize-none rounded-t-xl bg-transparent px-3 py-2.5 text-sm focus:outline-none"
              />
              <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
                {/* aria-label, not just title: `title` is not reliably announced. */}
                <button
                  disabled
                  aria-label="Attach a file — disabled in the demo"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60"
                  title="Attachments disabled in demo"
                >
                  <Paperclip className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  disabled
                  aria-label="Use voice — disabled in the demo"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60"
                  title="Voice disabled in demo"
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Demo · sample
                </span>
                <button
                  onClick={sendCanned}
                  className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground"
                >
                  <Send className="h-3 w-3" /> Send
                </button>
              </div>
            </div>
            {!hasMessages ? (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {SAMPLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft(s)}
                    className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
