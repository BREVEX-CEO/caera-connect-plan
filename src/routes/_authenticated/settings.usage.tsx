import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gauge, Cloud, HardDrive, MonitorSmartphone, Clock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/use-online";
import { useLocalEngine } from "@/lib/use-local-engine";
import {
  PLANS,
  CLOUD_ALLOWANCE,
  WINDOW_HOURS,
  allowanceState,
  entitlementState,
  describeAllowance,
  offlineEntitlementValid,
  OFFLINE_GRACE_DAYS,
  type Entitlement,
} from "@/lib/ocade-allowance";
import { getCloudUsage, getEntitlement } from "@/lib/ocade-usage.functions";
import { BillingPanel } from "@/components/settings/BillingPanel";

export const Route = createFileRoute("/_authenticated/settings/usage")({
  head: () => ({
    meta: [{ title: "Usage and plan — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: UsagePage,
});

function UsagePage() {
  const online = useOnline();
  const local = useLocalEngine();
  const [used, setUsed] = useState<number | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [lastVerified, setLastVerified] = useState<Date | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const [usage, ent] = await Promise.all([getCloudUsage(), getEntitlement()]);
        if (!live) return;
        setUsed(usage.usedInWindow);
        setLastVerified(usage.verifiedAt ? new Date(usage.verifiedAt) : new Date());
        setEntitlement(
          ent
            ? {
                planId: ent.planId,
                startedAt: new Date(ent.startedAt),
                expiresAt: ent.expiresAt ? new Date(ent.expiresAt) : undefined,
              }
            : null,
        );
      } catch (e) {
        if (!live) return;
        setUnavailable(
          e instanceof Error ? e.message : "Usage isn't available until the database is set up.",
        );
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const state = useMemo(() => allowanceState(used ?? 0), [used]);
  const ent = useMemo(() => entitlementState(entitlement), [entitlement]);
  const graceOk = lastVerified ? offlineEntitlementValid(lastVerified) : true;
  const pct = Math.round((state.used / state.limit) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Usage and plan"
        description="OCADE Local is unlimited. Only OCADE Cloud draws from your allowance."
      />

      <div className="flex flex-col gap-5">
        {/* Subscription, entitlement and the payment provider twin. */}
        <BillingPanel />

        {/* Cloud allowance */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Cloud className="h-4 w-4" aria-hidden /> OCADE Cloud allowance
          </h3>
          {unavailable ? (
            <p className="text-xs text-muted-foreground">
              Live usage needs the database migration. The allowance rules below are already active
              in the app: {CLOUD_ALLOWANCE} cloud requests every {WINDOW_HOURS} hours.
            </p>
          ) : used === null ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading usage…
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{describeAllowance(state)}</p>
              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuenow={state.used}
                aria-valuemin={0}
                aria-valuemax={state.limit}
                aria-label="Cloud allowance used"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    state.exhausted ? "bg-[color:var(--state-warning)]" : "bg-foreground/70",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{state.remaining}</span> of{" "}
                  {state.limit} left
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Resets{" "}
                  {state.resetsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {state.exhausted ? (
                <p className="mt-3 rounded-md bg-secondary/60 px-3 py-2 text-xs">
                  Cloud allowance is used up for this window.{" "}
                  {local.status === "ready" ? (
                    <>
                      <span className="font-medium text-foreground">OCADE Local is ready</span> and
                      stays unlimited — keep working on-device.
                    </>
                  ) : (
                    <>
                      Install an on-device engine to keep working without the cloud, or wait for the
                      reset.{" "}
                      <Link to="/ocade/models" className="underline">
                        Set up OCADE Local
                      </Link>
                    </>
                  )}
                </p>
              ) : null}
            </>
          )}
        </GlassPanel>

        {/* Local — always unlimited */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <HardDrive className="h-4 w-4" aria-hidden /> OCADE Local
          </h3>
          <p className="text-xs text-muted-foreground">
            Unlimited and never metered.{" "}
            {local.status === "ready"
              ? `${local.models.length} on-device engine${local.models.length === 1 ? "" : "s"} ready.`
              : "No on-device engine detected yet."}
          </p>
        </GlassPanel>

        {/* Plan */}
        <GlassPanel className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4" aria-hidden /> Plan
          </h3>
          {entitlement ? (
            <p className="text-xs text-muted-foreground">
              {PLANS[entitlement.planId].label} plan ·{" "}
              {ent.active ? (
                <>active until {ent.expiresAt.toLocaleDateString()}</>
              ) : (
                <span className="text-[color:var(--state-warning)]">expired</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No active plan.</p>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.values(PLANS).map((p) => (
              <div
                key={p.id}
                className={cn(
                  "rounded-lg border p-3 text-xs",
                  entitlement?.planId === p.id
                    ? "border-foreground/40 bg-sidebar-accent/40"
                    : "border-border/60",
                )}
              >
                <p className="text-sm font-medium text-foreground">{p.label}</p>
                <p className="mt-1 text-muted-foreground">
                  {p.cloudAllowancePerWindow} cloud uses / {WINDOW_HOURS}h · {p.desktopDevices}{" "}
                  desktop + {p.mobileDevices} mobile devices
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Every plan includes the same features and device limits — they differ only in length.
            Pricing and checkout are not part of this build.
          </p>
        </GlassPanel>

        {/* After expiry — explicit guarantees */}
        <GlassPanel className="p-4">
          <h3 className="mb-2 text-sm font-semibold">If your plan lapses</h3>
          <ul className="flex flex-col gap-1 text-xs">
            {[
              ["Your local data stays accessible", ent.localDataAvailable],
              ["On-device inference keeps working", ent.localInferenceAvailable],
              ["Exports keep working", ent.localExportAvailable],
              ["OCADE Cloud", ent.cloudAvailable],
              ["Premium platform services", ent.premiumAvailable],
            ].map(([label, ok]) => (
              <li key={String(label)} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    ok ? "bg-[color:var(--state-success)]" : "bg-muted-foreground/50",
                  )}
                />
                <span className={ok ? "text-foreground" : "text-muted-foreground"}>
                  {label}
                  {ok ? "" : " — paused until renewal"}
                </span>
              </li>
            ))}
          </ul>
        </GlassPanel>

        {/* Devices + offline entitlement */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <MonitorSmartphone className="h-4 w-4" aria-hidden /> Devices
          </h3>
          <p className="text-xs text-muted-foreground">
            {ent.desktopDevices} desktop and {ent.mobileDevices} mobile devices per account.{" "}
            <Link to="/settings/devices" className="underline">
              Manage devices
            </Link>
          </p>
          {!online ? (
            <p className="mt-2 text-xs text-muted-foreground">
              You're offline.{" "}
              {graceOk
                ? `Your plan stays valid offline for up to ${OFFLINE_GRACE_DAYS} days after the last check.`
                : "Offline grace has run out — reconnect to re-verify your plan. Local features keep working."}
            </p>
          ) : null}
        </GlassPanel>

        {unavailable ? (
          <SetupRequiredState
            title="Live usage needs the database migration"
            description={`${unavailable} The migration, RLS, rollback and verification SQL are prepared and ready to apply.`}
          />
        ) : null}
      </div>
    </>
  );
}
