import { useCallback, useEffect, useMemo, useState } from "react";
import { Hand, Mic, MicOff, OctagonX, Pause, Play, Send, Square, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OcadeOrb } from "@/components/ocade/OcadeOrb";
import {
  ORB_ACCENTS,
  ORB_ACCENT_LABELS,
  ORB_APPEARANCE,
  orbStateFor,
  type OrbAccent,
  type OrbState,
} from "@/lib/orb/state";
import { useAudioLevel } from "@/lib/voice/use-audio-level";
import { directControl } from "@/lib/work/fast-router";
import type { Mission } from "@/lib/work/use-mission";
import { cn } from "@/lib/utils";

/**
 * Jarvis: the same Cowork mission, presented as one orb in a dark room.
 *
 * WHAT MAKES THIS A VIEW AND NOT A SECOND PRODUCT
 * -----------------------------------------------
 * Every value on this screen comes from the `mission` prop, and every control
 * calls a method on it. There is no state machine here, no second task list, no
 * second permit and no second permission model — switching to Jarvis mid-task
 * is a re-render of a mission that never stopped running, and switching back
 * shows the same transcript with the same receipts. `docs/DECISIONS.md` is
 * explicit that Jarvis owns presentation and audio-reactive behaviour, and
 * nothing else, and the way to keep that true is to give it nothing else.
 *
 * WHY THE ORB IS THE INTERFACE
 * ----------------------------
 * A person using Jarvis is usually not reading: they are watching their own
 * computer being operated, from a distance, deciding whether to let it carry
 * on. So the state has to be legible as a shape at a glance — and it is also
 * always written underneath, because an interface whose only channel is motion
 * excludes anybody who cannot see it and anybody who has asked for less of it.
 *
 * WHAT IT DOES NOT INVENT. It shows what the mission observed and nothing more.
 * The observation panel repeats the timeline; it does not render a picture of a
 * screen nobody captured.
 */
