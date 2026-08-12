import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Palette, Check, Upload, RefreshCcw } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { type ThemeMode, type CursorKind } from "@/lib/theme-provider";
import { useAppearance } from "@/lib/use-appearance";
import { recordAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  head: () => ({
    meta: [{ title: "Appearance — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: AppearancePage,
});

const THEMES: { id: ThemeMode; label: string; description: string }[] = [
  {
    id: "dark",
    label: "Dark",
    description: "Obsidian, graphite and silver. Restrained cyan accents.",
  },
  {
    id: "light",
    label: "Light",
    description: "Warm ivory and silver with dark controls and gold accents.",
  },
  { id: "real", label: "REAL", description: "Animated aurora, morphing light and liquid depth." },
];

const CURSORS: { id: CursorKind; label: string; description: string }[] = [
  { id: "system", label: "System default", description: "Use your operating system cursor." },
  { id: "caera_black", label: "CAERA Black Arrow", description: "Dark arrow with light outline." },
  { id: "caera_white", label: "CAERA White Arrow", description: "Light arrow with dark outline." },
  {
    id: "auto_contrast",
    label: "Auto Contrast",
    description: "Chooses black or white based on the current theme.",
  },
  {
    id: "custom",
    label: "Custom upload",
    description: "Use your own PNG or SVG cursor (max 128 KB).",
  },
  {
    id: "accessibility",
    label: "Accessibility (force system)",
    description: "Always use the system cursor and ignore custom cursors.",
  },
];

const MAX_CURSOR_BYTES = 128 * 1024;

function AppearancePage() {
  const appearance = useAppearance();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function selectTheme(theme: ThemeMode) {
    await appearance.update({ theme });
    await recordAction({ actionId: "settings.theme.change", metadata: { theme } });
  }

  async function selectCursor(cursor: CursorKind) {
    if (cursor === "custom") {
      fileRef.current?.click();
      return;
    }
    await appearance.update({ cursor });
    await recordAction({ actionId: "settings.appearance.change", metadata: { cursor } });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/svg+xml"].includes(file.type)) {
      setUploadError("Only PNG or SVG cursors are allowed.");
      return;
    }
    if (file.size > MAX_CURSOR_BYTES) {
      setUploadError("Cursor file must be 128 KB or smaller.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    await appearance.update({ cursor: "custom", cursorCustom: dataUrl });
    await recordAction({
      actionId: "settings.appearance.change",
      metadata: { cursor: "custom", size: file.size, type: file.type },
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Account · Appearance"
        title="Appearance"
        description="Themes, motion, cursor and accessibility. Settings sync across your devices."
      />

      <div className="mt-6 space-y-6">
        {/* Themes */}
        <GlassPanel className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">Theme</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((t) => {
              const active = appearance.theme === t.id;
              return (
                <button
                  aria-pressed={active}
                  key={t.id}
                  onClick={() => selectTheme(t.id)}
                  className={cn(
                    "group text-left rounded-xl border p-4 transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-background/40 hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{t.label}</span>
                    {active && <Check className="h-4 w-4 text-primary" aria-hidden />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                </button>
              );
            })}
          </div>
        </GlassPanel>

        {/* Motion & performance */}
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold text-foreground">Motion &amp; performance</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            System reduced-motion preference is always respected.
            {appearance.osReducedMotion && " OS setting is currently ON."}
          </p>
          <div className="mt-4 space-y-3">
            <ToggleRow
              label="Reduce motion"
              help="Disable nonessential animation and background morphing."
              checked={appearance.reducedMotion || appearance.osReducedMotion}
              disabled={appearance.osReducedMotion}
              onChange={(v) => appearance.update({ reducedMotion: v })}
            />
            <ToggleRow
              label="High contrast"
              help="Strengthen borders and reduce translucency."
              checked={appearance.highContrast}
              onChange={(v) => appearance.update({ highContrast: v })}
            />
            <ToggleRow
              label="Low performance mode"
              help={
                appearance.autoLowPerf
                  ? "Auto-detected slow frames. Continuous effects are disabled."
                  : "Disable blur and continuous background effects."
              }
              checked={appearance.lowPerformance || appearance.autoLowPerf}
              disabled={appearance.autoLowPerf}
              onChange={(v) => appearance.update({ lowPerformance: v })}
            />
          </div>
        </GlassPanel>

        {/* Cursor */}
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold text-foreground">Cursor</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a CAERA cursor, upload your own, or force the system cursor for accessibility.
          </p>

          <input
            aria-label="Upload custom cursor"
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml"
            className="hidden"
            onChange={onFile}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CURSORS.map((c) => {
              const active = appearance.cursor === c.id;
              const hasCustom = c.id === "custom" && appearance.cursorCustom;
              return (
                <button
                  aria-pressed={active}
                  key={c.id}
                  onClick={() => selectCursor(c.id)}
                  className={cn(
                    "text-left rounded-xl border p-4 transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-background/40 hover:bg-accent/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{c.label}</span>
                    {active ? (
                      <Check className="h-4 w-4 text-primary" aria-hidden />
                    ) : c.id === "custom" ? (
                      <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                  {hasCustom && (
                    <p className="mt-2 text-[11px] text-primary/80">Custom cursor loaded.</p>
                  )}
                </button>
              );
            })}
          </div>

          {uploadError && (
            <p className="mt-3 text-xs text-destructive" role="alert">
              {uploadError}
            </p>
          )}

          {appearance.cursorCustom && (
            <button
              onClick={() => appearance.update({ cursorCustom: null, cursor: "system" })}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              <RefreshCcw className="h-3 w-3" aria-hidden /> Remove custom cursor
            </button>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-foreground">
                Cursor size — {appearance.cursorSize}px
              </label>
              <input
                aria-label="Cursor size"
                type="range"
                min={16}
                max={64}
                step={2}
                value={appearance.cursorSize}
                onChange={(e) => appearance.update({ cursorSize: Number(e.target.value) })}
                className="mt-2 w-full accent-primary"
              />
            </div>

            <div className="flex items-center">
              <ToggleRow
                label="Cursor trail"
                help="A subtle glow that follows the cursor. Disabled automatically in low-performance mode."
                checked={
                  appearance.cursorTrail && !appearance.lowPerformance && !appearance.autoLowPerf
                }
                disabled={appearance.lowPerformance || appearance.autoLowPerf}
                onChange={(v) => appearance.update({ cursorTrail: v })}
              />
            </div>
          </div>
        </GlassPanel>
      </div>
    </>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={cn("flex items-start justify-between gap-4", disabled && "opacity-70")}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{help}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-1 h-6 w-11 shrink-0 rounded-full border border-border transition-colors",
          checked ? "bg-primary" : "bg-muted",
          disabled && "cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
