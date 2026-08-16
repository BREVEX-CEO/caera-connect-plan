import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ChatShell } from "@/components/ocade/chat/ChatShell";
import { ChatSidebar } from "@/components/ocade/chat/ChatSidebar";
import { DemoSessionBadge } from "@/components/ocade/demo/DemoSessionBadge";
import { DemoControlNav, DemoSidebarNav } from "@/components/ocade/demo/DemoSidebarNav";
import { ControlWorkPanel } from "@/components/ocade/control/ControlWorkPanel";
import { useDemoSession } from "@/lib/demo/use-demo-session";
import { formatResetRemaining, warningMessage } from "@/lib/demo/session";
import { useMissionBrain } from "@/lib/work/use-mission-brain";
import { stopAllLocalMissionsFn } from "@/lib/control-work.functions";

export const Route = createFileRoute("/demo/control")({
  head: () => ({
    meta: [
      { title: "OCADE Control + Work — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoControlWork,
});

/**
 * PC control, in the demo, with no account.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT RECKLESS
 * -------------------------------------------
 * The whole claim of this product is that OCADE can work your computer. A demo
 * that shows a chat window and asks you to sign up to find out whether the
 * claim is true is a demo of a text box. So this is the real thing: the same
 * agent loop, the same tools, the same verification.
 *
 * It is safe for exactly one reason, and it is not a UI reason. The server only
 * grants unauthenticated control when the browser and the server are the same
 * machine — see `control-access.node.ts`. On a hosted deployment this screen
 * loads and then says it cannot reach a computer, which is the truth. Nothing
 * here can talk it into anything else, because the decision is not made here.
 *
 * WHEN THE CLOCK RUNS OUT, THE COMPUTER IS HANDED BACK FIRST.
 * The demo ending while OCADE is mid-task is the case that matters most: the
 * expiry path stops the mission, releases any held key or mouse button, and
 * only then clears the session and leaves. An expiry that navigated away first
 * would leave a Python host and possibly a browser running on somebody's
 * machine, with Shift held down, and no interface left to fix it from.
 */
function DemoControlWork() {
  const navigate = useNavigate();
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
  const endedRef = useRef(false);

  const finish = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    try {
      // Hand the machine back before anything else. This is the one call that
      // must not be skipped, so it is first and it is awaited.
      await stopAllLocalMissionsFn({ data: { reason: "The demo session ended." } });
    } catch {
      /* the server sweeps idle missions anyway */
    }
    toast.info("Your 28-minute demo has ended. Nothing was saved.", {
      description: "OCADE stopped local control. Sign in to continue.",
      duration: 9000,
    });
    void navigate({
      to: "/auth",
      search: { next: "/home", message: "Your 28-minute demo ended. Sign in to continue." },
      replace: true,
    });
  }, [navigate]);

  const { session } = useDemoSession({
    autoStart: true,
    onWarn: (state) => toast.warning(warningMessage(state.remainingMs), { duration: 10_000 }),
    onExpire: () => void finish(),
    onBlocked: (nextEligibleAt) => {
      void navigate({
        to: "/auth",
        search: {
          next: "/home",
          message: `This browser's demo resets in ${formatResetRemaining(nextEligibleAt, Date.now())}. Sign in to continue now.`,
        },
        replace: true,
      });
    },
  });

  // Leaving the screen by any other route ends the mission too. The panel
  // releases its own mission on unmount; this covers the case where the user
  // navigates while a second mission has been started.
  useEffect(() => {
    return () => {
      void stopAllLocalMissionsFn({ data: { reason: "The user left Control + Work." } }).catch(
        () => undefined,
      );
    };
  }, []);

  return (
    <ChatShell
      sidebarLabel="Demo"
      sidebar={
        <ChatSidebar
          conversations={[]}
          activeId={null}
          // Control + Work has one task at a time and no history to start
          // afresh from, so "New chat" belongs to the Chat room next door.
          onNewChat={() => void navigate({ to: "/demo/ocade" })}
          emptyLabel="This session is temporary."
          primaryAction={<DemoControlNav active="control" />}
          footer={<DemoSidebarNav active="control" />}
        />
      }
      header={
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-foreground">OCADE Control + Work</p>
            <p className="truncate text-[11px] text-muted-foreground">
              8-domain command constellation · 28 live objects
            </p>
          </div>
          <DemoSessionBadge session={session} className="shrink-0" />
          <Link
            to="/demo/ocade"
            className="shrink-0 rounded-full border border-border/60 px-3 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Chat
          </Link>
        </div>
      }
      composer={null}
    >
      <div className="h-full min-h-0 overflow-hidden">
        <ControlWorkPanel
          brain={brain}
          headerNote="No account · this computer only · nothing is saved"
        />
      </div>
    </ChatShell>
  );
}
