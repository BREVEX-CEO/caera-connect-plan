import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, ShieldCheck, Smartphone } from "lucide-react";
import { z } from "zod";
import { PublicPage, PublicSection, Notice } from "@/components/public/PublicPage";
import { PlanComparison } from "@/components/settings/PlanComparison";
import { PAYMENT_METHODS } from "@/lib/payments/methods";
import { billingHandoffMessage } from "@/lib/payments/browser-handoff";

const searchSchema = z.object({
  source: z.enum(["web", "desktop", "mobile"]).optional(),
  plan: z.enum(["std_8d", "month_1m", "year_1y"]).optional(),
});

export const Route = createFileRoute("/pricing")({
  /* Prices stay public during FREE LAUNCH so people can understand the future
     product clearly. This route never receives an onChoose callback, while the
     server-side billing authority remains disabled in launch-mode.ts. */
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "OCADE pricing — India and international plans" },
      {
        name: "description",
        content:
          "Pre-launch OCADE plan pricing in INR and international currencies, with planned UPI, card and PayPal checkout.",
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
      eyebrow="Pre-launch pricing"
      title="Choose the time you need"
      summary="Three fixed-duration OCADE plans. Your local data, exports and supported on-device features remain available when a paid term ends. Live checkout is not enabled yet."
    >
      <Notice>
        OCADE is free while it launches, and these plans are here so you can see what is coming.
        Checkout is not open — nothing on this page can charge you.
      </Notice>

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
