import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Radar, Pause, Play, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  WorldScan,
  MIN_INTERVAL_MS,
  type Monitor,
  type ScanTopic,
} from "@/lib/research/world-scan";

export const Route = createFileRoute("/_authenticated/ocade/monitors")({
  head: () => ({
    meta: [{ title: "Monitors — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: MonitorsPage,
});

const STORAGE_KEY = "ocade.monitors.v1";

const TOPIC_LABELS: Record<ScanTopic, string> = {
  local_incident: "Local incidents",
  weather: "Weather",
  transport: "Transport",
  market: "Markets",
  company_news: "Company news",
  regulation: "Regulations",
  outage: "Outages",
  security_advisory: "Security advisories",
  project: "Project",
};

/**
 * The user-facing surface for §5.3 world-scan monitoring: opt-in, rate-limited,
 * source-cited, revocable — the four rules the registry enforces, made visible.
 *
 * Monitors persist on this device (localStorage). Nothing is monitored until
 * the user adds it, and the rate floor is shown so no monitor can be set to
 * hammer a source. This surface manages watch lists; the actual fetching is the
 * network-blocked part and is not claimed to run here.
 */
function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[] | null>(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState<ScanTopic>("market");
  const [sourceText, setSourceText] = useState("");

  const scan = useMemo(() => {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      return raw ? WorldScan.fromJSON(JSON.parse(raw)) : new WorldScan();
    } catch {
      return new WorldScan();
    }
  }, []);

  const persist = useCallback(
    (state: Monitor[]): boolean => {
      try {
        if (!globalThis.localStorage) throw new Error("Local storage is unavailable.");
        globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        toast.error("Couldn't save your monitors on this device.");
        return false;
      }
      setMonitors(scan.list());
      return true;
    },
    [scan],
  );

  useEffect(() => setMonitors(scan.list()), [scan]);

  function add() {
    const sources = sourceText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const r = scan.create({
      id: `mon-${Date.now()}`,
      topic,
      subject,
      sources,
      intervalMs: MIN_INTERVAL_MS[topic],
    });
    if (!r.ok) {
      toast.error(r.reason);
      return;
    }
    if (!persist(scan.toJSON())) {
      scan.revoke(r.data.id);
      setMonitors(scan.list());
      return;
    }
    toast.success(r.evidence);
    setSubject("");
    setSourceText("");
  }

  function toggle(m: Monitor) {
    const wasActive = m.state === "active";
    const r = wasActive ? scan.pause(m.id) : scan.resume(m.id);
    if (!r.ok) return;
    if (!persist(scan.toJSON())) {
      if (wasActive) scan.resume(m.id);
      else scan.pause(m.id);
      setMonitors(scan.list());
    }
  }

  function revoke(id: string) {
    const current = scan.toJSON();
    const remaining = current.filter((monitor) => monitor.id !== id);
    if (remaining.length === current.length) {
      toast.error("That monitor isn't here - nothing was revoked.");
      return;
    }
    if (!persist(remaining)) return;
    const r = scan.revoke(id);
    if (!r.ok) {
      toast.error(r.reason);
      return;
    }
    toast.success(r.evidence);
    setMonitors(scan.list());
  }

  const canAdd = subject.trim().length > 0 && sourceText.trim().length > 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="OCADE"
        title="Monitors"
        description="Watch things that change — incidents, weather, markets, regulations. Opt-in, rate-limited to protect sources, always traceable, and revocable any time."
      />

      <div className="flex flex-col gap-5">
        <GlassPanel className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4" aria-hidden /> Watch something new
          </h3>
          <div className="flex flex-col gap-2">
            <div>
              <label htmlFor="mon-subject" className="text-xs font-medium text-foreground">
                What to watch
              </label>
              <Input
                id="mon-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. ACME Corp filings"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <label htmlFor="mon-topic" className="text-xs font-medium text-foreground">
                Kind
              </label>
              <select
                id="mon-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value as ScanTopic)}
                className="mt-1 block h-9 w-full rounded-md border border-border/60 bg-transparent px-2 text-sm"
              >
                {(Object.keys(TOPIC_LABELS) as ScanTopic[]).map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mon-sources" className="text-xs font-medium text-foreground">
                Sources (comma-separated) — required, so every alert is traceable
              </label>
              <Input
                id="mon-sources"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="e.g. regulator.gov, official newsroom"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Button size="sm" className="h-8 w-fit" disabled={!canAdd} onClick={add}>
                Add monitor
              </Button>
            </div>
          </div>
        </GlassPanel>

        {monitors === null ? null : monitors.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-8 w-8" aria-hidden />}
            title="Nothing is being monitored"
            description="OCADE watches only what you ask it to. Add a monitor above; you can pause or revoke it any time."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {monitors.map((m) => (
              <li key={m.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      m.state === "active"
                        ? "bg-[color:var(--state-success)]"
                        : "bg-muted-foreground/40",
                    )}
                    aria-hidden
                  />
                  <span className="text-[13px] font-medium">{m.subject}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {TOPIC_LABELS[m.topic]}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    every {Math.round(m.intervalMs / 60000)} min · {m.state}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Sources: {m.sources.join(", ")}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => toggle(m)}
                  >
                    {m.state === "active" ? (
                      <>
                        <Pause className="mr-1.5 h-3 w-3" aria-hidden /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-1.5 h-3 w-3" aria-hidden /> Resume
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-[color:var(--state-warning)]"
                    onClick={() => revoke(m.id)}
                  >
                    <Trash2 className="mr-1.5 h-3 w-3" aria-hidden /> Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
