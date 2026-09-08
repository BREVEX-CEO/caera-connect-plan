import { useMemo, useState } from "react";
import { GitBranch, Square, ChevronRight, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import { ConversationGraph, type MessageNode } from "@/lib/chat/conversation-graph";
import { ResponseStream, streamDisclosure, type StreamSnapshot } from "@/lib/chat/response-stream";

/**
 * The UI surface for OCADE's conversation branching and streaming controls —
 * so those state machines are wired into a real screen, not just library code.
 *
 * Everything here runs on-device against the real `ConversationGraph` and
 * `ResponseStream`. It is deliberately NOT calling a cloud model: the streamed
 * text is a fixed local sample, and the panel says so, because demonstrating
 * the stop-control must not itself pretend to be a live generation.
 *
 * What it shows honestly:
 *  - editing a question forks a branch; both versions remain, and you can see
 *    how many alternatives exist at a point;
 *  - stopping a stream yields a FRAGMENT, labelled as one — never a finished
 *    answer.
 */

const SAMPLE = "Here is a worked answer that arrives in several pieces so you can stop it midway.";
const CHUNKS = SAMPLE.match(/\S+\s*/g) ?? [SAMPLE];

function seed(): ConversationGraph {
  const g = new ConversationGraph();
  g.append("user", "Summarise the quarterly numbers.");
  g.append("assistant", "Revenue rose 12%, costs held flat.");
  return g;
}

export function ConversationControls() {
  const graph = useMemo(() => seed(), []);
  // A version counter forces re-render when the mutable graph changes.
  const [, bump] = useState(0);
  const rerender = () => bump((n) => n + 1);

  const thread = graph.activeThread();
  const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");
  const firstUser = thread.find((m) => m.role === "user");

  function regenerate() {
    if (!lastAssistant) return;
    graph.regenerate(lastAssistant.id, "Revenue up 12%; margins steady; headcount unchanged.");
    rerender();
  }

  function editQuestion() {
    if (!firstUser) return;
    graph.editAndResend(firstUser.id, "Summarise the quarterly numbers and the outlook.");
    graph.append("assistant", "Q3 up 12%; guidance raised for Q4.");
    rerender();
  }

  const branchesAtAssistant = lastAssistant ? graph.branchesAt(lastAssistant.id) : [];

  /* --- streaming demo, stepwise so the state transitions are observable --- */
  const [stream, setStream] = useState<ResponseStream | null>(null);
  const [snap, setSnap] = useState<StreamSnapshot | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);

  function startStream() {
    const s = new ResponseStream();
    s.start();
    setStream(s);
    setChunkIndex(0);
    setSnap(s.snapshot());
  }
  function pushNext() {
    if (!stream) return;
    const next = CHUNKS[chunkIndex];
    if (next === undefined) {
      const done = stream.complete();
      if (done.ok) setSnap(done.data);
      return;
    }
    const r = stream.push(next);
    if (r.ok) setSnap(r.data);
    setChunkIndex((i) => i + 1);
  }
  function stopStream() {
    if (!stream) return;
    const r = stream.stop();
    if (r.ok) setSnap(r.data);
  }

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <GitBranch className="h-4 w-4" aria-hidden /> Conversation controls
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Branching and streaming, running on this device against OCADE&rsquo;s real conversation
        model. The streamed text below is a fixed local sample — this panel demonstrates the
        controls, it isn&rsquo;t calling a model.
      </p>

      {/* Active thread */}
      <div className="rounded-lg border border-border/60 p-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Active thread
        </p>
        <ul className="flex flex-col gap-1">
          {thread.map((m: MessageNode) => (
            <li key={m.id} className="flex items-start gap-2 text-xs">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] uppercase",
                  m.role === "user"
                    ? "bg-secondary text-muted-foreground"
                    : "bg-[color:var(--state-success-surface-strong)] text-[color:var(--state-success)]",
                )}
              >
                {m.role}
              </span>
              <span className="text-foreground">{m.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" className="h-8" onClick={regenerate}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Regenerate answer
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={editQuestion}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Edit &amp; resend question
        </Button>
      </div>

      {branchesAtAssistant.length > 1 ? (
        <p role="status" className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <ChevronRight className="h-3 w-3" aria-hidden />
          {branchesAtAssistant.length} versions of this answer — both kept; the original isn&rsquo;t
          overwritten.
        </p>
      ) : null}

      {/* Streaming */}
      <div className="mt-4 rounded-lg border border-border/60 p-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Streaming &amp; stop
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-7 text-[11px]" onClick={startStream}>
            Start
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            disabled={snap?.status !== "streaming"}
            onClick={pushNext}
          >
            Next chunk
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            disabled={snap?.status !== "streaming"}
            onClick={stopStream}
          >
            <Square className="mr-1.5 h-3 w-3" aria-hidden /> Stop
          </Button>
        </div>

        {snap && snap.status !== "idle" ? (
          <div role="status" className="mt-2 text-xs">
            <p className="text-foreground">{snap.content || "…"}</p>
            {snap.truncated && snap.status !== "streaming" ? (
              <p className="mt-1 text-[11px] text-[color:var(--state-warning)]">
                {streamDisclosure(snap)}
              </p>
            ) : snap.status === "complete" ? (
              <p className="mt-1 text-[11px] text-[color:var(--state-success)]">Complete.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </GlassPanel>
  );
}
