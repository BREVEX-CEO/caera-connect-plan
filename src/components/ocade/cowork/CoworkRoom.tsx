import { Suspense, lazy, useEffect, useState } from "react";
import { ControlWorkPanel } from "@/components/ocade/control/ControlWorkPanel";
import { useMission } from "@/lib/work/use-mission";
import { useMissionBrain } from "@/lib/work/use-mission-brain";
import { cn } from "@/lib/utils";

/**
 * The Cowork room: one mission, two ways of looking at it.
 *
 * WHY THE HOOK LIVES HERE AND NOT IN EITHER VIEW
 * ----------------------------------------------
 * `PLAN.md` Phase 9 asks that Normal and Jarvis produce identical task
 * history, permissions, usage and receipts, and the surest way to get that is
 * to make a divergence impossible to write: there is one `useMission` in this
 * room, and both presentations receive it as a prop. Switching view is a
 * render. It cannot start a run, cannot buy a permit, cannot fork a
 * transcript and cannot lose an approval that is already on screen, because
 * nothing unmounts the runtime.
 *
 * The alternative — a `/ocade/jarvis` route with its own hook — would have
 * looked identical on a quiet screen and produced two missions the first time
 * somebody switched mid-task.
 *
 * WHY JARVIS IS LOADED AND NOT IMPORTED
 * -------------------------------------
 * `docs/DESIGN.md`: heavy visualiser work is lazy-loaded when Jarvis opens and
 * must not slow ordinary first paint. Normal is what opens by default, so
 * Jarvis costs nothing until it is chosen.
 */
const JarvisStage = lazy(() =>
  import("./JarvisStage").then((module) => ({ default: module.JarvisStage })),
);

export type CoworkPresentation = "normal" | "jarvis";

export function CoworkRoom({ headerNote }: { headerNote?: React.ReactNode }) {
  const { brain, warm } = useMissionBrain();
  const mission = useMission(brain);

  const [presentation, setPresentation] = useState<CoworkPresentation>("normal");

  /*
   * WARM ON ARRIVAL. A cold 7B took over two minutes to answer its first turn
   * on this machine, nearly all of it loading weights from disk while the
   * screen said "Thinking". Starting that load when the user opens the room
   * moves it to the seconds they spend reading the empty state.
   */
  useEffect(() => {
    warm();
  }, [warm]);

  if (presentation === "jarvis") {
    return (
      <Suspense fallback={<JarvisLoading />}>
        <JarvisStage mission={mission} onReturnToNormal={() => setPresentation("normal")} />
      </Suspense>
    );
  }

  return (
    <ControlWorkPanel
      mission={mission}
      headerNote={headerNote}
      presentation={<PresentationSelector value={presentation} onChange={setPresentation} />}
    />
  );
}

/**
 * The selector, said in the two words the documents use.
 *
 * A radio group rather than a toggle: "Normal" and "Jarvis" are two named
 * places, and a switch labelled with one of them leaves a person guessing what
 * the other side is.
 */
function PresentationSelector({
  value,
  onChange,
}: {
  value: CoworkPresentation;
  onChange: (next: CoworkPresentation) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Cowork view"
      className="inline-flex items-center rounded-full border border-border/70 p-0.5"
    >
      {(["normal", "jarvis"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[10.5px] transition-colors",
            value === option
              ? "bg-[oklch(0.72_0_0)]/20 text-foreground"
              : "text-muted-foreground/70 hover:text-foreground",
          )}
        >
          {option === "normal" ? "Normal" : "Jarvis"}
        </button>
      ))}
    </div>
  );
}

function JarvisLoading() {
  return (
    <div className="grid h-full w-full place-items-center bg-[oklch(0.09_0_0)]">
      <p className="text-[12.5px] text-muted-foreground">Opening Jarvis…</p>
    </div>
  );
}
