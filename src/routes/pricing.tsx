import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, ShieldCheck, Smartphone } from "lucide-react";
import { z } from "zod";
import { PublicPage, PublicSection, Notice } from "@/components/public/PublicPage";
import { PlanComparison } from "@/components/settings/PlanComparison";
import { CHECKOUT_UNAVAILABLE_NOTICE } from "@/lib/payments/checkout-availability";
import { PAYMENT_METHODS } from "@/lib/payments/methods";
import { billingHandoffMessage } from "@/lib/payments/browser-handoff";

const searchSchema = z.object({
  source: z.enum(["web", "desktop", "mobile"]).optional(),
  plan: z.enum(["std_8d", "month_1m", "year_1y"]).optional(),
});

export const Route = createFileRoute("/pricing")({
  /* Prices are public so people can understand what each plan costs before
     signing in. This route never receives an `onChoose` callback: buying
     happens in Settings, against an authenticated account, so a purchase can be
     attributed to somebody. */
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "OCADE pricing — India and international plans" },
      {
        name: "description",
        content:
          "OCADE Free, Pro and Max pricing in INR and international currencies, on weekly and monthly cadences.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const search = Route.useSearch();
  const handoff = billingHandoffMessage(search.source);

  return (
    <PublicPage
      eyebrow="Pricing"
      title="Free to start. Pay only for more capacity."
      summary="Free is a real account plan with a fixed allowance. Pro and Max raise that allowance and are charged weekly or monthly. Your local data, exports and on-device features remain available whichever plan you are on, and when a paid period ends."
    >
      {/*
        The eyebrow said "Pre-launch pricing", the title offered "the time you
        need" and the summary described "three fixed-duration plans" — all of
        which described the retired catalogue of fixed-length passes. What is
        sold now is capacity on a renewing cadence, and Free is a plan rather
        than a countdown to one.
      */}
      <Notice>{CHECKOUT_UNAVAILABLE_NOTICE}</Notice>

      {handoff ? (
        <div
          role="status"
          className="rounded-xl border border-primary/30 bg-primary/8 p-4 text-sm leading-relaxed text-foreground/85"
        >
          <strong className="text-foreground">Secure browser handoff.</strong> {handoff}
        </div>
      ) : null}

      <PlanComparison deploymentDetails={false} />

      <PublicSection title="Planned payment methods">
        <div className="grid gap-3 sm:grid-cols-3">
          {PAYMENT_METHODS.map((method) => (
            <article key={method.id} className="rounded-xl border border-border/60 bg-black/15 p-4">
              {method.id === "upi" ? (
                <Smartphone className="h-5 w-5 text-primary" aria-hidden />
              ) : method.id === "card" ? (
                <CreditCard className="h-5 w-5 text-primary" aria-hidden />
              ) : (
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              )}
              <h3 className="mt-3 font-semibold text-foreground">{method.label}</h3>
              <p className="mt-1 text-xs">{method.markets}</p>
              <p className="mt-2 text-xs">{method.disclosure}</p>
            </article>
          ))}
        </div>
        <p>
          Payment approval always stays on the provider&apos;s hosted surface. OCADE will retain the
          minimum billing record needed for entitlement, invoices, refunds and support—not full card
          details, UPI credentials, PayPal passwords or one-time codes.
        </p>
      </PublicSection>

      <PublicSection title="Purchase rules">
        <p>
          Each purchase grants 8 days, 30 days or 1 year of access. It is non-recurring unless a
          future checkout clearly offers renewal and the customer separately chooses it. The exact
          currency, taxes, total, provider, cancellation and refund terms must be visible before the
          final payment confirmation.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
