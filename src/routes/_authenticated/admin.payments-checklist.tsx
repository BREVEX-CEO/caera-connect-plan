/**
 * Internal end-to-end payments verification, in the test environment.
 *
 * Admin only. The steps are run against the real provider and this app's real
 * records — no step reports success because the code path exists. The one step
 * a machine cannot prove (UPI actually being offered in the checkout) is shown
 * as a manual action with a button that opens the real test checkout.
 */
import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink, FlaskConical, Loader2, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { PayoutSetupGuide } from "@/components/settings/PayoutSetupGuide";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { getPaddleEnvironment, isCheckoutConfigured } from "@/lib/paddle";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { SELLABLE_PLANS } from "@/lib/payments/paddle-plans";
import {
  CHECKLIST_STEPS,
  outcomeLabel,
  outcomeTone,
  type ChecklistRun,
  type ChecklistStepResult,
} from "@/lib/payments/checklist";
import {
  runPaymentsChecklist,
  fastForwardTestRenewal,
} from "@/utils/payments-readiness.functions";

export const Route = createFileRoute("/_authenticated/admin/payments-checklist")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Payments test checklist — CAERA CADANE Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!data)
      throw redirect({
        to: "/access-denied",
        search: {
          area: "the payments test checklist",
          reason: "This area requires the admin role on your CAERA CADANE account.",
        },
      });
  },
  component: PaymentsChecklistPage,
});

function PaymentsChecklistPage() {
  const { user } = useSession();
  const environment = getPaddleEnvironment();
  const { openCheckout, loading: checkoutLoading, error: checkoutError } = usePaddleCheckout();

  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const execute = async () => {
    setBusy("run");
    setError(null);
    try {
      setRun(await runPaymentsChecklist({ data: { environment } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The checklist could not be run.");
    } finally {
      setBusy(null);
    }
  };

  const renew = async () => {
    setBusy("renew");
    setError(null);
    setNotice(null);
    try {
      const result = await fastForwardTestRenewal({ data: { environment } });
      setNotice(
        `Next billing moved to ${new Date(result.nextBilledAt).toLocaleTimeString()} for ${result.subscriptionId}. The renewal runs shortly after that — re-run the checklist then to confirm the new state reached this app.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The renewal could not be fast-forwarded.");
    } finally {
      setBusy(null);
    }
  };

  const monthly = SELLABLE_PLANS.find((p) => p.cadence === "monthly") ?? SELLABLE_PLANS[0]!;

  const resultFor = (id: string): ChecklistStepResult | undefined =>
    run?.results.find((r) => r.id === id);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Internal"
        title="Payments test checklist"
        description="Verifies UPI checkout, webhook signature handling and renewal state changes end to end against the payment provider."
        actions={
          <Button size="sm" onClick={() => void execute()} disabled={busy !== null}>
            {busy === "run" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" aria-hidden />
            )}
            Run checks
          </Button>
        }
      />

      <PayoutSetupGuide />



      <GlassPanel className="flex items-start gap-2 p-3 text-xs text-muted-foreground">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          This page is running against the{" "}
          <span className="font-medium text-foreground">
            {environment === "sandbox" ? "test" : "live"}
          </span>{" "}
          environment. Fast-forwarding a renewal is refused outside test mode, because the same
          action against live money would bill a real customer early.
        </span>
      </GlassPanel>

      {error ? (
        <GlassPanel className="border-destructive/40 p-3 text-xs text-destructive">{error}</GlassPanel>
      ) : null}
      {checkoutError ? (
        <GlassPanel className="border-destructive/40 p-3 text-xs text-destructive">
          {checkoutError}
        </GlassPanel>
      ) : null}
      {notice ? (
        <GlassPanel className="p-3 text-xs text-muted-foreground">{notice}</GlassPanel>
      ) : null}

      <ol className="space-y-2">
        {CHECKLIST_STEPS.map((step, index) => {
          const result = resultFor(step.id);
          const outcome = result?.outcome ?? (step.requiresHuman ? "manual" : "unknown");
          return (
            <li key={step.id}>
              <GlassPanel className="p-4" data-testid={`checklist-${step.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {index + 1}. {step.title}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{step.proves}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-medium ${outcomeTone(outcome)}`}>
                    {outcomeLabel(outcome)}
                  </span>
                </div>

                {result?.detail ? (
                  <p className="mt-2 text-xs text-muted-foreground">{result.detail}</p>
                ) : null}

                {result?.evidence ? (
                  <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                    {Object.entries(result.evidence).map(([key, value]) => (
                      <div key={key} className="flex gap-1.5">
                        <dt className="text-foreground/70">{key}</dt>
                        <dd className="truncate">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {step.id === "upi_checkout" ? (
                  <div className="mt-3 space-y-2">
                    <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      Open the checkout, confirm a UPI option is listed, and complete it with a test
                      method. If UPI is missing while prices are in rupees, the provider&apos;s own
                      UPI setting is off or the account is not approved.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checkoutLoading || !isCheckoutConfigured() || !user}
                      onClick={() =>
                        void openCheckout({
                          priceId: monthly.priceId,
                          userId: user?.id ?? "",
                          customerEmail: user?.email ?? undefined,
                          successUrl: `${window.location.origin}/checkout/success`,
                        })
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Open test checkout
                    </Button>
                  </div>
                ) : null}

                {step.id === "renewal_autopay" ? (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null || environment !== "sandbox"}
                      onClick={() => void renew()}
                    >
                      {busy === "renew" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : null}
                      Fast-forward next renewal
                    </Button>
                  </div>
                ) : null}
              </GlassPanel>
            </li>
          );
        })}
      </ol>

      {run ? (
        <p className="text-[11px] text-muted-foreground">
          Last run {new Date(run.ranAt).toLocaleString()} against the{" "}
          {run.environment === "sandbox" ? "test" : "live"} environment.
        </p>
      ) : null}
    </div>
  );
}
