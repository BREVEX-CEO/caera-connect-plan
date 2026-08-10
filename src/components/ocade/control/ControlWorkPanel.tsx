import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hand, Mic, MicOff, Paperclip, Pause, Play, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControlSolarScene } from "./ControlSolarScene";
import { useDictation } from "@/lib/voice/use-dictation";
import { cn } from "@/lib/utils";
import { useMission, type MissionBrain, type TimelineEntry } from "@/lib/work/use-mission";

/**
 * OCADE Control + Work: the room where OCADE is asked to DO things to this
 * computer, rather than asked about them.
 *
 * WHY IT IS NOT CHAT WITH A DIFFERENT HEADING
 * -------------------------------------------
 * Chat answers. This acts. They need different rooms because they need
 * different consent: a sentence typed into Chat must never move the mouse, and
 * an instruction typed here has a real machine on the other end. The two share
 * authentication, the local engine and the history layer, and share no runtime
 * path — Chat streams from the engine and stops there; this runs the agent loop
 * and reaches the sidecars one approved action at a time.
 *
 * THE COMPOSITION
 * ---------------
 * The system fills the middle, because what OCADE is doing to the machine is
 * the thing worth looking at while it does it. The task lives in a column on the
 * right with the composer pinned to its bottom, so the conversation reads
 * downward into the box you type in. There is no dashboard: no charts, no
 * counters, no log pane. The one line of machine state sits over the scene, and
 * everything else OCADE has to say, it says in words.
 *
 * WHAT THIS INTERFACE REFUSES TO SAY
 * -----------------------------------
 * Playwright. PyAutoGUI. UI Automation. Python. Port numbers. Model names.
 * JSON. Tool identifiers. None of them appears here, because none is a thing
 * the person asking OCADE to tidy their desktop needs to know, and every one of
 * them makes the product look like a developer console pointed at their machine.
 * What IS shown: what OCADE did, in the words a person would use, and whether it
 * could confirm it.
 */

