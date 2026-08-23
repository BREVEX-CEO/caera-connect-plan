import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, Search, ShieldCheck, FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PackRegistry,
  coverageReport,
  describeCoverage,
  describeAppLookup,
} from "@/lib/skills/pack-registry";
import { describeMethod, CONTROL_PREFERENCE } from "@/lib/skills/skill-pack";
import { listAppMaps, forgetAppMap } from "@/lib/skills/app-map";
import {
  UNKNOWN_APP_LEARNING_REALITY,
  UNKNOWN_APP_SUPPORT_LABELS,
} from "@/lib/skills/unknown-app-learning";
import { describeRunnable } from "@/lib/skills/executor-registry";
import { SkillTrustPanel } from "@/components/settings/SkillTrustPanel";
import { createDefaultExecutors, RUNTIME_REALITY } from "@/lib/skills/default-executors";
import { DataWorkbench } from "@/components/ocade/DataWorkbench";
import { CriteriaScorecard } from "@/components/ocade/CriteriaScorecard";
import { BenchmarkPanel } from "@/components/ocade/BenchmarkPanel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MarketplaceBoundaryPanel } from "@/components/settings/MarketplaceBoundaryPanel";
import { ApplicationLifecycleBoundaryPanel } from "@/components/settings/ApplicationLifecycleBoundaryPanel";