export function JarvisStage({
  mission,
  onReturnToNormal,
}: {
  mission: Mission;
  onReturnToNormal: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [accent, setAccent] = useState<OrbAccent>("silver");
  const [observing, setObserving] = useState(false);
  const audio = useAudioLevel();

  /*
   * The last thing OCADE actually touched, and where.
   *
   * `surface` is recorded when the step is pushed, from the tool registry, so
   * "working in the browser" is a fact about which adapter ran rather than a
   * guess from the wording of a label.
   */
  const lastAction = useMemo(
    () => [...mission.live].reverse().find((entry) => entry.surface !== undefined),
    [mission.live],
  );

  const state = orbStateFor({
    phase: mission.paused && mission.busy ? "paused" : mission.phase,
    awaitingApproval: mission.approval !== null,
    userHasControl: mission.handedOver,
    inBrowser: lastAction?.surface === "browser",
  });

  /*
   * WHAT DRIVES THE MOTION, AND WHAT IS NOT PRETENDED.
   *
   * While listening the orb answers the room: real amplitude, measured in this
   * tab, never leaving it. While speaking it uses the state's own energy —
   * the browser does not expose the level of speech it is synthesising, and an
   * orb pretending to follow a voice it cannot hear would be a decoration
   * claiming to be an instrument. Speaking is still visibly different from
   * listening, because the two states differ in pulse and shape.
   */
  const amplitude =
    state === "listening"
      ? /*
         * Amplitude, biased a little by where the energy sits. A voice is
         * mostly low-band and sibilance is not, so a whispered "stop" moves
         * the orb slightly more than its level alone would — which is the
         * frequency reactivity `docs/DESIGN.md` asks for, kept small enough
         * that loudness remains the thing a person can see.
         */
        Math.min(1, audio.level * (0.85 + 0.3 * audio.tilt))
      : 0;

  // The microphone opens when Jarvis is listening and closes the moment it is
  // not. Nothing else on this screen holds it.
  useEffect(() => {
    if (mission.mode !== "voice") {
      audio.stop();
      return;
    }
    void audio.start();
    return () => audio.stop();
    // `start` and `stop` are stable callbacks; the mode is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission.mode]);

  const submit = useCallback(() => {
    const text = prompt.trim();
    if (!text) return;
    setPrompt("");
    // The same three words mean the same three things they mean in Normal.
    const control = directControl(text);
    if (control === "stop") return mission.stop();
    if (control === "pause") return mission.setPaused(true);
    if (control === "continue") return mission.setPaused(false);
    if (mission.busy) mission.revise(text);
    else void mission.send(text);
  }, [prompt, mission]);

  const secondary = mission.approval
    ? mission.approval.question
    : (lastAction?.label ?? mission.turns.at(-1)?.text ?? "Ask OCADE to do something.");

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[oklch(0.09_0_0)] text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
          Jarvis
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 rounded-full px-3 text-[11px]"
            aria-pressed={observing}
            onClick={() => setObserving((current) => !current)}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {observing ? "Hide what it sees" : "What it sees"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={onReturnToNormal}
          >
            Return to Normal
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6"
          aria-label="What OCADE is doing"
        >
          <OcadeOrb
            state={state}
            amplitude={amplitude}
            accent={accent}
            size={280}
            className="max-w-[70vw]"
          />

          {/*
            ALWAYS IN WORDS, TOO. The orb is the fast channel and this is the
            certain one: reduced motion, a still fallback, a screen reader or a
            glance from across the room all land here.
          */}
          <div className="max-w-md text-center">
            <p className="text-[15px] font-medium text-foreground">{labelFor(state)}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{secondary}</p>
            {audio.error && mission.mode === "voice" ? (
              <p className="mt-2 text-[12px] text-destructive/85">{audio.error}</p>
            ) : null}
          </div>

          {/* The approval takes focus, and gives it back. */}
          {mission.approval ? (
            <div className="w-full max-w-md rounded-2xl border border-[oklch(0.72_0_0)]/45 bg-black/60 px-4 py-3 backdrop-blur">
              <p className="text-[13px] text-foreground">{mission.approval.question}</p>
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
        </section>

        {/*
          CONTEXTUAL, NOT PERMANENT. It opens when somebody wants to see what
          OCADE has been looking at and closes again, so the orb keeps the room.
          It repeats the mission's own timeline — the same lines Normal shows —
          rather than rendering a screen nobody captured.
        */}
        {observing ? (
          <aside
            aria-label="What OCADE has seen and done"
            className="ocade-scroll min-h-0 shrink-0 overflow-y-auto border-t border-white/10 px-5 py-4 lg:w-[340px] lg:border-l lg:border-t-0"
          >
            {mission.live.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Nothing has happened yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {mission.live.map((entry) => (
                  <li key={entry.id} className="text-[12px] leading-relaxed text-muted-foreground">
                    <span className="text-foreground/85">{entry.label}</span>
                    {entry.detail ? ` — ${entry.detail}` : ""}
                    {entry.surface ? (
                      <span className="text-muted-foreground/60">
                        {entry.surface === "browser" ? " (in the browser)" : " (on this computer)"}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Tell OCADE what to do"
              aria-label="Tell OCADE what to do"
              className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-black/50 px-4 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/50"
            />
            <Button
              type="button"
              size="icon"
              aria-label={mission.mode === "voice" ? "Stop listening" : "Listen"}
              aria-pressed={mission.mode === "voice"}
              variant={mission.mode === "voice" ? "secondary" : "ghost"}
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={() => mission.setMode(mission.mode === "voice" ? "prompt" : "voice")}
            >
              {mission.mode === "voice" ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              aria-label="Send"
              disabled={!prompt.trim()}
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={submit}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {mission.busy ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 rounded-full border border-white/15 px-3 text-[11px]"
                  onClick={() => mission.setPaused(!mission.paused)}
                >
                  {mission.paused ? (
                    <Play className="h-3.5 w-3.5" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )}
                  {mission.paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 rounded-full border border-white/15 px-3 text-[11px]"
                  onClick={mission.stop}
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 rounded-full border border-white/15 px-3 text-[11px]"
                  onClick={mission.takeOver}
                >
                  <Hand className="h-3.5 w-3.5" />
                  Take over
                </Button>
              </>
            ) : null}
            {mission.busy || mission.activeRunCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 rounded-full border border-destructive/60 bg-destructive/20 px-3 text-[11px] text-foreground"
                onClick={() => void mission.emergencyStop()}
              >
                <OctagonX className="h-3.5 w-3.5" />
                Emergency stop
              </Button>
            ) : null}

            {/*
              A CURATED SET, NOT A COLOUR EDITOR — and scoped to this room.
              The accent tints the orb and touches nothing else in the product,
              which is what `docs/DESIGN.md` allows Jarvis and only Jarvis.
            */}
            <div
              role="radiogroup"
              aria-label="Orb accent"
              className="ml-auto inline-flex items-center gap-1"
            >
              {ORB_ACCENTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={accent === option}
                  aria-label={ORB_ACCENT_LABELS[option]}
                  title={ORB_ACCENT_LABELS[option]}
                  onClick={() => setAccent(option)}
                  className={cn(
                    "h-5 w-5 rounded-full border transition",
                    accent === option ? "border-white/80 ring-1 ring-white/50" : "border-white/25",
                  )}
                  style={{ background: SWATCH[option] }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The swatch a person clicks. Same weights the renderer tints with. */
const SWATCH: Record<OrbAccent, string> = {
  silver: "linear-gradient(140deg, #e6e6e6, #8f8f8f)",
  ember: "linear-gradient(140deg, #f0cdb2, #a1704f)",
  tide: "linear-gradient(140deg, #bcd6e8, #5c7f9a)",
  moss: "linear-gradient(140deg, #c2ddc0, #5d8058)",
};

/** The orb's own words for the state, so the picture and the text agree. */
function labelFor(state: OrbState): string {
  return ORB_APPEARANCE[state].label;
}
