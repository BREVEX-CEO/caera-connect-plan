import { useQuery } from "@tanstack/react-query";
import { Download, FileText, ReceiptText } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

function money(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}
export function BillingHistory() {
  const history = useQuery({
    queryKey: ["billing-history", "mine"],
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const [payments, invoices] = await Promise.all([
        supabase
          .from("ocade_payment_events")
          .select("id, provider, kind, status, amount_minor, currency, occurred_at, plan_id")
          .order("occurred_at", { ascending: false })
          .limit(28),
        supabase
          .from("ocade_invoices")
          .select(
            "id, invoice_number, status, amount_minor, tax_minor, currency, issued_at, receipt_url",
          )
          .order("issued_at", { ascending: false })
          .limit(28),
      ]);
      if (payments.error) throw payments.error;
      if (invoices.error) throw invoices.error;
      return { payments: payments.data ?? [], invoices: invoices.data ?? [] };
    },
    retry: false,
  });

  return (
    <GlassPanel className="p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ReceiptText className="h-4 w-4" aria-hidden /> Payments and invoices
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Provider references, status, totals and your receipt copy appear here. OCADE never stores
        full card or UPI credentials.
      </p>

      {history.isError ? (
        <p className="mt-3 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
          Billing history is prepared but its production database migration is not available in this
          environment yet. Live charging is disabled.
        </p>
      ) : null}

      {history.data ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment history
            </h4>
            <div className="mt-2 space-y-2">
              {history.data.payments.map((event) => (
                <article key={event.id} className="rounded-lg border border-border/60 p-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-foreground">
                      {money(Number(event.amount_minor), event.currency)}
                    </span>
                    <span>{event.status}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {event.provider} · {event.kind} · {event.plan_id} ·{` `}
                    {new Date(event.occurred_at).toLocaleString()}
                  </p>
                </article>
              ))}
              {history.data.payments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                  No payments yet.
                </p>
              ) : null}
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Invoice copies
            </h4>
            <div className="mt-2 space-y-2">
              {history.data.invoices.map((invoice) => (
                <article
                  key={invoice.id}
                  className="rounded-lg border border-border/60 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <FileText className="h-3.5 w-3.5" /> {invoice.invoice_number}
                    </span>
                    {invoice.receipt_url ? (
                      <a
                        href={invoice.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Copy
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {money(Number(invoice.amount_minor), invoice.currency)} · tax{` `}
                    {money(Number(invoice.tax_minor), invoice.currency)} · {invoice.status} ·{` `}
                    {new Date(invoice.issued_at).toLocaleDateString()}
                  </p>
                </article>
              ))}
              {history.data.invoices.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                  No invoices yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </GlassPanel>
  );
}