export const Route = createFileRoute("/_authenticated/settings/skills")({
  head: () => ({
    meta: [{ title: "Software skills — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: SkillsPage,
});

function SkillsPage() {
  const registry = useMemo(() => new PackRegistry(), []);
  const report = useMemo(() => coverageReport(registry), [registry]);
  const [query, setQuery] = useState("");
  const [maps, setMaps] = useState(() => listAppMaps());

  // Derived from the real executor registry, so this can never drift from what
  // is actually wired up.
  const runnableSummary = useMemo(
    () =>
      describeRunnable(
        createDefaultExecutors(() => ({})),
        registry.testedCapabilities(),
      ),
    [registry],
  );

  // Three states, deliberately kept apart on screen. Merging "OCADE drives
  // this software" with "OCADE reads this category's files" into one green list
  // would be the over-claim the whole coverage model exists to prevent.
  const driven = report.filter((r) => r.supported && !r.formatOnly);
  const formatOnly = report.filter((r) => r.supported && r.formatOnly);
  const unsupported = report.filter((r) => !r.supported);

  const lookup = query.trim();

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Software skills"
        description="What OCADE can actually operate on your behalf — and, just as importantly, what it can't yet."
      />

      <div className="flex flex-col gap-5">
        <GlassPanel className="p-4">
          <p className="text-sm text-muted-foreground">{describeCoverage(report)}</p>
        </GlassPanel>

        {/* Signing, capability sandbox and revocation for community skills. */}
        <SkillTrustPanel />
        <MarketplaceBoundaryPanel />
        <ApplicationLifecycleBoundaryPanel />

        {/*
          What runs HERE, right now, versus what needs another component. A user
          deciding whether to rely on OCADE offline needs this before they try,
          not at the moment it fails.
        */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Check className="h-4 w-4 text-[color:var(--state-success)]" aria-hidden /> What works
            on this device right now
          </h3>
          <p className="text-xs text-muted-foreground">{runnableSummary}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{RUNTIME_REALITY}</p>
        </GlassPanel>

        {/* Genuinely runs here — plan, execute, verify, receipt. */}
        <DataWorkbench />

        {/* Extracted so both can be render-tested; see their own files. */}
        <CriteriaScorecard registry={registry} />
        <BenchmarkPanel />

        {/* Check a specific app before relying on it */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4" aria-hidden /> Check an application
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Find out what OCADE knows about a specific program before you rely on it.
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Excel, Blender, SolidWorks"
            aria-label="Application name to check"
            className="h-9 text-sm"
          />
          {lookup ? (
            <p className="mt-2 rounded-lg border border-border/60 bg-secondary/25 p-3 text-xs text-muted-foreground">
              {describeAppLookup(registry, lookup)}
            </p>
          ) : null}
        </GlassPanel>

        {/* Categories OCADE genuinely operates */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 text-sm font-semibold">OCADE can operate these</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Tested adapters that drive the software itself.
          </p>
          <ul className="flex flex-col gap-2">
            {driven.map((row) => (
              <li key={row.category} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <Check
                    className="h-4 w-4 shrink-0 text-[color:var(--state-success)]"
                    aria-hidden
                  />
                  <span className="text-[13px] font-medium">{row.label}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {row.testedCapabilities} tested{" "}
                    {row.testedCapabilities === 1 ? "action" : "actions"}
                  </span>
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {registry.byCategory(row.category).flatMap((p) =>
                    p.capabilities.map((c) => (
                      <li
                        key={`${p.appId}:${c.id}`}
                        title={`${c.label} — via ${describeMethod(c.methods[0])}`}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px]",
                          c.tested
                            ? "bg-secondary text-muted-foreground"
                            : "bg-secondary/50 text-muted-foreground/60",
                        )}
                      >
                        {c.label}
                      </li>
                    )),
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </GlassPanel>

        {/*
          The honest middle ground, and the one most easily mis-sold. OCADE can
          read a GeoJSON file; it cannot open SolidWorks. Each row shows the
          pack's OWN statement of what it can't do, verbatim — a green tick
          beside "CAD" with no qualification would be a false claim.
        */}
        {formatOnly.length > 0 ? (
          <GlassPanel className="p-4">
            <h3 className="mb-1 text-sm font-semibold">
              OCADE can work with these files, but not run the software
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">
              It reads, checks and reports on the file formats these tools export. Driving the
              applications themselves needs adapters OCADE doesn't have.
            </p>
            <ul className="flex flex-col gap-2">
              {formatOnly.map((row) => (
                <li key={row.category} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-[13px] font-medium">{row.label}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {row.testedCapabilities} tested{" "}
                      {row.testedCapabilities === 1 ? "action" : "actions"}
                    </span>
                  </div>
                  <ul className="mt-1.5 flex flex-wrap gap-1">
                    {registry.byCategory(row.category).flatMap((p) =>
                      p.capabilities.map((c) => (
                        <li
                          key={`${p.appId}:${c.id}`}
                          title={`${c.label} — via ${describeMethod(c.methods[0])}`}
                          className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {c.label}
                        </li>
                      )),
                    )}
                  </ul>
                  {/* The pack's own words about its limits. */}
                  {row.limits.map((limit) => (
                    <p key={limit} className="mt-1.5 text-[11px] text-muted-foreground">
                      {limit}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </GlassPanel>
        ) : null}

        {/*
          Deliberately listed, not hidden. A missing row reads as "fine" to
          someone scanning the page, and they need to know before they rely on
          OCADE for that kind of work.
        */}
        {unsupported.length > 0 ? (
          <GlassPanel className="p-4">
            <h3 className="mb-1 text-sm font-semibold">Not supported yet</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              OCADE has no tested skill pack for these. It will say so rather than guess, and can
              inspect an individual app once with your approval.
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {unsupported.map((row) => (
                <li
                  key={row.category}
                  className="flex items-center gap-2 text-[12px] text-muted-foreground"
                >
                  <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {row.label}
                </li>
              ))}
            </ul>
          </GlassPanel>
        ) : null}

        {/* Learned maps */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 text-sm font-semibold">Apps OCADE has learned</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Inspecting an app once makes later tasks fast. OCADE re-checks automatically whenever
            the app's version, layout or language changes. These maps describe menus and controls
            only — never your documents or what you typed.
          </p>
          <p className="mb-2 rounded-lg border border-border/60 bg-secondary/25 p-3 text-xs text-muted-foreground">
            {UNKNOWN_APP_LEARNING_REALITY}
          </p>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Runtime status labels:{" "}
            {UNKNOWN_APP_SUPPORT_LABELS.filter((label) =>
              [
                "PROBED_AND_REHEARSED",
                "PERMISSION_REQUIRED",
                "APPLICATION_REQUIRED",
                "FAILED_VERIFICATION",
              ].includes(label),
            ).join(" · ")}
          </p>
          {maps.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing learned yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {maps.map((m) => (
                <li
                  key={m.appId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3 text-[13px]"
                >
                  <span className="font-medium">{m.displayName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {m.version ?? "version not reported"} · {m.controls.length} controls · used{" "}
                    {m.uses} {m.uses === 1 ? "time" : "times"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => {
                      if (!forgetAppMap(m.appId)) {
                        toast.error(
                          `${m.displayName} could not be forgotten because storage is unavailable.`,
                        );
                        return;
                      }
                      setMaps(listAppMaps());
                      toast.success(
                        `${m.displayName} forgotten. OCADE will inspect it again next time.`,
                      );
                    }}
                  >
                    Forget
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        {/* How OCADE chooses to act */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4" aria-hidden /> How OCADE decides to act
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            OCADE always takes the most reliable route available. Screen reading with a simulated
            mouse is the last resort, because it's the only method that can't confirm what it's
            about to click.
          </p>
          <ol className="flex flex-col gap-1 text-xs text-muted-foreground">
            {CONTROL_PREFERENCE.map((m, i) => (
              <li key={m} className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] tabular-nums">
                  {i + 1}
                </span>
                <span className="capitalize">{describeMethod(m)}</span>
              </li>
            ))}
          </ol>
        </GlassPanel>
      </div>
    </>
  );
}
