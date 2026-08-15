import { useMemo, useState } from "react";
import {
  AppWindow,
  Bot,
  BrainCircuit,
  Files,
  Globe2,
  Mic2,
  MonitorSmartphone,
  ScanEye,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  CONTROL_DOMAINS,
  CONTROL_LAUNCHER_COUNT,
  type ControlDomainId,
  type ControlLauncher,
} from "@/lib/work/control-capabilities";
import { cn } from "@/lib/utils";

const ICONS = {
  apps: AppWindow,
  browser: Globe2,
  files: Files,
  voice: Mic2,
  vision: ScanEye,
  mobile: MonitorSmartphone,
  system: BrainCircuit,
  automations: Bot,
} satisfies Record<ControlDomainId, typeof AppWindow>;

function riskLabel(risk: ControlLauncher["risk"]): string {
  if (risk === "read") return "Read only";
  if (risk === "low") return "Reversible";
  if (risk === "confirm") return "Confirms first";
  return "Always asks";
}

export function ControlCommandDeck({
  onSelect,
  className,
}: {
  onSelect: (launcher: ControlLauncher) => void;
  className?: string;
}) {
  const [active, setActive] = useState<ControlDomainId>("apps");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CONTROL_DOMAINS.find((domain) => domain.id === active)?.launchers ?? [];
    return CONTROL_DOMAINS.flatMap((domain) => domain.launchers).filter((launcher) =>
      [launcher.label, launcher.description, launcher.prompt].join(" ").toLowerCase().includes(needle),
    );
  }, [active, query]);

  return (
    <section
      aria-label="OCADE command deck"
      className={cn(
        "ocade-relational-surface rounded-2xl border border-border/70 bg-background/82 p-3 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent-ocade)]">
            Command deck
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {CONTROL_LAUNCHER_COUNT} launchers · every instruction remains reviewable before it runs
          </p>
        </div>
        <label className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">Search command launchers</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 56 controls"
            className="h-8 w-full rounded-full border border-border/70 bg-black/25 pl-8 pr-3 text-[11.5px] text-foreground outline-none transition focus:border-[color:var(--accent-ocade)]/55"
          />
        </label>
      </div>

      <div
        role="tablist"
        aria-label="Control domains"
        className="ocade-scroll flex gap-1 overflow-x-auto pb-2"
      >
        {CONTROL_DOMAINS.map((domain) => {
          const Icon = ICONS[domain.id];
          const selected = !query && active === domain.id;
          return (
            <button
              key={domain.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setQuery("");
                setActive(domain.id);
              }}
              className={cn(
                "ocade-command-tab inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[10.5px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-[color:var(--accent-ocade)]/45 bg-[color:var(--accent-ocade)]/14 text-foreground"
                  : "border-border/55 bg-white/[0.025] text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {domain.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {visible.map((launcher) => (
          <button
            key={launcher.id}
            type="button"
            onClick={() => onSelect(launcher)}
            className="ocade-command-card group relative min-h-[74px] overflow-hidden rounded-xl border border-border/60 bg-white/[0.025] p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[color:var(--accent-ocade)]/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
            />
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-foreground">
                  {launcher.label}
                </span>
                <span className="mt-1 block text-[10.5px] leading-relaxed text-muted-foreground">
                  {launcher.description}
                </span>
              </span>
              {launcher.risk === "high" ? (
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
              ) : null}
            </span>
            <span
              className={cn(
                "mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9.5px]",
                launcher.risk === "high"
                  ? "border-destructive/30 text-destructive"
                  : "border-border/60 text-muted-foreground/80",
              )}
            >
              {riskLabel(launcher.risk)}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs text-muted-foreground">
          No command launcher matches “{query}”.
        </p>
      ) : null}
    </section>
  );
}
