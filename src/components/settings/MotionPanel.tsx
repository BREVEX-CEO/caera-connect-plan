import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Switch } from "@/components/ui/switch";
import { SettingsField, ReadOnlyBanner } from "./SettingsGate";
import { AppearanceSaveState } from "./AppearanceSaveState";
import { PerformanceFallbackNotice } from "./PerformanceFallbackNotice";
import { useSettingsAccess } from "./use-settings-access";
import { useAppearance } from "@/lib/use-appearance";
import { useDepth } from "@/components/motion/depth-context";
import { cn } from "@/lib/utils";
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
/**
 * The strength dial, as three named stops rather than a free slider.
 *
 * A continuous 0-200 control asks people to tune a number they cannot preview
 * precisely, and every value in between is one somebody has to support. Three
 * stops are a choice; a slider is a chore.
 */
const DEPTH_STEPS = [
  { value: 50, label: "Subtle" },
  { value: 100, label: "Balanced" },
  { value: 160, label: "Deep" },
] as const;

/** Which stop a stored value belongs to, so an out-of-band number still shows one selected. */
function nearestStep(value: number): number {
  return DEPTH_STEPS.reduce((best, step) =>
    Math.abs(step.value - value) < Math.abs(best.value - value) ? step : best,
  ).value;
}

export function MotionPanel() {
  const { canEdit } = useSettingsAccess();
  const { reducedMotion, osReducedMotion, depth3d, depthStrength, update } = useAppearance();
  /** Either source of the preference; the depth scene treats them identically. */
  const motionOff = reducedMotion || osReducedMotion;

  const depth = useDepth();
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

      {/*
        Persistence is stated up front, not implied. Everything below applies
        the moment it is switched; whether it SURVIVES a refresh is a separate
        fact and belongs on screen.
      */}
      <AppearanceSaveState />

      {/*
        The automatic fallback is explained where the motion settings are, so a
        stepped-down scene never looks like a setting that failed to apply.
      */}
      <PerformanceFallbackNotice />

      <SettingsField
        label="Reduce motion"
        description="Holds the interface still: no 3D depth, no landing animation, no panel movement. Text, colour, contrast, buttons and layout are unchanged, and everything keeps working."
      >
        <Switch
          checked={motionOff}
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

      <SettingsField
        label="3D depth"
        description="Surfaces sit at real distances in one perspective scene, so panels layer, cast matching shadows and drift against each other as the pointer moves."
      >
        {/*
          SHOWN AS OFF WHILE MOTION IS REDUCED, because it IS off — the scene is
          flat in that state whatever this preference says. A switch left
          standing at "on" over a flat interface is the product lying about its
          own settings. The stored choice is untouched and returns the moment
          reduced motion is switched back off.
        */}
        <Switch
          checked={depth3d && !motionOff}
          disabled={!canEdit || motionOff}
          onCheckedChange={(next) => void update({ depth3d: next })}
          aria-label="3D depth"
        />
      </SettingsField>

      {motionOff ? (
        <p className="rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-[11.5px] text-muted-foreground">
          3D depth and animation are switched off automatically while reduced motion is on. Your
          depth preference is remembered and comes back when you turn motion on again.
        </p>
      ) : null}

      {/*
        THE DIAL IS HIDDEN WHEN DEPTH IS OFF rather than disabled. A strength
        control for an effect that is switched off has no meaning, and leaving a
        greyed slider behind invites people to drag it and conclude the setting
        is broken.
      */}
      {depth3d && !motionOff ? (

        <SettingsField
          label="Depth strength"
          description="How pronounced the third dimension is. Subtle keeps the layering and almost removes the movement."
        >
          <div className="flex items-center gap-1" role="group" aria-label="Depth strength">
            {DEPTH_STEPS.map((step) => {
              const selected = nearestStep(depthStrength) === step.value;
              return (
                <button
                  key={step.value}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={selected}
                  onClick={() => void update({ depthStrength: step.value })}
                  className={cn(
                    "h-7 rounded-md border px-2.5 text-[11.5px] transition-colors disabled:opacity-50",
                    selected
                      ? "border-primary/50 bg-primary/15 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        </SettingsField>
      ) : null}

      {/*
        What the scene is ACTUALLY doing, which is not always what was asked
        for: a still 3D scene contains no motion, so reduced motion keeps the
        depth and drops only the pointer tilt. Saying that here is the
        difference between a considered behaviour and an apparently ignored
        setting.
      */}
      <p className="rounded-md border border-border/60 bg-secondary/25 px-2.5 py-2 text-[11.5px] text-muted-foreground">
        Right now:{" "}
        {depth.mode === "full"
          ? "depth and pointer tilt are both active."
          : depth.mode === "static"
            ? "depth is active and pointer tilt is off."
            : depth3d
              ? "flat — this browser or device cannot composite 3D transforms."
              : "flat, because you turned 3D depth off."}
      </p>

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
