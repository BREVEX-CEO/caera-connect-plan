import { useEffect, useState } from "react";
import { redirect } from "@tanstack/react-router";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { getPaddleEnvironment, isCheckoutConfigured } from "@/lib/paddle";
import { getMySubscription, type SubscriptionRecord } from "@/utils/payments.functions";

export const Route = createFileRoute("/checkout/success")({
  /*
   * A deployment that cannot take a payment cannot have produced one, so there
   * is nothing here to confirm and arriving is a stale or forged link. It
   * redirects rather than rendering a confirmation shell — a page that says
   * "checking your purchase" for a purchase that cannot exist is the beginning
   * of a false claim.
   */
  beforeLoad: () => {
    if (!isCheckoutConfigured()) throw redirect({ to: "/ocade" });
  },
  head: () => ({
    meta: [
      { title: "Purchase confirmed — CARCC CADANE" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Confirmation of your CARCC CADANE plan purchase." },
    ],
  }),
  component: CheckoutSuccessPage,
});

/**
 * Confirms a purchase from the SERVER's record, not from the fact that the
 * browser arrived here.
 *
 * Anyone can open this URL. The only trustworthy signal that money moved is a
 * subscription row written by the signature-verified webhook, so this page
 * polls for that row and says plainly when it has not appeared yet rather than
 * congratulating someone who has not paid.
 */
function CheckoutSuccessPage() {
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [state, setState] = useState<"checking" | "confirmed" | "pending" | "error">("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const environment = getPaddleEnvironment();
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const record = await getMySubscription({ data: { environment } });
        if (!live) return;
        if (record) {
          setSubscription(record);
          setState("confirmed");
          return;
        }
        // Webhook delivery is asynchronous; a short wait is normal.
        if (Date.now() - startedAt < 30_000) {
          setTimeout(() => void poll(), 2000);
        } else {
          setState("pending");
        }
      } catch (e) {
        if (!live) return;
        setState("error");
        setMessage(
          e instanceof Error ? e.message : "Your purchase state could not be checked right now.",
        );
      }
    };

    void poll();
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <GlassPanel className="w-full p-6">
        {state === "checking" ? (
          <>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Confirming your purchase
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We are waiting for the payment provider to confirm the payment. This usually takes a
              few seconds. You can safely leave this page — your plan will be applied either way.
            </p>
          </>
        ) : null}

        {state === "confirmed" && subscription ? (
          <>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
              Purchase confirmed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your plan is active on this account
              {subscription.currentPeriodEnd
                ? ` until ${new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}`
                : ""}
              .{" "}
              {subscription.environment === "sandbox"
                ? "This was a test purchase — no money was charged."
                : ""}
            </p>
          </>
        ) : null}

        {state === "pending" ? (
          <>
            <h1 className="text-lg font-semibold">Payment received, plan not applied yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The confirmation from the payment provider has not reached us yet. Nothing is lost:
              once it arrives, the plan appears in Billing automatically. If it is still missing in
              an hour, contact support with the email you paid with.
            </p>
          </>
        ) : null}

        {state === "error" ? (
          <>
            <h1 className="text-lg font-semibold">We could not check your purchase</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button asChild size="sm">
            <Link to="/settings/billing">Go to billing</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/ocade">Open OCADE</Link>
          </Button>
        </div>
      </GlassPanel>
    </main>
  );
}
