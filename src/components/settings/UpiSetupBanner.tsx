/**
 * A single plain-language line at the top of billing when UPI cannot appear.
 *
 * It says one thing, and it says whose problem it is. Operator faults are
 * phrased as our work, not the customer's; region ineligibility is phrased as
 * a fact about the method, not a failure of anything.
 */
import { AlertTriangle, Info } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { summariseUpiReadiness, type UpiReadiness } from "@/lib/payments/upi-readiness";

export function UpiSetupBanner({ readiness }: { readiness: UpiReadiness | null }) {
  if (!readiness) return null;
  const summary = summariseUpiReadiness(readiness);
  if (!summary) return null;

  const operatorFault = readiness.state === "setup_required";

  return (
    <GlassPanel
      data-testid="upi-setup-banner"
      data-state={readiness.state}
      className={
        operatorFault
          ? "flex items-start gap-2 border-[color:var(--state-warning-line-strong)] p-3 text-xs"
          : "flex items-start gap-2 p-3 text-xs text-muted-foreground"
      }
    >
      {operatorFault ? (
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-warning)]"
          aria-hidden
        />
      ) : (
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span>
        <span className="font-medium text-foreground">
          {operatorFault ? "Setup required: UPI is not available yet. " : "About UPI. "}
        </span>
        {operatorFault
          ? "UPI payments are switched off until our payment account setup is finished. Cards and PayPal are unaffected."
          : summary}
      </span>
    </GlassPanel>
  );
}
