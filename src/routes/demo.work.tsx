import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ControlWorkSurface } from "@/components/ocade/work/ControlWorkSurface";
import { useControlWork } from "@/lib/agent/use-control-work";
import { decideDemoControl } from "@/lib/agent/local-demo-guard";
import { useLocalEngine } from "@/lib/use-local-engine";
import { useDevicePolicy } from "@/lib/use-device-policy";
import { detectPlatform, selectFixedModel } from "@/lib/local/fixed-model";
import { DemoSessionBadge } from "@/components/ocade/demo/DemoSessionBadge";
import { useDemoSession } from "@/lib/demo/use-demo-session";

/**
 * Demo Control + Work — the same surface, without a Supabase session.
 *
 * WHY THIS EXISTS AS A ROUTE RATHER THAN A FLAG
 * ---------------------------------------------
 * The authenticated route is untouched. Adding a "skip auth" branch inside it
 * would put the bypass one boolean away from production, and that boolean would
 * eventually be set by something other than a person testing on their own
 * machine. A separate route under `/demo` cannot be reached by the signed-in
 * surface and cannot quietly become it.
 *
 * WHAT IS IDENTICAL TO PRODUCTION
 * -------------------------------
 * Everything that matters. The same `ControlWorkSurface`, the same
 * `useControlWork` session, the same live-world loop, the same fixed model, the
 * same companion. The Rust host re-validates every action against the same
 * allowlist, refuses protected input the same way, and honours the same
 * emergency stop — it does not know or care that the caller is a demo.
 *
 * WHAT IS DIFFERENT
 * -----------------
 * No Supabase account, and therefore no cloud writes: this surface calls no
 * server function at all. Its conversation lives in the page for the length of
 * the demo session and is not persisted to any account.
 *
 * AND IT ONLY RUNS LOCALLY. `decideDemoControl` requires the signed desktop
 * shell AND a loopback origin. Anywhere else it renders the reason and no
 * composer, because "no sign-in required" and "operates a real computer" must
 * never meet across a network.
 */
export const Route = createFileRoute("/demo/work")({
  // No `ssr: false` here. The parent `/demo` route already sets it, and
  // declaring it a second time on the child made the server router stop
  // matching this path: the demo shell was returned with a 404 status and the
  // page only appeared after hydration. The sibling demo routes set nothing
  // and inherit correctly.
  head: () => ({
    meta: [
      { title: "Control + Work (local demo) — OCADE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoControlWorkPage,
});

function DemoControlWorkPage() {
  const decision = decideDemoControl();
  const engine = useLocalEngine(undefined, decision.allowed);
  const device = useDevicePolicy();
  const { session: demoSession } = useDemoSession({ autoStart: decision.allowed });

  const choice = selectFixedModel({
    platform: detectPlatform(),
    installed: engine.models.map((model) => ({
      id: model.id,
      vision: model.vision,
      sizeBytes: model.sizeBytes,
      isCloudPointer: model.isCloudPointer,
    })),
  });

  const work = useControlWork({
    modelId: choice.ok ? choice.modelId : null,
    ...(device.policy.totalRamBytes ? { totalRamBytes: device.policy.totalRamBytes } : {}),
  });

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border/60 px-4">
        <Link
          to="/demo"
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Demo
        </Link>
        <span className="text-[13px] font-semibold text-foreground">Control + Work</span>
        {/* Said plainly and permanently. Someone whose computer is being
            operated should never have to work out which mode they are in. */}
        <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Local test mode
        </span>
        <div className="ml-auto">
          <DemoSessionBadge session={demoSession} />
        </div>
      </header>

      {decision.allowed ? (
        <div className="min-h-0 flex-1">
          <ControlWorkSurface session={work} />
        </div>
      ) : (
        <div className="mx-auto mt-16 max-w-md px-6 text-center">
          <h1 className="text-[15px] font-semibold text-foreground">
            Not available on this device
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">{decision.explain}</p>
          <p className="mt-3 text-[12px] text-muted-foreground/80">
            Sign in and use OCADE Control + Work to operate a computer you have approved.
          </p>
        </div>
      )}
    </div>
  );
}