export function ControlWorkPanel({
  brain,
  /** Rendered in the panel header. The demo and the signed-in app differ here. */
  headerNote,
  className,
}: {
  brain: MissionBrain;
  headerNote?: React.ReactNode;
  className?: string;
}) {
  const mission = useMission(brain);
  const [prompt, setPrompt] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);

  const dictation = useDictation({
    lang: "en-US",
    onTranscript: (text, isFinal) => {
      if (isFinal) setPrompt((current) => `${current} ${text}`.trim());
    },
  });

  useEffect(() => {
    void mission.connect();
    // Connecting once on arrival is the point; `connect` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const history = historyRef.current;
    // Feature-detected: `Element.scrollTo` is absent in jsdom, and a
    // convenience that scrolls a list must never unmount the interface.
    if (typeof history?.scrollTo === "function") {
      history.scrollTo({ top: history.scrollHeight });
    }
  }, [mission.turns, mission.live]);

  const submit = useCallback(() => {
    const text = prompt.trim();
    if (!text) return;
    setPrompt("");
    // Mid-task, a new sentence is a change of plan rather than a new task: the
    // work already done is kept and only what happens next changes.
    if (mission.busy) mission.revise(text);
    else void mission.send(text);
  }, [prompt, mission]);

  const sceneState = mission.paused && mission.busy ? "paused" : mission.phase;

  const machineLine = useMemo(() => {
    const start = mission.start;
    if (!start) return mission.connecting ? "Reading this computer…" : null;
    if (!start.ok) return start.detail;
    const parts: string[] = [];
    if (start.activeWindow?.title) parts.push(`In front: ${start.activeWindow.title}`);
    if (typeof start.machine?.cpuPercent === "number") {
      parts.push(`Processor ${Math.round(start.machine.cpuPercent)}%`);
    }
    if (typeof start.machine?.memoryUsedPercent === "number") {
      parts.push(`Memory ${Math.round(start.machine.memoryUsedPercent)}%`);
    }
    return parts.join(" · ") || "Connected to this computer.";
  }, [mission.start, mission.connecting]);

  const connected = mission.start?.ok === true;

  return (
    <div className={cn("flex h-full min-h-0 w-full", className)}>
      {/* ------------------------------------------------------- the system -- */}
      <section
        aria-label="What OCADE is doing on this computer"
        className="relative min-w-0 flex-1 overflow-hidden bg-[oklch(0.13_0.008_75)]"
      >
        <ControlSolarScene state={sceneState} className="absolute inset-0 h-full w-full" />

        {/*
          The machine in one line. Not a dashboard: the two or three facts that
          show OCADE is attached to THIS computer rather than describing one in
          general.
        */}
        <div className="pointer-events-none absolute left-6 top-5 max-w-[70%]">
          <p className="truncate text-[11.5px] text-[oklch(0.85_0.05_82)]/70">{machineLine}</p>
          {connected && mission.start?.voice ? (
            <p className="mt-0.5 truncate text-[10.5px] text-[oklch(0.8_0.04_82)]/45">
              Voice: {mission.start.voice.voiceName}
              {mission.start.voice.cloudRequired ? "" : " · on this device"}
            </p>
          ) : null}
        </div>

        {/*
          WHILE OCADE IS WORKING: three controls, nothing else. Pause, Stop,
          Take over — the three things somebody watching their own computer
          being operated actually wants within reach.
        */}
        {mission.busy ? (
          <div className="absolute right-6 top-4 flex items-center gap-1.5">
            <SceneButton
              onClick={() => mission.setPaused(!mission.paused)}
              icon={
                mission.paused ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )
              }
              label={mission.paused ? "Resume" : "Pause"}
            />
            <SceneButton
              onClick={mission.stop}
              icon={<Square className="h-3.5 w-3.5" />}
              label="Stop"
            />
            <SceneButton
              onClick={() => {
                mission.stop();
              }}
              icon={<Hand className="h-3.5 w-3.5" />}
              label="Take over"
            />
          </div>
        ) : null}
      </section>

      {/* -------------------------------------------------- OCADE PC Control -- */}
      {/*
        WIDTH AS THREE PLAIN CLASSES, not one arbitrary `min()` value.
        `w-[min(420px,38%)]` is not a class Tailwind can emit — the comma ends
        the arbitrary value — so it silently produced no width at all and the
        panel expanded to its content, squeezing the system into a 154px strip.
        A rule that fails by doing nothing is worse than one that fails loudly.
      */}
      <aside className="flex w-[38%] min-w-[320px] max-w-[420px] shrink-0 flex-col border-l border-[oklch(0.28_0.02_80)]/60 bg-[oklch(0.115_0.006_75)]">
        <header className="border-b border-[oklch(0.28_0.02_80)]/50 px-5 py-4">
          <h2 className="text-[14.5px] font-medium text-foreground">OCADE PC Control</h2>
          {headerNote ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">{headerNote}</p>
          ) : null}
        </header>

        <div ref={historyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {mission.turns.length === 0 && !mission.live.length ? (
            <p className="text-[12.5px] leading-relaxed text-muted-foreground/75">
              {connected
                ? "Ask OCADE to do something on this computer — open an application, read what is on screen, write a note, search the web. It looks first, works in small steps, and checks afterwards that what it did actually happened."
                : (mission.error ?? "OCADE is connecting to this computer.")}
            </p>
          ) : null}

          {/*
            A WAY OUT OF THE UNREACHABLE STATE.
            Without this the screen had, on a machine it could not reach, no
            enabled control whatsoever: Send is disabled without a connection,
            Attach is not built yet, and dictation is absent on browsers with no
            recogniser. A route audit that presses every enabled control found
            nothing to press, which is the machine-readable version of a
            dead end.
          */}
          {!connected && !mission.connecting ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 rounded-full px-4 text-[12px]"
              onClick={() => void mission.connect()}
            >
              Try again
            </Button>
          ) : null}

          {mission.turns.map((turn) => (
            <div key={turn.id}>
              {turn.role === "you" ? (
                <div className="flex justify-end">
                  <p className="max-w-[88%] rounded-2xl rounded-br-md bg-[oklch(0.72_0.13_82)]/15 px-3.5 py-2 text-[13px] leading-relaxed text-foreground">
                    {turn.text}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {turn.entries && turn.entries.length > 0 ? (
                    <Steps entries={turn.entries} />
                  ) : null}
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                    {turn.text}
                  </p>
                </div>
              )}
            </div>
          ))}

          {mission.live.length > 0 ? <Steps entries={mission.live} live /> : null}

          {/*
            THE APPROVAL, IN THE CONVERSATION rather than in a modal over it.
            A dialog that covers the screen hides the thing being asked about,
            and this question is nearly always answered by looking at what OCADE
            has just done.
          */}
          {mission.approval ? (
            <div
              className={cn(
                "rounded-xl border px-4 py-3",
                mission.approval.risk === "high"
                  ? "border-destructive/45 bg-destructive/10"
                  : "border-[oklch(0.72_0.13_82)]/40 bg-[oklch(0.72_0.13_82)]/10",
              )}
            >
              <p className="text-[13px] font-medium text-foreground">{mission.approval.question}</p>
              {mission.approval.risk === "high" ? (
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  This one changes something that is not trivial to undo.
                </p>
              ) : null}
              <div className="mt-2.5 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-full px-4 text-[12px]"
                  onClick={() => mission.answer(true)}
                >
                  Yes, do it
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-full px-4 text-[12px]"
                  onClick={() => mission.answer(false)}
                >
                  No
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ----------------------------------------------------- the composer -- */}
        <div className="border-t border-[oklch(0.28_0.02_80)]/50 p-3">
          <div className="rounded-2xl border border-[oklch(0.3_0.02_80)]/60 bg-[oklch(0.155_0.008_75)] px-3 py-2.5">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder="Ask OCADE to control or work on this computer…"
              aria-label="Ask OCADE to control or work on this computer"
              className="min-h-[40px] w-full resize-none bg-transparent text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <div className="mt-1.5 flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Attach"
                disabled
                title="Attachments are coming to Control + Work"
                className="h-7 w-7 rounded-full text-muted-foreground/60"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
              {dictation.supported ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={dictation.state === "listening" ? "Stop dictating" : "Dictate"}
                  aria-pressed={dictation.state === "listening"}
                  className="h-7 w-7 rounded-full text-muted-foreground/80"
                  onClick={() => dictation.toggle()}
                >
                  {dictation.state === "listening" ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : null}

              <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.3_0.02_80)]/70 px-2.5 py-1 text-[10.5px] text-muted-foreground/80">
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    connected ? "bg-[oklch(0.72_0.16_145)]" : "bg-muted-foreground/50",
                  )}
                />
                On this device
              </span>

              <div className="ml-auto">
                {mission.busy ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-label="Stop"
                    className="h-8 w-8 rounded-full"
                    onClick={mission.stop}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    aria-label="Send"
                    disabled={!prompt.trim() || !connected}
                    className="h-8 w-8 rounded-full"
                    onClick={submit}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="px-1 pt-1.5 text-[10.5px] text-muted-foreground/50">
            {mission.busy
              ? "Press Enter to change what OCADE is doing · Stop to end it"
              : "Press Enter to send · Shift+Enter for a new line"}
          </p>
          {dictation.error ? (
            <p className="px-1 pt-1 text-[11px] text-muted-foreground">{dictation.error}</p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function SceneButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
      className="h-7 gap-1.5 rounded-full border border-[oklch(0.35_0.03_80)]/60 bg-background/50 px-3 text-[11.5px] backdrop-blur hover:bg-background/70"
    >
      {icon}
      {label}
    </Button>
  );
}

/**
 * What OCADE did, one line each.
 *
 * The dot carries the outcome and the sentence carries the detail. "Not
 * confirmed on screen" is written out rather than left to a colour, because
 * "done" and "done, and I checked" are different claims and the product rule is
 * that OCADE never conflates them.
 */
function Steps({ entries, live = false }: { entries: TimelineEntry[]; live?: boolean }) {
  return (
    <ul className="space-y-1">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
          <span
            aria-hidden
            className={cn(
              "mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full",
              entry.kind === "problem" || entry.kind === "refused"
                ? "bg-destructive/70"
                : entry.kind === "asked"
                  ? "bg-[oklch(0.72_0.13_82)]"
                  : entry.verified === false
                    ? "bg-muted-foreground/45"
                    : "bg-[oklch(0.72_0.16_145)]/80",
              live && entry.kind === "acting" ? "animate-pulse" : "",
            )}
          />
          <span className="text-muted-foreground">
            <span className="text-foreground/80">{entry.label}</span>
            {entry.detail ? ` — ${entry.detail}` : ""}
            {entry.verified === false ? " (not confirmed on screen)" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
