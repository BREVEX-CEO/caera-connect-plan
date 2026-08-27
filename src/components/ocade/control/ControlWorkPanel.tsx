import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  Globe2,
  Hand,
  Mic,
  MicOff,
  Pause,
  Play,
  Send,
  Smartphone,
  Sparkles,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GestureControlPanel } from "@/components/settings/GestureControlPanel";
import { ControlCommandDeck } from "./ControlCommandDeck";
import { ControlSolarScene } from "./ControlSolarScene";
import type { ControlLauncher } from "@/lib/work/control-capabilities";
import { useVoicePrefs } from "@/lib/use-voice-prefs";
import { useDictation } from "@/lib/voice/use-dictation";
import { cn } from "@/lib/utils";
import { orbStateFor } from "@/lib/orb/state";
import { useMission, type MissionBrain, type TimelineEntry } from "@/lib/work/use-mission";
import { directControl } from "@/lib/work/fast-router";
import { OcadeCompanion } from "@/components/ocade/OcadeCompanion";

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
  const [deckOpen, setDeckOpen] = useState(false);
  const [gestureOpen, setGestureOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const voicePrefs = useVoicePrefs();

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

  /*
   * The microphone list is read when voice mode is entered, not on mount.
   *
   * Enumerating input devices is what makes the OS treat an app as interested
   * in audio, and a user who never leaves prompt mode has not asked OCADE to
   * take any interest in their microphone at all.
   */
  useEffect(() => {
    if (mission.mode === "voice") void mission.refreshAudio();
    // `refreshAudio` is stable; re-running on mode change is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission.mode]);

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

    /*
     * "STOP" IS A STOP, NOT A CHANGE OF PLAN.
     *
     * Typed mid-task it used to be handed to the loop as a revision, which
     * meant it went to the engine, waited for a turn to finish and then asked
     * the model what the user had meant. Somebody typing "stop" while their
     * mouse is being moved is not opening a negotiation.
     */
    const control = directControl(text);
    if (control === "stop") {
      mission.stop();
      return;
    }
    if (control === "pause") {
      mission.setPaused(true);
      return;
    }
    if (control === "continue") {
      mission.setPaused(false);
      return;
    }

    // Otherwise, mid-task a new sentence is a change of plan: the work already
    // done is kept and only what happens next changes.
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

  const selectLauncher = useCallback((launcher: ControlLauncher) => {
    setPrompt(launcher.prompt);
    setDeckOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col lg:flex-row", className)}>
      {/* ------------------------------------------------------- the system -- */}
      <section
        aria-label="What OCADE is doing on this computer"
        className="relative min-h-[230px] min-w-0 flex-[0_0_38%] overflow-hidden bg-black lg:min-h-0 lg:flex-1"
      >
        <ControlSolarScene state={sceneState} className="absolute inset-0 h-full w-full" />

        {/*
          Buddy reports the same state the scene behind it is animating, in the
          one place a person's eye already goes to check the connection. It is a
          status light, not a second voice: it says nothing the panel is not
          already saying, in words, elsewhere on this screen.
        */}
        <OcadeCompanion
          compact
          state={orbStateFor({
            phase: sceneState,
            awaitingApproval: mission.approval !== null,
            userHasControl: mission.handedOver,
          })}
          label={
            mission.handedOver
              ? "You have the computer — OCADE is standing by"
              : connected
                ? "OCADE is connected to this device"
                : "OCADE is waiting for the companion on this computer"
          }
          className="absolute bottom-4 left-4 z-20"
        />

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
        <div className="absolute right-3 top-3 flex max-w-[62%] flex-wrap justify-end gap-1.5 sm:right-6 sm:top-4">
          <SceneButton
            onClick={() => setDeckOpen((current) => !current)}
            icon={<Command className="h-3.5 w-3.5" />}
            label={deckOpen ? "Close deck" : "56 controls"}
          />
          <SceneButton
            onClick={() => setGestureOpen(true)}
            icon={<Hand className="h-3.5 w-3.5" />}
            label="Hand control"
          />
          <SceneButton
            onClick={() =>
              selectLauncher({
                id: "browser-control",
                label: "Browser control",
                description: "Work in an approved browser session.",
                prompt:
                  "Open browser control and show which browser session is approved before taking any action.",
                risk: "read",
              })
            }
            icon={<Globe2 className="h-3.5 w-3.5" />}
            label="Browser"
          />
          <SceneButton
            onClick={() =>
              selectLauncher({
                id: "mobile-status",
                label: "Mobile status",
                description: "Show paired mobile control state.",
                prompt: "Show the current mobile companion connection and trust status.",
                risk: "read",
              })
            }
            icon={<Smartphone className="h-3.5 w-3.5" />}
            label="Mobile"
          />
          {mission.busy ? (
            <>
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
                onClick={mission.takeOver}
                icon={<Hand className="h-3.5 w-3.5" />}
                label="Take over"
              />
            </>
          ) : null}
        </div>
      </section>

      {/* -------------------------------------------------- OCADE PC Control -- */}
      {/*
        WIDTH AS THREE PLAIN CLASSES, not one arbitrary `min()` value.
        `w-[min(420px,38%)]` is not a class Tailwind can emit — the comma ends
        the arbitrary value — so it silently produced no width at all and the
        panel expanded to its content, squeezing the system into a 154px strip.
        A rule that fails by doing nothing is worse than one that fails loudly.
      */}
      <aside className="flex min-h-0 w-full min-w-0 flex-1 flex-col border-t border-border/60 bg-background/96 lg:w-[38%] lg:min-w-[340px] lg:max-w-[460px] lg:shrink-0 lg:border-l lg:border-t-0">
        <header className="border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-ocade)] shadow-[0_0_14px_var(--accent-ocade)]"
              aria-hidden
            />
            <h2 className="text-[14.5px] font-medium text-foreground">OCADE Command Center</h2>
          </div>
          {headerNote ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">{headerNote}</p>
          ) : null}
        </header>

        {deckOpen ? (
          <div className="ocade-scroll max-h-[58%] overflow-y-auto border-b border-border/60 p-3">
            <ControlCommandDeck onSelect={selectLauncher} />
          </div>
        ) : null}

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
                  {mission.approval.spoken
                    ? " OCADE read it out, and it waits here either way."
                    : ""}
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
              ref={composerRef}
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
                variant={deckOpen ? "secondary" : "ghost"}
                aria-label={deckOpen ? "Close command deck" : "Open command deck"}
                aria-pressed={deckOpen}
                title="Open 56 reviewed control launchers"
                className="h-7 w-7 shrink-0 rounded-full text-muted-foreground/80"
                onClick={() => setDeckOpen((current) => !current)}
              >
                <Command className="h-3.5 w-3.5" />
              </Button>
              {dictation.supported ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={dictation.state === "listening" ? "Stop dictating" : "Dictate"}
                  aria-pressed={dictation.state === "listening"}
                  className="h-7 w-7 shrink-0 rounded-full text-muted-foreground/80"
                  onClick={() => dictation.toggle()}
                >
                  {dictation.state === "listening" ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : null}

              {/*
                MODE, AS A VISIBLE STATE RATHER THAN A HIDDEN PREFERENCE.

                It changes which approvals are asked for, so the user has to be
                able to see which one they are in without opening a settings
                page — an unnoticed switch to hands-free is a switch to fewer
                questions, and that is not a thing to discover by surprise.
              */}
              <div
                role="radiogroup"
                aria-label="Interaction mode"
                className="ml-1 inline-flex items-center rounded-full border border-[oklch(0.3_0.02_80)]/70 p-0.5"
              >
                {(["prompt", "voice"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={mission.mode === option}
                    onClick={() => mission.setMode(option)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10.5px] transition-colors",
                      mission.mode === option
                        ? "bg-[oklch(0.72_0.13_82)]/20 text-foreground"
                        : "text-muted-foreground/70 hover:text-foreground",
                    )}
                  >
                    {option === "prompt" ? "Prompt" : "Voice"}
                  </button>
                ))}
              </div>

              {/*
                The hands-free microphone, shown only in voice mode.

                Distinct from the dictation button above, which types into this
                box and stops. This one is the continuous listener: it is what
                hears "stop" while OCADE is working, and turning it off releases
                the audio stream rather than muting it.
              */}
              {mission.mode === "voice" ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant={mission.mic.enabled ? "secondary" : "ghost"}
                    aria-label={
                      mission.mic.enabled ? "Turn the microphone off" : "Turn the microphone on"
                    }
                    aria-pressed={mission.mic.enabled}
                    title={mission.mic.detail}
                    className="h-7 gap-1.5 rounded-full px-2.5 text-[10.5px]"
                    onClick={() => void mission.setMicEnabled(!mission.mic.enabled)}
                  >
                    {mission.mic.enabled ? (
                      <Mic className="h-3.5 w-3.5" />
                    ) : (
                      <MicOff className="h-3.5 w-3.5" />
                    )}
                    {mission.mic.enabled ? "Listening" : "Mic off"}
                  </Button>

                  {mission.mic.devices.length > 1 ? (
                    <select
                      aria-label="Microphone"
                      value={mission.mic.deviceId ?? ""}
                      onChange={(event) =>
                        void mission.selectMicDevice(
                          event.target.value === "" ? null : Number(event.target.value),
                        )
                      }
                      className="h-7 max-w-[190px] rounded-full border border-[oklch(0.3_0.02_80)]/70 bg-transparent px-2.5 text-[10.5px] text-muted-foreground/90 outline-none"
                    >
                      <option value="">System default</option>
                      {mission.mic.devices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <Button
                    type="button"
                    size="sm"
                    variant={voicePrefs.prefs.gender === "female" ? "secondary" : "ghost"}
                    aria-pressed={voicePrefs.prefs.gender === "female"}
                    title="Prefer a locally installed female voice"
                    className="h-7 gap-1.5 rounded-full px-2.5 text-[10.5px]"
                    onClick={() => voicePrefs.update({ gender: "female" })}
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden /> Female voice
                  </Button>
                </>
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

      <Dialog open={gestureOpen} onOpenChange={setGestureOpen}>
        <DialogContent className="max-h-[88svh] max-w-2xl overflow-y-auto border-border/70 bg-background/96 p-3 sm:p-4">
          <DialogTitle className="sr-only">Hand gesture control</DialogTitle>
          <GestureControlPanel />
        </DialogContent>
      </Dialog>
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
