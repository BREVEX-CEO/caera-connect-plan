import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Radar, Pause, Play, Trash2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";
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
  head: () => ({ meta: [{ title: "Monitors — OCADE" }, { name: "robots", content: "noindex" }] }),
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
      .map((source) => source.trim())
      .filter(Boolean);
    const result = scan.create({
      id: `mon-${Date.now()}`,
      topic,
      subject,
      sources,
      intervalMs: MIN_INTERVAL_MS[topic],
    });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    if (!persist(scan.toJSON())) {
      scan.revoke(result.data.id);
      setMonitors(scan.list());
      return;
    }
    toast.success(
      "Monitor configuration saved. No background polling starts until a monitor runner is connected.",
    );
    setSubject("");
    setSourceText("");
  }

  function toggle(monitor: Monitor) {
    const wasActive = monitor.state === "active";
    const result = wasActive ? scan.pause(monitor.id) : scan.resume(monitor.id);
    if (!result.ok) return;
    if (!persist(scan.toJSON())) {
      if (wasActive) scan.resume(monitor.id);
      else scan.pause(monitor.id);
      setMonitors(scan.list());
    }
  }

  function revoke(id: string) {
    const before = scan.toJSON();
    const remaining = before.filter((monitor) => monitor.id !== id);
    if (remaining.length === before.length) {
      toast.error("That monitor isn't here — nothing was revoked.");
      return;
    }
    const result = scan.revoke(id);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    if (!persist(scan.toJSON())) return;
    toast.success("Monitor configuration revoked.");
  }

  const canAdd = subject.trim().length > 0 && sourceText.trim().length > 0;

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Monitors"
        description="Define source-backed things OCADE should watch. Configuration is available; continuous background fetching is not connected in this launch."
        actions={<CapabilityBadge status="NOT_CONFIGURED" />}
      />

      <div
        role="status"
        className="mb-5 flex items-start gap-3 rounded-xl border border-[color:var(--state-warning-line)] bg-[color:var(--state-warning-wash)] p-4 text-sm"
      >
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]"
          aria-hidden
        />
        <div>
          <p className="font-medium text-foreground">
            No monitor runner is polling these definitions.
          </p>
          <p className="mt-1 text-muted-foreground">
            Saving or marking a monitor active stores the watch configuration only. OCADE will not
            claim that checks or alerts are running until a real runner heartbeat is available.
          </p>
          <Link
            to="/ocade/health"
            className="mt-2 inline-block text-xs underline underline-offset-4"
          >
            View capability health
          </Link>
        </div>
      </div>

      <GlassPanel className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" aria-hidden /> Define a monitor
        </h2>
        <div className="grid gap-3">
          <div>
            <label htmlFor="mon-subject" className="text-xs font-medium">
              What to watch
            </label>
            <Input
              id="mon-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. ACME Corp filings"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="mon-topic" className="text-xs font-medium">
              Kind
            </label>
            <select
              id="mon-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value as ScanTopic)}
              className="mt-1 block h-9 w-full rounded-md border border-border/60 bg-transparent px-2 text-sm"
            >
              {(Object.keys(TOPIC_LABELS) as ScanTopic[]).map((value) => (
                <option key={value} value={value}>
                  {TOPIC_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mon-sources" className="text-xs font-medium">
              Sources (comma-separated)
            </label>
            <Input
              id="mon-sources"
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="regulator.gov, official newsroom"
              className="mt-1"
            />
          </div>
          <Button size="sm" className="w-fit" disabled={!canAdd} onClick={add}>
            Save definition
          </Button>
        </div>
      </GlassPanel>

      <div className="mt-5">
        {monitors === null ? null : monitors.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-8 w-8" aria-hidden />}
            title="No monitor definitions"
            description="OCADE only stores watch definitions you explicitly add."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {monitors.map((monitor) => (
              <li key={monitor.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      monitor.state === "active"
                        ? "bg-[color:var(--state-warning)]"
                        : "bg-muted-foreground/40",
                    )}
                    aria-hidden
                  />
                  <span className="text-[13px] font-medium">{monitor.subject}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {TOPIC_LABELS[monitor.topic]}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    configured every {Math.round(monitor.intervalMs / 60000)} min · {monitor.state}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Sources: {monitor.sources.join(", ")}
                </p>
                <p className="mt-1 text-[11px] text-[color:var(--state-warning)]">
                  Runner: not connected · no checks are executing
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => toggle(monitor)}
                  >
                    {monitor.state === "active" ? (
                      <>
                        <Pause className="mr-1.5 h-3 w-3" /> Mark paused
                      </>
                    ) : (
                      <>
                        <Play className="mr-1.5 h-3 w-3" /> Mark active
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-destructive"
                    onClick={() => revoke(monitor.id)}
                  >
                    <Trash2 className="mr-1.5 h-3 w-3" /> Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
