import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Paperclip, Pause, Send, Square, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type ControlWorkSession, type WorkState } from "@/lib/agent/use-control-work";

/*
 * The scene is heavy and the composer is not. Loading it lazily means someone
 * who opens Control + Work to type one instruction can type it immediately,
 * rather than waiting on WebGL for a surface whose point is the instruction.
 */
const SolarSystem = lazy(() =>
  import("@/components/landing/SolarSystem").then((m) => ({ default: m.SolarSystem })),
);

/**
 * OCADE Control + Work.
 *
 * A conversation that operates the computer, deliberately distinct from OCADE
 * Chat. The distinction is not decorative: a person must always know whether
 * they are about to receive an explanation or have their machine act.
 *
 * WHAT IS DELIBERATELY NOT ON THIS PAGE
 * -------------------------------------
 * Tool names, Python, Playwright, UI Automation, model ports, JSON, raw traces.
 * The progress lines are written for the person whose computer it is. Anyone
 * who needs the machinery can find it in Settings › Advanced › Diagnostics; the
 * surface where work happens is not a debugger.
 */
export function ControlWorkSurface({ session }: { session: ControlWorkSession }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [session.turns]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void session.send(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SolarStage state={session.state} />

      {session.ready && !session.ready.ready ? (
        <div className="mx-auto w-full max-w-3xl px-4">
          <p className="rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-[12px] text-muted-foreground">
            {/* Named, not hidden behind a disabled button. Someone whose
                computer OCADE cannot reach is owed the reason. */}
            {session.ready.reason ?? "OCADE cannot reach this computer yet."}
          </p>
        </div>
      ) : null}

      <div ref={scrollRef} className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-4">
        {session.turns.length === 0 ? (
          <EmptyGuidance />
        ) : (
          <ul className="space-y-4">
            {session.turns.map((turn) => (
              <li key={turn.id}>
                {turn.role === "user" ? (
                  <div className="flex justify-end">
                    <p className="max-w-[80%] rounded-2xl bg-secondary px-3.5 py-2 text-[13px]">
                      {turn.text}
                    </p>
                  </div>
                ) : (
                  <div className="max-w-[92%]">
                    {turn.progress && turn.progress.length > 0 && !turn.text ? (
                      <ul className="space-y-1">
                        {turn.progress.map((line, index) => (
                          <li
                            key={`${turn.id}-${index}`}
                            className="flex items-center gap-2 text-[12px] text-muted-foreground"
                          >
                            <span className="h-1 w-1 rounded-full bg-[color:var(--accent-ocade)]" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {turn.text ? (
                      <p className="whitespace-pre-wrap text-[13px] text-foreground">{turn.text}</p>
                    ) : null}
                    {turn.outcome ? <OutcomeBadge outcome={turn.outcome} /> : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {session.busy ? (
          <div className="mb-2 flex items-center gap-2">
            <StateChip state={session.state} userHasControl={session.userHasControl} />
            <div className="ml-auto flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={session.pause}>
                <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
              </Button>
              <Button size="sm" variant="ghost" onClick={session.stop}>
                <Square className="mr-1.5 h-3.5 w-3.5" /> Stop
              </Button>
              <Button
                size="sm"
                variant={session.userHasControl ? "secondary" : "ghost"}
                onClick={session.userHasControl ? session.resume : session.takeOver}
              >
                <Hand className="mr-1.5 h-3.5 w-3.5" />
                {session.userHasControl ? "Give back" : "Take over"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-card/80 p-2">
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Attach">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            id="ocade-work-composer"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={
              session.busy
                ? "Change what OCADE should do…"
                : "Tell OCADE what to do on this computer…"
            }
            className="max-h-40 min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-[13px] shadow-none focus-visible:ring-0"
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Speak">
            <Mic className="h-4 w-4" />
          </Button>
          {session.busy ? (
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={session.stop}
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={submit}
              disabled={!draft.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground/80">
          OCADE acts on this computer here. For questions and documents, use OCADE Chat.
        </p>
      </div>
    </div>
  );
}

/**
 * The Solar scene, carrying OCADE's state.
 *
 * The scene itself is the existing one — it is not forked for this surface. The
 * state ring around it is what changes, because reworking the renderer to carry
 * mission state is a larger change than this pass can prove, and an animation
 * that claims a state it does not track would be the same dishonesty in a
 * prettier form.
 */
function SolarStage({ state }: { state: WorkState }) {
  return (
    <div className="relative mx-auto h-[34vh] min-h-[190px] w-full max-w-3xl shrink-0">
      <Suspense fallback={null}>
        <SolarSystem className="absolute inset-0 h-full w-full" />
      </Suspense>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl transition-[box-shadow,opacity] duration-700",
          state === "thinking" && "shadow-[inset_0_0_80px_-40px_var(--accent-ocade)]",
          state === "executing" && "shadow-[inset_0_0_90px_-35px_var(--accent-ocade)]",
          state === "listening" && "shadow-[inset_0_0_70px_-45px_var(--accent-ocade)]",
          state === "paused" && "opacity-60",
          state === "stopped" && "opacity-40",
        )}
      />
    </div>
  );
}

function StateChip({ state, userHasControl }: { state: WorkState; userHasControl: boolean }) {
  const label = userHasControl
    ? "You have control"
    : state === "executing"
      ? "OCADE controlling"
      : state === "thinking"
        ? "Thinking"
        : state === "paused"
          ? "Paused"
          : state === "listening"
            ? "Listening"
            : "Working";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
      {state === "paused" || userHasControl ? null : (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      )}
      {label}
    </span>
  );
}

function OutcomeBadge({
  outcome,
}: {
  outcome: NonNullable<ControlWorkSession["turns"][number]["outcome"]>;
}) {
  const text =
    outcome === "verified"
      ? "Checked and confirmed on this computer"
      : outcome === "cancelled"
        ? "Stopped before finishing"
        : outcome === "blocked"
          ? "Could not continue"
          : "Did not finish";
  return <p className="mt-1.5 text-[11px] text-muted-foreground">{text}</p>;
}

function EmptyGuidance() {
  return (
    <div className="mx-auto max-w-md py-6 text-center">
      <h2 className="text-[15px] font-semibold text-foreground">Control + Work</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Tell OCADE what you want done on this computer. It looks at the screen, does the work, then
        checks that it actually worked before answering.
      </p>
    </div>
  );
}
