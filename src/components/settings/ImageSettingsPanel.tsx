import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Eye, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  discoverLocalModels,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalModelInfo,
} from "@/lib/ocade-local";

/**
 * Image understanding and image generation.
 *
 * The rule this page exists to honour: OCADE never implies a capability it
 * does not have. Both sections below are driven by what is ACTUALLY installed
 * on this machine right now, checked live — not by a feature flag someone
 * remembered to set.
 *
 * Image generation is the honest-disabled case. No image generation model is
 * bundled, and the local runtime OCADE uses serves language and vision models
 * only — it cannot run a diffusion model at all. So rather than a greyed-out
 * button with no explanation, this states what is missing and what would have
 * to be true for it to work. That is the difference between a disabled control
 * and a dead one.
 */

interface VisionState {
  loading: boolean;
  reachable: boolean;
  models: LocalModelInfo[];
  reason?: string;
}

export function ImageSettingsPanel() {
  const [state, setState] = useState<VisionState>({ loading: true, reachable: false, models: [] });

  const probe = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const discovery = await discoverLocalModels(DEFAULT_LOCAL_BRIDGE_URL);
    setState({
      loading: false,
      reachable: discovery.reachable,
      models: discovery.models.filter((m) => m.vision),
      reason: discovery.reason,
    });
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  const visionReady = state.models.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Images"
        description="Reading images you attach to a chat, and creating images from a prompt."
        actions={
          <Button variant="outline" size="sm" onClick={() => void probe()} disabled={state.loading}>
            {state.loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Re-check
          </Button>
        }
      />

      <div className="grid gap-5 pb-16">
        <GlassPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Reading images</h2>
            </div>
            {state.loading ? (
              <StatusBadge status="pending">Checking</StatusBadge>
            ) : visionReady ? (
              <StatusBadge status="active">Available on this device</StatusBadge>
            ) : (
              <StatusBadge status="setup_required">Setup required</StatusBadge>
            )}
          </div>

          {visionReady ? (
            <>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Attach an image in chat and ask OCADE to describe it, read a screenshot, pull text
                out of it, or explain a chart. It runs on this computer, so the image is not
                uploaded anywhere.
              </p>
              <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
                {state.models.map((model) => (
                  <li key={model.id} className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--state-success)]" />
                    <span className="text-foreground">{model.label}</span>
                    <span>· {(model.sizeBytes / 1e9).toFixed(2)} GB on disk</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {state.reachable
                  ? "The local engine is running, but no image-reading model is installed. Until one is, OCADE refuses image questions instead of guessing from the file name."
                  : "The local engine is not running on this computer, so OCADE cannot check which image models are installed."}
              </p>
              <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3 text-[13px] text-muted-foreground">
                <div className="font-medium text-foreground">What is needed</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>Start the OCADE Local Engine in Settings › Local Engine.</li>
                  <li>
                    Install an image-reading engine from the same page. OCADE selects one that fits
                    this machine and shows the download size before it starts.
                  </li>
                </ol>
              </div>
            </>
          )}
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Creating images</h2>
            </div>
            <StatusBadge status="setup_required">Not available</StatusBadge>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            OCADE cannot generate images. This is a genuine limitation, not a switch that has been
            left off:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
            <li>
              No image generation model ships with OCADE, and none is installed on this computer.
            </li>
            <li>
              The local engine OCADE runs serves language and image-reading models. It cannot run an
              image generation model at all, so installing one would not help by itself.
            </li>
            <li>OCADE has no public-cloud image-generation fallback.</li>
          </ul>
          <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3 text-[13px] text-muted-foreground">
            <div className="font-medium text-foreground">What would have to be true</div>
            <p className="mt-1">
              A reviewed image-generation runtime installed on this machine. When one exists, this
              page gains the prompt, progress, cancel and save controls — and not before, because a
              button that produces nothing is worse than no button.
            </p>
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              disabled
              title="No image generation model or provider is available. The requirements are listed above."
              aria-describedby="ocade-image-generation-reason"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Generate an image
            </Button>
            <p
              id="ocade-image-generation-reason"
              className="mt-2 text-[12px] text-muted-foreground"
            >
              Disabled because no image generation model or provider is available on this device.
            </p>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 text-[13px] text-muted-foreground">
          Images you attach are read by the engine you are chatting with. On this device that means
          they never leave the machine. If you switch to a cloud engine, OCADE asks before the image
          is sent, every time it would leave.
        </GlassPanel>
      </div>
    </>
  );
}
