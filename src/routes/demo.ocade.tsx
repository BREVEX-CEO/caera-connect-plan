import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Lock } from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useDemo } from "@/lib/demo/context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo/ocade")({
  component: DemoOcade,
});

function DemoOcade() {
  const { state, addOcadeMessage } = useDemo();
  const [draft, setDraft] = useState("");

  function sendCanned() {
    if (!draft.trim()) return;
    addOcadeMessage("user", draft.trim());
    addOcadeMessage(
      "assistant",
      "OCADE by CAERA CADANE — Demo Mode: model calls are disabled. Sign in and connect a model in Settings to get real replies.",
    );
    setDraft("");
  }

  return (
    <DemoShell>
      <PageHeader
        eyebrow="OCADE — assistant demo"
        title="OCADE by CAERA CADANE"
        description="A sample conversation. Model calls are disabled in demo — replies below are illustrative sample text."
      />
      <GlassPanel className="mt-6 flex h-[520px] flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {state.ocadeMessages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                m.role === "assistant"
                  ? "bg-muted/40 text-foreground"
                  : "ml-auto bg-primary/15 text-foreground",
              )}
            >
              {m.role === "assistant" ? (
                <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--accent-ocade)]">
                  OCADE
                </div>
              ) : null}
              {m.content}
            </div>
          ))}
        </div>
        <div className="border-t border-border/60 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-300">
            <Lock className="h-3 w-3" aria-hidden />
            Paid model providers disabled in demo.
          </div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendCanned();
                }
              }}
              placeholder="Ask OCADE anything (sample reply only)…"
              className="flex-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={sendCanned}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <Send className="h-4 w-4" aria-hidden />
              Send
            </button>
          </div>
        </div>
      </GlassPanel>
    </DemoShell>
  );
}
