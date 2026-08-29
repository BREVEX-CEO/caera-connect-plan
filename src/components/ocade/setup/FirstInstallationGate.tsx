import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { isErrorStage } from "@/lib/brain/installation-state";
import { modelVault } from "@/lib/brain/model-vault";
import { useInstallation } from "@/lib/brain/use-installation";

const SetupExperience = lazy(async () => ({
  default: (await import("./SetupExperience")).SetupExperience,
}));

/**
 * Block the signed-in workspace only for the first installation on this
 * browser profile.
 *
 * The full setup experience is lazy because repeat visitors never need it.
 * A verified active marker suppresses the gate while the authority loads and
 * warms existing bytes. If the marker is stale, the gate commits once real
 * preparation starts and remains mounted through every intermediate stage.
 */
export function FirstInstallationGate({
  enabled = true,
  children,
}: {
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const installation = useInstallation();
  const [hadVerifiedInstall, setHadVerifiedInstall] = useState<boolean | null>(null);
  const committed = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setHadVerifiedInstall(true);
      return;
    }
    let live = true;
    void modelVault.installationView().then((view) => {
      if (live) setHadVerifiedInstall(view.ready);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  if (
    enabled &&
    hadVerifiedInstall === false &&
    !installation.ready &&
    (installation.preparing || isErrorStage(installation.state.stage))
  ) {
    committed.current = true;
  }
  if (installation.ready) committed.current = false;

  /*
   * Do not reveal the workspace while the one durable question is still in
   * flight. On a first visit that brief reveal was the reported setup flicker:
   * the workspace painted, IndexedDB answered "no installation", and only then
   * did the full-screen setup take its place. Repeat visitors do not see the
   * setup dialog; their already-rendered workspace is merely concealed for the
   * few milliseconds needed to prove the active artifact still exists.
   */
  const checking =
    enabled &&
    !installation.ready &&
    (hadVerifiedInstall === null ||
      (hadVerifiedInstall === false &&
        installation.state.stage === "idle" &&
        installation.state.detail === null));
  const locked = enabled && committed.current && !installation.ready;
  const concealed = checking || locked;
  return (
    <>
      <div
        inert={concealed ? true : undefined}
        aria-hidden={concealed ? true : undefined}
        className={
          checking
            ? "invisible pointer-events-none select-none"
            : locked
              ? "pointer-events-none select-none opacity-40"
              : undefined
        }
      >
        {children}
      </div>
      {locked ? (
        <div
          className="fixed inset-0 z-[100] overflow-auto bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Preparing OCADE Intelligence"
        >
          <Suspense fallback={null}>
            <SetupExperience promise="OCADE is preparing its private intelligence on this device." />
          </Suspense>
        </div>
      ) : null}
    </>
  );
}
