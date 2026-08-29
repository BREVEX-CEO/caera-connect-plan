import { createFileRoute } from "@tanstack/react-router";
import { Check, Contrast, MousePointer2, Palette, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { PerformanceFallbackNotice } from "@/components/settings/PerformanceFallbackNotice";
import { ReadOnlyBanner } from "@/components/settings/SettingsGate";
import { useSettingsAccess } from "@/components/settings/use-settings-access";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { type ThemeMode } from "@/lib/theme-provider";
import type { CursorKind } from "@/lib/use-appearance";
import { useAppearance } from "@/lib/use-appearance";
import { recordAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  head: () => ({
    meta: [{ title: "Appearance — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: AppearancePage,
});

const THEMES: { id: ThemeMode; label: string; description: string }[] = [
  { id: "dark", label: "Dark", description: "OCADE's default black and silver environment." },
  { id: "light", label: "Light", description: "A brighter environment for daylight use." },
  {
    id: "real",
    label: "Immersive",
    description: "OCADE's animated depth palette for cinematic surfaces and the orb.",
  },
];

type ExperienceMode = "calm" | "balanced" | "immersive";

/**
 * Pointer choices, named for what the person sees rather than for the asset.
 *
 * "OCADE light" and "OCADE dark" describe the pointer's own colour, which is
 * the thing being chosen. `auto_contrast` is offered as "Match the theme"
 * because that is what it does, and it is the default worth reaching for.
 */
const CURSORS: { id: CursorKind; label: string }[] = [
  { id: "system", label: "System pointer" },
  { id: "auto_contrast", label: "Match the theme" },
  { id: "caera_white", label: "OCADE light" },
  { id: "caera_black", label: "OCADE dark" },
];

const EXPERIENCE: {
  id: ExperienceMode;
  label: string;
  description: string;
  patch: {
    reducedMotion: boolean;
    lowPerformance: boolean;
    depth3d: boolean;
    depthStrength: number;
  };
}[] = [
  {
    id: "calm",
    label: "Calm",
    description: "Minimal motion and a flat interface.",
    patch: { reducedMotion: true, lowPerformance: false, depth3d: false, depthStrength: 0 },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Fast transitions with restrained 3D depth.",
    patch: { reducedMotion: false, lowPerformance: false, depth3d: true, depthStrength: 85 },
  },
  {
    id: "immersive",
    label: "Immersive",
    description: "Full OCADE motion, depth and responsive spatial effects.",
    patch: { reducedMotion: false, lowPerformance: false, depth3d: true, depthStrength: 145 },
  },
];

function currentExperience(appearance: ReturnType<typeof useAppearance>): ExperienceMode {
  if (appearance.reducedMotion || !appearance.depth3d) return "calm";
  if (appearance.depthStrength >= 120) return "immersive";
  return "balanced";
}

function AppearancePage() {
  const appearance = useAppearance();
  const { canEdit } = useSettingsAccess();
  const experience = currentExperience(appearance);

  /*
   * A SETTING THAT DID NOT SAVE MUST NOT LOOK SAVED.
   *
   * `appearance.update` writes through to the account, so it can fail on a
   * dropped connection or a signed-out session. Unhandled, the rejection went
   * nowhere: the control moved, the theme changed for this tab, and the next
   * device never saw it — a preference that silently un-set itself.
   */
  async function selectTheme(theme: ThemeMode) {
    try {
      await appearance.update({ theme });
      await recordAction({ actionId: "settings.theme.change", metadata: { theme } });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "That theme could not be saved to your account.",
      );
    }
  }

  async function selectExperience(id: ExperienceMode) {
    const mode = EXPERIENCE.find((item) => item.id === id);
    if (!mode) return;
    try {
      await appearance.update(mode.patch);
      await recordAction({ actionId: "settings.appearance.change", metadata: { experience: id } });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "That choice could not be saved to your account.",
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Appearance"
        description="Choose how OCADE looks and how much it moves. The rest is handled automatically."
      />

      <ReadOnlyBanner className="mt-5" />

      <div className="mt-6 space-y-5">
        <GlassPanel className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Visual style</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The selected style also drives supported 3D surfaces and orb lighting.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((theme) => {
              const active = appearance.theme === theme.id;
              return (
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={!canEdit}
                  key={theme.id}
                  onClick={() => void selectTheme(theme.id)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-background/40 hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{theme.label}</span>
                    {active ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{theme.description}</p>
                </button>
              );
            })}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Motion &amp; depth</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                One choice controls animation, 3D depth and visual intensity.
                {appearance.osReducedMotion ? " Your system has reduced motion enabled." : ""}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {EXPERIENCE.map((mode) => {
              const active = experience === mode.id;
              const unavailable = appearance.osReducedMotion && mode.id !== "calm";
              return (
                <button
                  type="button"
                  aria-pressed={active}
                  key={mode.id}
                  disabled={!canEdit || unavailable}
                  onClick={() => void selectExperience(mode.id)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-background/40 hover:bg-accent/40",
                    unavailable && "cursor-not-allowed opacity-45",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{mode.label}</span>
                    {active ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{mode.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <PerformanceFallbackNotice />
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <label className="flex items-start justify-between gap-4">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Contrast className="h-4 w-4 text-primary" aria-hidden /> High contrast
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Stronger borders and less translucency for easier reading.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-label="High contrast"
              aria-checked={appearance.highContrast}
              disabled={!canEdit}
              onClick={() => void appearance.update({ highContrast: !appearance.highContrast })}
              className={cn(
                "relative mt-1 h-6 w-11 shrink-0 rounded-full border border-border transition-colors",
                appearance.highContrast ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                  appearance.highContrast ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </label>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <MousePointer2 className="h-4 w-4 text-primary" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pointer</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A larger pointer is easier to follow on a big or high-resolution screen.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {CURSORS.map((option) => {
              const active = appearance.cursor === option.id;
              return (
                <button
                  type="button"
                  key={option.id}
                  aria-pressed={active}
                  disabled={!canEdit}
                  onClick={() => void appearance.update({ cursor: option.id })}
                  className={cn(
                    "rounded-xl border p-3 text-left text-sm transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-foreground">
              Pointer size — {appearance.cursorSize}px
            </span>
            <input
              aria-label="Cursor size"
              type="range"
              min={16}
              max={64}
              step={4}
              value={appearance.cursorSize}
              disabled={
                !canEdit || appearance.cursor === "system" || appearance.cursor === "accessibility"
              }
              onChange={(event) =>
                void appearance.update({ cursorSize: Number(event.target.value) })
              }
              className="mt-2 w-full accent-primary disabled:opacity-40"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              {appearance.cursor === "system" || appearance.cursor === "accessibility"
                ? "Your operating system is drawing the pointer, so it sets the size."
                : "Applies everywhere in OCADE."}
            </span>
          </label>
        </GlassPanel>
      </div>
    </>
  );
}
