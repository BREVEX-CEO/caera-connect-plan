import { useEffect, useMemo, useState } from "react";
import { FREE_PLAN_NOTICE } from "@/lib/payments/checkout-availability";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gauge, HardDrive, MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { classifyUnavailable } from "@/lib/unavailable-reason";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/use-online";
import { useLocalEngine } from "@/lib/use-local-engine";
import {
  entitlementState,
  offlineEntitlementValid,
  OFFLINE_GRACE_DAYS,
  type Entitlement,
} from "@/lib/ocade-allowance";
import { getEntitlement } from "@/lib/ocade-usage.functions";
import { PlanComparison } from "@/components/settings/PlanComparison";
import { BillingHistory } from "@/components/settings/BillingHistory";
import { ActivityAllowance } from "@/components/settings/ActivityAllowance";
import { CommercialUsagePanel } from "@/components/settings/CommercialUsagePanel";

export const Route = createFileRoute("/_authenticated/settings/usage")({
  head: () => ({
    meta: [{ title: "Usage and plan — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: UsagePage,
});

function UsagePage() {
  const online = useOnline();
  const local = useLocalEngine();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [lastVerified, setLastVerified] = useState<Date | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const ent = await getEntitlement();
        if (!live) return;
        setLastVerified(new Date());
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

  const ent = useMemo(() => entitlementState(entitlement), [entitlement]);
  const graceOk = lastVerified ? offlineEntitlementValid(lastVerified) : true;

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Usage and plan"
        description="One account-wide allowance covers successful AI work in Chat, Cowork and Code, wherever it runs."
      />

      <div className="flex flex-col gap-5">
        <CommercialUsagePanel />

        {/* Customer-visible plans and verified billing evidence only. */}
        <PlanComparison currentPlan={entitlement?.planId ?? null} />
        <BillingHistory />

        {/* Model readiness is separate from the account-wide usage gate. */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <HardDrive className="h-4 w-4" aria-hidden /> Offline Intelligence
          </h3>
          <p className="text-xs text-muted-foreground">
            {local.status === "ready"
              ? `${local.models.length} on-device engine${local.models.length === 1 ? " is" : "s are"} ready. Successful AI work uses the same account allowance as online work.`
              : "Offline Intelligence is not ready yet. Preparing it does not use your AI allowance."}
          </p>
        </GlassPanel>

        {/* Plan.
            A plan grid, an "expired" badge and a "paused until renewal" list
            are all payment-gating surfaces. Until a checkout exists on this
            deployment, showing them would describe a restriction that does not
            apply to anybody using it. */}
        <GlassPanel className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4" aria-hidden /> Plan
          </h3>
          <p className="text-xs text-muted-foreground">{FREE_PLAN_NOTICE}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Generation stays on your device. It still counts towards your allowance: the allowance
            is one pool across everything OCADE does, wherever it runs.
          </p>
        </GlassPanel>

        {/* Device safety budgets are operational guards, not paid capacity. */}
        <ActivityAllowance />

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
