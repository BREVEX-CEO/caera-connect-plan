import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { ControlWorkSurface } from "@/components/ocade/work/ControlWorkSurface";
import { useControlWork } from "@/lib/agent/use-control-work";
import { useLocalEngine } from "@/lib/use-local-engine";
import { useDevicePolicy } from "@/lib/use-device-policy";
import { detectPlatform, selectFixedModel } from "@/lib/local/fixed-model";
import { useSession } from "@/lib/session";

/**
 * OCADE Control + Work — the surface that operates the computer.
 *
 * WHAT THIS REPLACED. A four-line redirect to /ocade. Control + Work existed as
 * a name in the navigation and nowhere else, so "one integrated surface" was
 * true only in the sense that there was one surface and it was Chat.
 *
 * WHY IT IS ITS OWN ROUTE. The runtime intent has to be structural rather than
 * inferred. Chat constructs no live-world runtime and therefore cannot act on
 * the machine even if a message sounds like an instruction; this route always
 * constructs one and is the only place that does. A user always knows which of
 * the two they are in, and so does the code.
 */
export const Route = createFileRoute("/_authenticated/ocade/work")({
  head: () => ({
    meta: [{ title: "Control + Work — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: ControlWorkPage,
});

function ControlWorkPage() {
  const { user, loading } = useSession();
  const engine = useLocalEngine();
  const device = useDevicePolicy();

  /*
   * The engine is chosen by platform, never by this machine's specification.
   * Resolved here rather than inside the session hook so the surface can say
   * plainly when OCADE's own engine is not installed, instead of failing on the
   * first instruction someone types.
   */
  const choice = selectFixedModel({
    platform: detectPlatform(),
    installed: engine.models.map((model) => ({
      id: model.id,
      vision: model.vision,
      sizeBytes: model.sizeBytes,
      isCloudPointer: model.isCloudPointer,
    })),
  });

  const session = useControlWork({
    modelId: choice.ok ? choice.modelId : null,
    ...(device.policy.totalRamBytes ? { totalRamBytes: device.policy.totalRamBytes } : {}),
  });

  if (loading) return <AppShell>{null}</AppShell>;
  if (!user) {
    return (
      <AppShell>
        <div className="mx-auto mt-10 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in to let OCADE work on this computer.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="-mx-5 -my-6 h-[calc(100vh-2.75rem)] min-h-0 sm:-mx-8">
        <ControlWorkSurface session={session} />
      </div>
    </AppShell>
  );
}
