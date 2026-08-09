import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Switch } from "@/components/ui/switch";
import { SettingsField, ReadOnlyBanner } from "./SettingsGate";
import { useSettingsAccess } from "./use-settings-access";
import { useAppearance } from "@/lib/use-appearance";
import { chooseRenderTier, starCountFor, type RenderTier } from "@/lib/landing/universe";

/**
 * 3D motion, and what this device will actually render.
 *
 * THE HONEST PART. Most "animation quality" settings are a preference the
 * product then ignores. This one shows the tier that was actually CHOSEN for
 * this machine, computed from the same function the landing page uses, and says
 * which signal decided it. A user on a four-year-old laptop can see that OCADE
 * noticed rather than wondering why it looks different from the marketing.
 *
 * THE SYSTEM PREFERENCE WINS. `prefers-reduced-motion` overrides everything
 * here, including a user who has switched motion on in this panel, and the
 * panel says so instead of letting the toggle appear to work.
 */
export function MotionPanel() {
  const { canEdit } = useSettingsAccess();
  const { reducedMotion, osReducedMotion, update } = useAppearance();
  const [tier, setTier] = useState<RenderTier>("full");
  const [signals, setSignals] = useState<{ cores?: number; memoryGb?: number; width: number }>({
    width: 0,
  });

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const measured = {
      cores: nav.hardwareConcurrency,
      memoryGb: nav.deviceMemory,
      width: window.innerWidth,
    };
    setSignals(measured);
    setTier(
      chooseRenderTier({
        reducedMotion: osReducedMotion || reducedMotion,
        cores: measured.cores,
        memoryGb: measured.memoryGb,
        viewportWidth: measured.width,
      }),
    );
  }, [osReducedMotion, reducedMotion]);

  const tierWord = tier === "full" ? "Full" : tier === "reduced" ? "Reduced" : "Still frames only";

  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">3D Motion</h3>
      </header>

      <ReadOnlyBanner />

      <SettingsField
        label="Reduce motion"
        description="Turns off depth transitions, the landing animation and panel movement. Text and layout are unchanged."
      >
        <Switch
          checked={reducedMotion || osReducedMotion}
          disabled={!canEdit || osReducedMotion}
          onCheckedChange={(next) => void update({ reducedMotion: next })}
          aria-label="Reduce motion"
        />
      </SettingsField>

      {osReducedMotion ? (
        <p className="rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-[11.5px] text-muted-foreground">
          {/*
            Explained rather than silently forced. A toggle that cannot be moved
            and does not say why reads as broken.
          */}
          Your operating system asks for reduced motion, so OCADE follows it. Change it in your
          system accessibility settings to enable motion here.
        </p>
      ) : null}

      <div className="mt-1 rounded-lg border border-border/60 bg-secondary/25 p-3">
        <p className="text-[12.5px] font-medium text-foreground">
          This device renders: <span className="tabular-nums">{tierWord}</span>
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          {/*
            The measured signals, not a marketing claim. Chosen by the same
            function the landing page calls, so this cannot disagree with what
            actually draws.
          */}
          Chosen from {signals.cores ?? "an unknown number of"} processor cores
          {signals.memoryGb ? `, ${signals.memoryGb} GB of memory` : ""}, and a {signals.width}px
          viewport. {starCountFor(tier)} background stars.
          {tier !== "full"
            ? " OCADE stepped down so the interface stays responsive rather than stuttering."
            : ""}
        </p>
      </div>
    </GlassPanel>
  );
}
