import { useEffect, useMemo, useState } from "react";
import { FREE_LAUNCH_NOTICE } from "@/lib/launch-mode";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gauge, Cloud, HardDrive, MonitorSmartphone, Clock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { classifyUnavailable } from "@/lib/unavailable-reason";
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
import { PlanComparison } from "@/components/settings/PlanComparison";
import { BillingHistory } from "@/components/settings/BillingHistory";

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

  const state = useMemo(
    () =>
      allowanceState(
        used ?? 0,
        new Date(),
        entitlement ? PLANS[entitlement.planId].cloudAllowancePerWindow : CLOUD_ALLOWANCE,
      ),
    [entitlement, used],
  );
  const ent = useMemo(() => entitlementState(entitlement), [entitlement]);
  const graceOk = lastVerified ? offlineEntitlementValid(lastVerified) : true;
  const pct = Math.round((state.used / state.limit) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Usage and plan"
        description="OCADE runs on this device. Nothing you ask it is metered."
      />

      <div className="flex flex-col gap-5">
        {/* Customer-visible plans and verified billing evidence only. */}
        <PlanComparison currentPlan={entitlement?.planId ?? null} />
        <BillingHistory />

        {/*
          THE CLOUD ALLOWANCE PANEL STOOD HERE.
          It showed a progress bar of "OCADE Cloud requests used", a reset
          time, and an "allowance is used up" state offering to install a
          local engine instead. None of it can happen: there is no cloud
          engine, nothing consumes an allowance, and the bar could only ever
          read zero. A meter that can only show zero, next to a plan that
          implies you might buy more of it, is a promise of a product that
          does not exist.
        */}
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

        {/* Plan — withdrawn during free launch.
            A plan grid, an "expired" badge and a "paused until renewal" list
            are all payment-gating surfaces. Nothing is for sale, so showing
            them would describe a restriction that does not exist. */}
        <GlassPanel className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4" aria-hidden /> Plan
          </h3>
          <p className="text-xs text-muted-foreground">{FREE_LAUNCH_NOTICE}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            The cloud allowance shown above is a rate limit on a metered upstream service, not a
            paywall. OCADE Local stays unlimited either way.
          </p>
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

        {unavailable
          ? (() => {
              const state = classifyUnavailable(unavailable, {
                migrationTitle: "Live usage needs the database migration",
                migrationNote:
                  "The migration, RLS, rollback and verification SQL are prepared and ready to apply.",
                loadTitle: "Live usage couldn't be loaded",
              });
              return (
                <SetupRequiredState
                  title={state.title}
                  description={state.description}
                  detail={state.detail}
                  status={state.migrationMissing ? "setup_required" : "failed"}
                />
              );
            })()
          : null}
      </div>
    </>
  );
}
