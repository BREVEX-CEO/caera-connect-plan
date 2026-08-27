import { Activity, Wifi, WifiOff } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { DiagnosticsPanel } from "@/components/ocade/DiagnosticsPanel";
import { useLocalEngine } from "@/lib/use-local-engine";
import { useDevicePolicy } from "@/lib/use-device-policy";
import { useOnline } from "@/lib/use-online";
import { routeTask, PerfLedger } from "@/lib/local/router-policy";
import { ErrorJournalPanel } from "./ErrorJournalPanel";

/**
 * Advanced diagnostics.
 *
 * Answers the question people actually arrive with: "why did it do that?".
 *
 * The routing receipt below is not a description of how selection works — it
 * is the real `routeTask` decision for this machine, right now, including every
 * model it rejected and the reason. If OCADE picked a smaller engine than
 * expected, the reason is on this page in the engine's own words.
 *
 * This is also the one ordinary surface where raw model identifiers appear.
 * That is deliberate: a diagnostic that hides the identifier it is diagnosing
 * is not a diagnostic.
 */

/** A fresh ledger: this page reports the DECLARED route, not chat's history. */
const previewLedger = new PerfLedger();

export function DiagnosticsSettingsPanel() {
  const engine = useLocalEngine();
  const device = useDevicePolicy();
  const online = useOnline();

  const generalRoute = routeTask("general", engine.models, previewLedger, device.policy);
  const visionRoute = routeTask("vision", engine.models, previewLedger, device.policy);

  return (
    <>
      <PageHeader
        eyebrow="Application"
        title="Diagnostics"
        description="Live engine state, the routing decision for this machine with its reasons, and error triage."
        actions={
          online ? (
            <StatusBadge status="connected">
              <Wifi className="mr-1 inline h-3 w-3" />
              Online
            </StatusBadge>
          ) : (
            <StatusBadge status="paused">
              <WifiOff className="mr-1 inline h-3 w-3" />
              Offline
            </StatusBadge>
          )
        }
      />

      <div className="grid gap-5 pb-16">
        {/*
          FIRST, because it is what people arrive with. The routing receipt
          below answers "why did it choose that engine"; this answers "what
          went wrong yesterday", which is the question that brings somebody to
          a diagnostics screen in the first place.
        */}
        <ErrorJournalPanel />
        <GlassPanel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Local engine</h2>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge
                status={
                  engine.status === "ready"
                    ? "running"
                    : engine.status === "checking"
                      ? "pending"
                      : "disconnected"
                }
              >
                {engine.status}
              </StatusBadge>
              <Button size="sm" variant="outline" onClick={() => engine.refresh(true)}>
                Re-probe
              </Button>
            </div>
          </div>
          <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Reachable</dt>
              <dd className="text-foreground">{engine.reachable ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Runtime version</dt>
              <dd className="text-foreground">{engine.version ?? "unknown"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Models installed</dt>
              <dd className="text-foreground">{engine.models.length}</dd>
            </div>
          </dl>
          {engine.reason ? (
            <p className="mt-2 text-[13px] text-muted-foreground">{engine.reason}</p>
          ) : null}
          <p className="mt-3 text-[12px] text-muted-foreground">
            Device measurement:{" "}
            {device.measured
              ? `measured on this machine — ${device.profile?.totalRamGib} GB memory, ${
                  device.profile?.hasDiscreteGpu
                    ? "dedicated graphics"
                    : device.profile?.gpuCertain
                      ? "no dedicated graphics"
                      : "graphics unconfirmed"
                }`
              : (device.problem ?? "running on a browser estimate")}
          </p>
        </GlassPanel>

        {(
          [
            ["Ordinary conversation", generalRoute],
            ["Image questions", visionRoute],
          ] as const
        ).map(([label, route]) => (
          <GlassPanel key={label} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">{label}</h2>
              <StatusBadge status={route.ok ? "active" : "failed"}>
                {route.ok ? route.receipt.basis.replace("_", " ") : "no engine"}
              </StatusBadge>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {route.ok ? (
                <>
                  Would use <span className="font-mono text-foreground">{route.model.id}</span> (
                  {route.model.label}).
                </>
              ) : (
                (route.receipt.refusal ?? "No engine could serve this task.")
              )}
            </p>
            {route.receipt.rejected.length > 0 ? (
              <>
                <div className="mt-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Rejected, with reasons
                </div>
                <ul className="mt-1 space-y-1 text-[13px] text-muted-foreground">
                  {route.receipt.rejected.map((entry) => (
                    <li key={`${entry.modelId}:${entry.why}`}>
                      <span className="font-mono text-foreground">{entry.modelId}</span> —{" "}
                      {entry.why}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </GlassPanel>
        ))}

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Error triage</h2>
          <DiagnosticsPanel />
        </div>
      </div>
    </>
  );
}
