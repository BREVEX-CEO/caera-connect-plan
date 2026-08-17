import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ControlWorkPanel } from "@/components/ocade/control/ControlWorkPanel";
import { useMissionBrain } from "@/lib/work/use-mission-brain";
import { LivingIntelligenceBackdrop } from "@/components/visual/LivingIntelligenceBackdrop";

/**
 * OCADE Control + Work.
 *
 * WHAT THIS ROUTE USED TO BE. A redirect to `/ocade`. Selecting "Control + Work"
 * put the user in Chat, which is the one thing this section must not do: the
 * whole point of a separate room is that an instruction typed in it has a real
 * computer on the other end, and an instruction typed in Chat does not. A
 * redirect made those the same place while the navigation claimed they were
 * not — the worst of both, because the user believed they had chosen.
 *
 * SEPARATE RUNTIME, SHARED EVERYTHING ELSE. Authentication, the local engine
 * and the history layer are common. The runtime path is not: Chat streams from
 * the engine and stops there, while this runs the agent loop and reaches the
 * native sidecars one approved action at a time.
 */
export const Route = createFileRoute("/_authenticated/ocade/work")({
  head: () => ({
    meta: [{ title: "Control + Work — OCADE" }],
  }),
  component: ControlWorkRoute,
});

function ControlWorkRoute() {
  const { brain, warm } = useMissionBrain();

  /*
   * WARM ON ARRIVAL. A cold 7B took over two minutes to answer its first
   * Control + Work turn on this machine, nearly all of it loading weights from
   * disk while the screen said "Thinking". Starting that load when the user
   * opens the room moves it to the seconds they spend reading the empty state.
   */
  useEffect(() => {
    warm();
  }, [warm]);
  return (
    <div className="relative h-[calc(100svh-4rem)] w-full overflow-hidden rounded-xl border border-border/50">
      {/*
        The cinematic backdrop belongs HERE and not in Chat: this room drives a
        real machine, and it should feel like one. It is still only atmosphere —
        `aria-hidden`, no pointer events, behind everything.
      */}
      <LivingIntelligenceBackdrop intensity="cinematic" />
      {/*
        The panel sits on a near-opaque plate above the scene. Stop, takeover,
        permission and approval controls live inside it, and a control that
        halts a running action must never be the thing competing with a moving
        gradient for the eye — so the plate is opaque enough to remove the
        contest entirely.
      */}
      <div className="relative z-10 h-full bg-background/88">
        <ControlWorkPanel
          brain={brain}
          headerNote="Signed in · this computer · file attachment is not configured yet"
        />
      </div>
    </div>
  );
}
