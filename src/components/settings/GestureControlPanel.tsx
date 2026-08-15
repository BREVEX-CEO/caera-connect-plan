import { useCallback, useEffect, useState } from "react";
import { Camera, Hand, MousePointer2, Octagon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import {
  COMPANION_UNAVAILABLE_REASON,
  getCompanion,
  type GestureControlStatus,
} from "@/lib/native/companion-bridge";
import { bootstrapCompanion } from "@/lib/native/tauri-companion";

const unavailable: GestureControlStatus = {
  available: false,
  running: false,
  controlEnabled: false,
  cameraIndex: null,
  reason: COMPANION_UNAVAILABLE_REASON,
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Gesture control did not respond.";
}

/**
 * Visible, two-step activation for native hand control.
 *
 * An ordinary web page can use a camera but cannot move the operating-system
 * pointer. This panel therefore reports the real desktop companion state and
 * never turns a browser-only button into a pretend success.
 */
export function GestureControlPanel() {
  const [status, setStatus] = useState<GestureControlStatus>(unavailable);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(async () => {
    const boot = await bootstrapCompanion();
    if (!boot.installed) {
      setStatus({ ...unavailable, reason: boot.reason });
      return;
    }
    setStatus(await getCompanion().gestureStatus());
  }, []);

  useEffect(() => {
    void refresh().catch((error) => setStatus({ ...unavailable, reason: message(error) }));
  }, [refresh]);

  useEffect(() => {
    if (!status.running) return;
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 1_500);
    return () => window.clearInterval(timer);
  }, [refresh, status.running]);

  async function start(enableControl: boolean) {
    setBusy(true);
    try {
      const next = await getCompanion().startGestureControl({ cameraIndex, enableControl });
      setStatus(next);
      setConfirming(false);
      toast.success(enableControl ? "Hand cursor control is active." : "Hand preview is running.");
    } catch (error) {
      toast.error(message(error));
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      setStatus(await getCompanion().stopGestureControl());
      setConfirming(false);
      toast.success("Hand control stopped and the mouse button was released.");
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassPanel className="p-5" data-testid="gesture-control-panel">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
          <Hand className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Hand gesture control</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            MediaPipe reads the webcam locally. Frames are displayed for you, then discarded; they
            are not uploaded or recorded.
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] ${
            status.controlEnabled
              ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]"
              : status.running
                ? "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]"
                : "border-white/10 text-muted-foreground"
          }`}
        >
          {status.controlEnabled ? "Cursor active" : status.running ? "Preview only" : "Stopped"}
        </span>
      </div>

      {!status.available ? (
        <div className="mt-4 rounded-lg border border-[color:var(--state-warning)]/25 bg-[color:var(--state-warning)]/[0.06] p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Desktop app required</p>
          <p className="mt-1">
            {status.reason ?? "This build does not contain the gesture-control sidecar."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Camera className="h-4 w-4" aria-hidden /> Camera
              <select
                value={cameraIndex}
                onChange={(event) => setCameraIndex(Number(event.target.value))}
                disabled={busy || status.running}
                className="h-9 rounded-md border border-white/10 bg-black/30 px-2 text-foreground"
                aria-label="Gesture camera"
              >
                {[0, 1, 2, 3].map((index) => (
                  <option key={index} value={index}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>

            {status.running ? (
              <Button variant="destructive" onClick={() => void stop()} disabled={busy}>
                <Octagon className="mr-2 h-4 w-4" aria-hidden /> Stop hand control
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => void start(false)} disabled={busy}>
                  <Camera className="mr-2 h-4 w-4" aria-hidden /> Test preview
                </Button>
                <Button onClick={() => setConfirming(true)} disabled={busy}>
                  <MousePointer2 className="mr-2 h-4 w-4" aria-hidden /> Activate cursor
                </Button>
              </>
            )}
          </div>

          {confirming && !status.running ? (
            <div className="mt-4 rounded-lg border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/[0.06] p-4">
              <div className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-foreground">Allow hand control?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your index finger will move the system cursor. Pinching can click and drag in
                    every application, including File Explorer. Keep the preview visible and press
                    Esc, Q or Ctrl+Shift+F12 to stop immediately.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => void start(true)} disabled={busy}>
                      Activate now
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p><strong className="text-foreground">Move:</strong> point with your index finger.</p>
        <p><strong className="text-foreground">Select:</strong> short thumb/index pinch.</p>
        <p><strong className="text-foreground">Drag files:</strong> hold that pinch, move, release.</p>
        <p><strong className="text-foreground">Open:</strong> thumb/middle pinch for double-click.</p>
        <p><strong className="text-foreground">Scroll:</strong> index and middle up; move vertically.</p>
        <p><strong className="text-foreground">Delete:</strong> intentionally not mapped to a gesture.</p>
      </div>
    </GlassPanel>
  );
}
