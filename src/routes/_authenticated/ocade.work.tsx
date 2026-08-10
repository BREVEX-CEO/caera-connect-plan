import { createFileRoute } from "@tanstack/react-router";
import { ControlWorkPanel } from "@/components/ocade/control/ControlWorkPanel";
import { useMissionBrain } from "@/lib/work/use-mission-brain";

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
  const { brain } = useMissionBrain();
  return (
    <div className="h-[calc(100svh-4rem)] w-full overflow-hidden rounded-xl border border-border/50">
      <ControlWorkPanel brain={brain} headerNote="Signed in · this computer" />
    </div>
  );
}
