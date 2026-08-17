import { useCallback, useEffect, useMemo, useState } from "react";
import { redirect } from "@tanstack/react-router";
import { FREE_LAUNCH_MODE } from "@/lib/launch-mode";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/settings/PaymentTestModeBanner";
import { useSession } from "@/lib/session";
import { getPaddleEnvironment, isCheckoutConfigured } from "@/lib/paddle";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import {
  SELLABLE_PLANS,
  describeSellablePlan,
  sellablePlanByPriceId,
} from "@/lib/payments/paddle-plans";
import { PaymentMethodsPanel } from "@/components/settings/PaymentMethodsPanel";
import { UpiSetupBanner } from "@/components/settings/UpiSetupBanner";
import type { UpiReadiness } from "@/lib/payments/upi-readiness";
import { getUpiReadiness } from "@/utils/payments-readiness.functions";
import { currencyForRegion, detectRegion, type CurrencyCode } from "@/lib/payments/pricing";
import {
  getMySubscription,
  createBillingPortalSession,
  cancelMySubscription,
  type SubscriptionRecord,
} from "@/utils/payments.functions";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  /* Billing is disabled during free launch; usage remains visible. The page itself is kept, unreachable, so
     re-enabling billing is a flag change rather than a rebuild. */
  beforeLoad: () => {
    if (FREE_LAUNCH_MODE) throw redirect({ to: "/settings/usage" });
  },
  head: () => ({
    meta: [
      { title: "Billing and subscription — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

/** Statuses that still grant access, in the words a customer would use. */
function describeStatus(sub: SubscriptionRecord): { label: string; tone: string; detail: string } {
  const ends = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const endsText = ends ? ends.toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

  switch (sub.status) {
    case "trialing":
      return { label: "Trial", tone: "text-primary", detail: `Trial runs until ${endsText}.` };
    case "active":
      return {
        label: "Active",
        tone: "text-[color:var(--state-success,theme(colors.emerald.400))]",
        detail: sub.cancelAtPeriodEnd
          ? `Cancelled. Access continues until ${endsText}, then it will not renew.`
          : `Renews on ${endsText}.`,
      };
    case "past_due":
      return {
        label: "Payment failed",
        tone: "text-[color:var(--state-warning)]",
        detail:
          "The last payment did not go through. The provider will retry — update your payment method to avoid losing access.",
      };
    case "paused":
      return { label: "Paused", tone: "text-muted-foreground", detail: "Billing is paused." };
    case "canceled":
      return {
        label: "Cancelled",
        tone: "text-muted-foreground",
        detail:
          ends && ends.getTime() > Date.now()
            ? `Access continues until ${endsText} — you keep the time you paid for.`
            : "This subscription has ended.",
      };
    default:
      return {
        label: sub.status,
        tone: "text-muted-foreground",
        detail: `Period ends ${endsText}.`,
      };
  }
}

function BillingPage() {
  const { user } = useSession();
  const environment = getPaddleEnvironment();
  const { openCheckout, loading: checkoutLoading, error: checkoutError } = usePaddleCheckout();

  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /*
   * Prices are shown in the currency the buyer will actually be charged in.
   * That is not cosmetic: UPI only appears at checkout for a buyer in India
   * paying in rupees, so a dollar figure here followed by a rupee charge would
   * both surprise the customer and hide the method they were looking for.
   * Detected on the client, because the region is a browser fact.
   */
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  useEffect(() => {
    setCurrency(currencyForRegion(detectRegion()));
  }, []);

  /*
   * Whether UPI can appear is three separate questions — buyer region, account
   * approval and catalogue currency — and the answer decides both the banner
   * and the methods panel. It is resolved server-side against the provider so
   * the page states a checked fact rather than a hopeful assumption.
   */
  const [upi, setUpi] = useState<UpiReadiness | null>(null);
  const [upiLoading, setUpiLoading] = useState(true);
  const [upiError, setUpiError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUpiLoading(true);
    getUpiReadiness({ data: { environment, currency } })
      .then((result) => {
        if (!cancelled) setUpi(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setUpiError(e instanceof Error ? e.message : "check failed");
      })
      .finally(() => {
        if (!cancelled) setUpiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [environment, currency]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const record = await getMySubscription({ data: { environment } });
      setSubscription(record);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your billing details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentPlan = useMemo(
    () => (subscription ? sellablePlanByPriceId(subscription.priceId) : undefined),
    [subscription],
  );

  const openPortal = async () => {
    setBusy("portal");
    setNotice(null);
    try {
      const { url } = await createBillingPortalSession();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The billing portal could not be opened.");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    const confirmed = window.confirm(
      "Cancel this subscription? You keep access until the end of the period you have already paid for, and it will not renew after that.",
    );
    if (!confirmed) return;
    setBusy("cancel");
    setNotice(null);
    try {
      await cancelMySubscription();
      setNotice(
        "Cancellation requested. Access continues until the end of the paid period; the confirmed state appears here once the provider confirms it.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The subscription could not be cancelled.");
    } finally {
      setBusy(null);
    }
  };

  const buy = (priceId: string) =>
    void openCheckout({
      priceId,
      userId: user?.id ?? "",
      customerEmail: user?.email ?? undefined,
      successUrl: `${window.location.origin}/checkout/success`,
    });

  const canCancel =
    subscription &&
    !subscription.cancelAtPeriodEnd &&
    ["active", "trialing", "past_due", "paused"].includes(subscription.status) &&
    currentPlan?.cadence !== "one-time";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Subscription"
        title="Billing"
        description="Your current plan, what happens next, and how to change or cancel it."
        actions={
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw
              className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
              aria-hidden
            />
            Refresh
          </Button>
        }
      />

      <PaymentTestModeBanner />

      <UpiSetupBanner readiness={upi} />

      {!isCheckoutConfigured() ? (
        <GlassPanel className="p-4 text-sm text-muted-foreground">
          Checkout is not configured on this deployment, so no plan can be bought here yet.
        </GlassPanel>
      ) : null}

      {error ? (
        <GlassPanel className="border-destructive/40 p-3 text-xs text-destructive">
          {error}
        </GlassPanel>
      ) : null}
      {checkoutError ? (
        <GlassPanel className="border-destructive/40 p-3 text-xs text-destructive">
          {checkoutError}
        </GlassPanel>
      ) : null}
      {notice ? (
        <GlassPanel className="p-3 text-xs text-muted-foreground">{notice}</GlassPanel>
      ) : null}

      <GlassPanel className="p-4" data-testid="current-plan">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="h-4 w-4" aria-hidden />
          Current plan
        </h2>

        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Checking your account…
          </p>
        ) : !subscription ? (
          <p className="text-xs text-muted-foreground">
            No paid plan on this account. Choose one below — you will be taken to the payment
            provider, and this page updates once the purchase is confirmed.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">{currentPlan?.planId ?? subscription.productId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className={`font-medium ${describeStatus(subscription).tone}`}>
                  {describeStatus(subscription).label}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Billing</dt>
                <dd>{currentPlan?.cadence ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Environment</dt>
                <dd>{subscription.environment === "sandbox" ? "Test" : "Live"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              {describeStatus(subscription).detail}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void openPortal()}
                disabled={busy !== null}
              >
                {busy === "portal" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                )}
                Manage payment and invoices
              </Button>
              {canCancel ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void cancel()}
                  disabled={busy !== null}
                >
                  {busy === "cancel" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                  Cancel subscription
                </Button>
              ) : null}
            </div>
          </>
        )}
      </GlassPanel>

      <GlassPanel className="p-4">
        <h2 className="mb-1 text-sm font-semibold">
          {subscription ? "Change plan" : "Choose a plan"}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Prices are shown and charged by the payment provider, which acts as merchant of record and
          handles tax for your country.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {SELLABLE_PLANS.map((plan) => {
            const described = describeSellablePlan(plan, currency);
            const isCurrent = subscription?.priceId === plan.priceId;
            return (
              <article
                key={plan.priceId}
                className="flex flex-col rounded-lg border border-border/60 bg-black/15 p-3"
              >
                <h3 className="text-sm font-semibold text-foreground">{described.name}</h3>
                <p className="mt-0.5 text-lg font-semibold">{described.price}</p>
                <p className="mt-1 text-xs text-muted-foreground">{described.summary}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{plan.cadenceNote}</p>
                <Button
                  size="sm"
                  className="mt-3"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || checkoutLoading || !isCheckoutConfigured() || !user}
                  onClick={() => buy(plan.priceId)}
                >
                  {isCurrent
                    ? "Current plan"
                    : checkoutLoading
                      ? "Opening…"
                      : "Continue to payment"}
                </Button>
              </article>
            );
          })}
        </div>
      </GlassPanel>

      <PaymentMethodsPanel readiness={upi} loading={upiLoading} error={upiError} />
    </div>
  );
}
