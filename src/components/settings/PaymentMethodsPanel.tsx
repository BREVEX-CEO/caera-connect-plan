/**
 * What a customer can pay with here, and the exact reason anything is missing.
 *
 * The panel distinguishes two states that look the same from outside but have
 * nothing in common: a method that is correctly configured yet simply not
 * offered where this buyer lives, and a method that is unavailable because the
 * operator's provider account or catalogue is not ready. Merging them would
 * either blame the customer for an operator problem or hide an operator
 * problem behind geography.
 */
import { AlertTriangle, Globe2, Loader2, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { PAYMENT_METHODS } from "@/lib/payments/methods";
import {
  UPI_REASON_COPY,
  UPI_TOGGLE_IS_NOT_MACHINE_VERIFIABLE,
  type UpiReadiness,
} from "@/lib/payments/upi-readiness";

interface Props {
  readiness: UpiReadiness | null;
  loading: boolean;
  error: string | null;
}

export function PaymentMethodsPanel({ readiness, loading, error }: Props) {
  const upiState = readiness?.state ?? null;

  return (
    <GlassPanel className="p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Payment methods
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Which methods appear depends on your country and the provider&apos;s checkout. Approval
        always happens on the provider&apos;s surface — OCADE never sees a card number, a UPI PIN or
        a PayPal password.
      </p>

      <ul className="grid gap-2 sm:grid-cols-3">
        {PAYMENT_METHODS.map((method) => {
          const isUpi = method.id === "upi";
          const unavailable = isUpi && upiState !== null && upiState !== "available";
          return (
            <li
              key={method.id}
              data-testid={`payment-method-${method.id}`}
              data-state={isUpi ? (upiState ?? "unknown") : "available"}
              className={
                unavailable
                  ? "rounded-lg border border-border/60 bg-black/20 p-3 opacity-70"
                  : "rounded-lg border border-border/60 p-3"
              }
            >
              <p className="text-xs font-medium text-foreground">{method.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{method.markets}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{method.disclosure}</p>

              {isUpi && loading ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Checking whether UPI can be offered to you…
                </p>
              ) : null}

              {isUpi && !loading && upiState === "region_not_eligible" ? (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Globe2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium text-foreground">Not shown for your region. </span>
                    {UPI_REASON_COPY.region_not_eligible.body}
                  </span>
                </p>
              ) : null}

              {isUpi && !loading && upiState === "setup_required" ? (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[color:var(--state-warning)]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium">Temporarily unavailable. </span>
                    This is on our side, not yours — UPI is switched off until our payment account
                    setup is finished. Cards and PayPal still work.
                  </span>
                </p>
              ) : null}

              {isUpi && !loading && upiState === "available" ? (
                <p className="mt-2 text-[11px] text-[color:var(--state-success,theme(colors.emerald.400))]">
                  Offered at checkout in rupees, including UPI AutoPay for renewals.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          The UPI availability check could not run ({error}), so the note above may be out of date.
        </p>
      ) : null}

      <p className="mt-3 text-[11px] text-muted-foreground">
        {UPI_TOGGLE_IS_NOT_MACHINE_VERIFIABLE}
      </p>
    </GlassPanel>
  );
}
