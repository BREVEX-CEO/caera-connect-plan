import { Link } from "@tanstack/react-router";
import { Accessibility, Captions, Eye, Keyboard, MousePointer2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useAppearance } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

export function AccessibilityPanel() {
  const appearance = useAppearance();

  return (
    <>
      <PageHeader
        eyebrow="Application"
        title="Accessibility"
        description="Keyboard, screen-reader and focus semantics are always enabled. Visual and motion preferences apply immediately and sync through the existing appearance settings path."
      />

      <GlassPanel className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Accessibility className="h-4 w-4" aria-hidden /> Always-on access
        </h3>
        <div className="mt-3 divide-y divide-border/50">
          <FixedCapability
            icon={Keyboard}
            label="Keyboard navigation and skip links"
            description="Interactive controls remain reachable without a pointer; Escape closes temporary panels."
          />
          <FixedCapability
            icon={Eye}
            label="Screen-reader semantics and focus indicators"
            description="Landmarks, labels, live status and visible focus are part of the interface, not an optional mode."
          />
        </div>
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="text-sm font-semibold">Motion and contrast</h3>
        <ToggleRow
          label="Reduce motion"
          description={
            appearance.osReducedMotion
              ? "Your operating system requests reduced motion, so it remains on."
              : "Disable nonessential transitions and animated decoration."
          }
          checked={appearance.reducedMotion || appearance.osReducedMotion}
          disabled={appearance.osReducedMotion}
          onChange={(reducedMotion) => void appearance.update({ reducedMotion })}
        />
        <ToggleRow
          label="High contrast"
          description="Increase structural contrast without changing the selected theme."
          checked={appearance.highContrast}
          onChange={(highContrast) => void appearance.update({ highContrast })}
        />
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MousePointer2 className="h-4 w-4" aria-hidden /> Pointer
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Accessibility pointer mode forces the operating-system cursor and ignores custom cursor
          artwork.
        </p>
        <button
          type="button"
          onClick={() => void appearance.update({ cursor: "accessibility" })}
          className={cn(
            "mt-3 rounded-md border px-3 py-1.5 text-xs",
            appearance.cursor === "accessibility"
              ? "border-primary/60 bg-primary/10"
              : "border-border/60 hover:bg-accent",
          )}
        >
          {appearance.cursor === "accessibility"
            ? "System accessibility cursor active"
            : "Use system accessibility cursor"}
        </button>
        <Link
          to="/settings/appearance"
          className="ml-3 inline-flex text-xs underline underline-offset-4"
        >
          Pointer size and appearance
        </Link>
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Captions className="h-4 w-4" aria-hidden /> Voice and captions
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Captions, speech rate, microphone selection, interruption and emergency mute are available
          in Voice settings. Unsupported browser speech engines are reported there rather than
          simulated.
        </p>
        <Link
          to="/settings/voice"
          className="mt-3 inline-flex text-xs underline underline-offset-4"
        >
          Open Voice and captions
        </Link>
      </GlassPanel>
    </>
  );
}

function FixedCapability({
  icon: Icon,
  label,
  description,
}: {
  icon: typeof Keyboard;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <span className="rounded-full bg-[color:var(--state-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[color:var(--state-success)]">
        On
      </span>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="mt-3 flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
