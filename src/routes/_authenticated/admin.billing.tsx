import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, Receipt, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OcadeDataTable, type OcadeTableColumn } from "@/components/ui/ocade-data-table";
import { useSession } from "@/lib/session";
import { requireAdminRole } from "@/lib/admin/route-gate";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import {
  BILLING_LIMITS,
  GRANT_MAX_DAYS,
  grantRequestProblem,
  loadGrants,
  loadInvoices,
  loadPaymentEvents,
  loadSeats,
  loadSubscriptions,
  type GrantRow,
  type InvoiceRow,
  type PaymentEventRow,
  type SeatRow,
  type SubscriptionRow,
} from "@/lib/admin/billing";
import { useFormatters, type Formatters } from "@/lib/locale/use-formatters";

/**
 * BILLING — the money half of PLAN.md §G, and the surface §H's grants act on.
 *
 * WHY THIS COULD NOT BE BUILT UNTIL NOW. The deployment carried two
 * subscription tables written by two different paths, and an operator screen
 * that picked one of them would have been asserting an answer to the question
 * Phase 19 exists to settle. There is one authority now: the provider webhook
 * writes `subscriptions`, this reads it, and the entitlement resolver reads the
 * same row to decide a tier. Nothing on this screen can disagree with what a
 * customer is actually entitled to, because there is no longer a second place
 * for the answer to live.
 *
 * A GRANT IS NEVER A PAYMENT, AND THE SCREEN SAYS SO IN ITS LAYOUT. Audited
 * entitlement grants are their own panel, their own table and their own verb.
 * There is no control anywhere on this page that writes a subscription row or
 * an invoice: an operator who could do that could manufacture a record that
 * looks like money arriving, which is a lie to accounting, to the customer and
 * to whoever reads the row next year.
 *
 * WHAT THE DATABASE ENFORCES, NOT THIS FILE. The grant function requires the
 * support-admin role, a recent second factor, a written reason of at least ten
 * characters, a window of between one and {@link GRANT_MAX_DAYS} days, and a
 * target that is not the account granting it. The form below checks the same
 * things so a person is told before a round trip — and would be refused anyway
 * if it did not.
 *
 * THE MUTATION TARGET IS AN IMMUTABLE AUTH USER ID. An email may LOCATE an
 * account and the lookup below is exactly that; the grant is made against the
 * id, because an email can be changed and re-registered while the id cannot.
 *
 * LIVE CHARGING IS STILL DISABLED. This reads the record of payments and shows
 * it; it does not open a checkout, take money, or issue a refund. Those stay
 * behind the provider, tax and legal gates `PLAN.md` holds them behind.
 */
export const Route = createFileRoute("/_authenticated/admin/billing")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Billing — CARCC CADANE Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireAdminRole("the billing console"),
  component: AdminBillingPage,
});

/*
 * Declared out here so each array identity is stable across renders: the table
 * infers a column's sort kind from the values it holds, and a fresh array every
 * render would redo that on every keystroke in the search box. They take the
 * formatters as an argument because a module-scope column cannot use a hook,
 * and a date formatted without one is formatted in whatever the browser is set
 * to rather than the locale the reader chose.
 */
function subscriptionColumns(formatters: Formatters): readonly OcadeTableColumn<SubscriptionRow>[] {
  return [
    { key: "userId", label: "Account", required: true, value: (row) => row.userId },
    {
      key: "planName",
      label: "Plan",
      value: (row) => row.planName ?? "",
      // A price from a retired catalogue has no plan today. "—" says that; a
      // guessed tier would say something false about what somebody bought.
      render: (row) => row.planName ?? "—",
    },
    {
      key: "tier",
      label: "Tier",
      value: (row) => row.tier ?? "",
      render: (row) => row.tier ?? "—",
    },
    { key: "status", label: "Status", value: (row) => row.status },
    {
      key: "currentPeriodEnd",
      label: "Period ends",
      sort: "date",
      value: (row) => row.currentPeriodEnd ?? "",
      render: (row) => (row.currentPeriodEnd ? formatters.dateTime(row.currentPeriodEnd) : "—"),
    },
    {
      key: "cancelAtPeriodEnd",
      label: "Cancelling",
      value: (row) => (row.cancelAtPeriodEnd ? "yes" : "no"),
    },
    { key: "environment", label: "Environment", value: (row) => row.environment },
    {
      key: "providerSubscriptionId",
      label: "Provider id",
      value: (row) => row.providerSubscriptionId,
    },
  ];
}

function grantColumns(formatters: Formatters): readonly OcadeTableColumn<GrantRow>[] {
  return [
    { key: "userId", label: "Account", required: true, value: (row) => row.userId },
    { key: "tier", label: "Tier", value: (row) => row.tier },
    {
      key: "active",
      label: "State",
      value: (row) => (row.revokedAt ? "revoked" : row.active ? "active" : "ended"),
    },
    { key: "reason", label: "Reason", value: (row) => row.reason },
    {
      key: "startsAt",
      label: "From",
      sort: "date",
      value: (row) => row.startsAt,
      render: (row) => formatters.dateTime(row.startsAt),
    },
    {
      key: "endsAt",
      label: "Until",
      sort: "date",
      value: (row) => row.endsAt,
      render: (row) => formatters.dateTime(row.endsAt),
    },
    { key: "grantedBy", label: "Granted by", value: (row) => row.grantedBy },
    {
      key: "revokedAt",
      label: "Revoked",
      sort: "date",
      value: (row) => row.revokedAt ?? "",
      render: (row) => (row.revokedAt ? formatters.dateTime(row.revokedAt) : "—"),
    },
  ];
}

function paymentColumns(formatters: Formatters): readonly OcadeTableColumn<PaymentEventRow>[] {
  return [
    { key: "userId", label: "Account", required: true, value: (row) => row.userId },
    { key: "provider", label: "Provider", value: (row) => row.provider },
    { key: "kind", label: "Kind", value: (row) => row.kind },
    { key: "status", label: "Status", value: (row) => row.status },
    {
      key: "amountMinor",
      label: "Amount",
      sort: "number",
      value: (row) => row.amountMinor,
      // Stored in minor units so no amount is ever a floating-point billing
      // value; converted once, here, where it is read rather than compared.
      render: (row) => formatters.money(row.amountMinor / 100, row.currency),
    },
    {
      key: "occurredAt",
      label: "When",
      sort: "date",
      value: (row) => row.occurredAt,
      render: (row) => formatters.dateTime(row.occurredAt),
    },
  ];
}

function invoiceColumns(formatters: Formatters): readonly OcadeTableColumn<InvoiceRow>[] {
  return [
    { key: "invoiceNumber", label: "Invoice", required: true, value: (row) => row.invoiceNumber },
    { key: "userId", label: "Account", value: (row) => row.userId },
    { key: "planId", label: "Plan", value: (row) => row.planId },
    {
      key: "amountMinor",
      label: "Amount",
      sort: "number",
      value: (row) => row.amountMinor,
      render: (row) => formatters.money(row.amountMinor / 100, row.currency),
    },
    {
      key: "taxMinor",
      label: "Tax",
      sort: "number",
      value: (row) => row.taxMinor,
      render: (row) => formatters.money(row.taxMinor / 100, row.currency),
    },
    { key: "status", label: "Status", value: (row) => row.status },
    {
      key: "issuedAt",
      label: "Issued",
      sort: "date",
      value: (row) => row.issuedAt,
      render: (row) => formatters.dateTime(row.issuedAt),
    },
  ];
}

function seatColumns(formatters: Formatters): readonly OcadeTableColumn<SeatRow>[] {
  return [
    {
      key: "organizationName",
      label: "Organization",
      required: true,
      value: (row) => row.organizationName,
    },
    { key: "seats", label: "Seats", sort: "number", value: (row) => row.seats },
    { key: "admins", label: "Admins", sort: "number", value: (row) => row.admins },
    { key: "pendingInvites", label: "Invited", sort: "number", value: (row) => row.pendingInvites },
    {
      key: "createdAt",
      label: "Created",
      sort: "date",
      value: (row) => row.createdAt,
      render: (row) => formatters.date(row.createdAt),
    },
  ];
}

function Truncated({ what, cap }: { what: string; cap: number }) {
  return (
    <p className="mt-2 text-xs text-[color:var(--state-warning)]">
      More {what} exist than one page shows. This covers the most recent {cap}.
    </p>
  );
}

function AdminBillingPage() {
  const { user } = useSession();
  const formatters = useFormatters();
  const queryClient = useQueryClient();

  const subscriptionTable = useMemo(() => subscriptionColumns(formatters), [formatters]);
  const grantTable = useMemo(() => grantColumns(formatters), [formatters]);
  const paymentTable = useMemo(() => paymentColumns(formatters), [formatters]);
  const invoiceTable = useMemo(() => invoiceColumns(formatters), [formatters]);
  const seatTable = useMemo(() => seatColumns(formatters), [formatters]);

  const subscriptions = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: loadSubscriptions,
  });
  const grants = useQuery({ queryKey: ["admin", "entitlement-grants"], queryFn: loadGrants });
  const payments = useQuery({ queryKey: ["admin", "payment-events"], queryFn: loadPaymentEvents });
  const invoices = useQuery({ queryKey: ["admin", "invoices"], queryFn: loadInvoices });
  const seats = useQuery({ queryKey: ["admin", "seats"], queryFn: loadSeats });

  return (
    <AppShell>
      <PageHeader
        eyebrow="CARCC CADANE"
        title="Billing"
        description="Subscriptions the provider wrote, the payments behind them, seats per organization, and every entitlement OCADE gave by hand."
      />

      <GlassPanel className="mt-6 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
          Provider subscriptions
          <span className="text-xs text-muted-foreground">
            ({subscriptions.data?.rows.length ?? 0})
          </span>
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Written only by the signature-verified provider webhook. This screen reads them; nothing
          here can create or edit one.
        </p>
        <OcadeDataTable<SubscriptionRow>
          caption="Provider subscriptions"
          tableId="admin-subscriptions"
          preferenceScope={user?.id ?? "device"}
          columns={subscriptionTable}
          rows={subscriptions.data?.rows ?? []}
          loading={subscriptions.isLoading}
          error={
            subscriptions.error
              ? "Subscriptions could not be read. Your admin role may have changed."
              : null
          }
          onRetry={() => void subscriptions.refetch()}
          searchPlaceholder="Account, plan or provider id"
          emptyMessage="No subscription matches that search."
          defaultPageSize={25}
          freezeFirstColumn
          exportFileName="ocade-subscriptions"
        />
        {subscriptions.data?.truncated ? (
          <Truncated what="subscriptions" cap={BILLING_LIMITS.subscriptions} />
        ) : null}
      </GlassPanel>

      <GrantPanel
        rows={grants.data?.rows ?? []}
        columns={grantTable}
        loading={grants.isLoading}
        failed={Boolean(grants.error)}
        truncated={Boolean(grants.data?.truncated)}
        scope={user?.id ?? "device"}
        onChanged={async () => {
          await queryClient.invalidateQueries({ queryKey: ["admin", "entitlement-grants"] });
        }}
        onRetry={() => void grants.refetch()}
      />

      <GlassPanel className="mt-4 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
          Payment events
          <span className="text-xs text-muted-foreground">({payments.data?.rows.length ?? 0})</span>
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          What the provider reported and when, including refunds and disputes. Card, UPI and PayPal
          credentials are never stored, so there are none to show.
        </p>
        <OcadeDataTable<PaymentEventRow>
          caption="Payment events"
          tableId="admin-payment-events"
          preferenceScope={user?.id ?? "device"}
          columns={paymentTable}
          rows={payments.data?.rows ?? []}
          loading={payments.isLoading}
          error={
            payments.error
              ? "Payment events could not be read. Your admin role may have changed."
              : null
          }
          onRetry={() => void payments.refetch()}
          searchPlaceholder="Account, provider or status"
          emptyMessage="No payment event matches that search."
          defaultPageSize={25}
          freezeFirstColumn
          exportFileName="ocade-payment-events"
          filters={[
            {
              id: "kind",
              label: "Kind",
              options: [
                { value: "payment", label: "Payment" },
                { value: "renewal", label: "Renewal" },
                { value: "refund", label: "Refund" },
                { value: "dispute", label: "Dispute" },
                { value: "failure", label: "Failure" },
              ],
              test: (row, value) => row.kind === value,
            },
          ]}
        />
        {payments.data?.truncated ? (
          <Truncated what="payment events" cap={BILLING_LIMITS.paymentEvents} />
        ) : null}
      </GlassPanel>

      <GlassPanel className="mt-4 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
          Invoices
          <span className="text-xs text-muted-foreground">({invoices.data?.rows.length ?? 0})</span>
        </h2>
        <OcadeDataTable<InvoiceRow>
          caption="Invoices"
          tableId="admin-invoices"
          preferenceScope={user?.id ?? "device"}
          columns={invoiceTable}
          rows={invoices.data?.rows ?? []}
          loading={invoices.isLoading}
          error={
            invoices.error ? "Invoices could not be read. Your admin role may have changed." : null
          }
          onRetry={() => void invoices.refetch()}
          searchPlaceholder="Invoice, account or plan"
          emptyMessage="No invoice matches that search."
          defaultPageSize={25}
          freezeFirstColumn
          exportFileName="ocade-invoices"
        />
        {invoices.data?.truncated ? (
          <Truncated what="invoices" cap={BILLING_LIMITS.invoices} />
        ) : null}
      </GlassPanel>

      <GlassPanel className="mt-4 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
          Seats per organization
          <span className="text-xs text-muted-foreground">({seats.data?.rows.length ?? 0})</span>
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Counts only. Who is in a workspace is that workspace&rsquo;s business, and no
          administrator role can read its membership rows.
        </p>
        <OcadeDataTable<SeatRow>
          caption="Seats per organization"
          tableId="admin-seats"
          preferenceScope={user?.id ?? "device"}
          columns={seatTable}
          rows={seats.data?.rows ?? []}
          loading={seats.isLoading}
          error={seats.error ? "Seats could not be read. Your admin role may have changed." : null}
          onRetry={() => void seats.refetch()}
          searchPlaceholder="Organization"
          emptyMessage="No organization matches that search."
          defaultPageSize={25}
          freezeFirstColumn
          exportFileName="ocade-seats"
        />
        {seats.data?.truncated ? (
          <Truncated what="organizations" cap={BILLING_LIMITS.seats} />
        ) : null}
      </GlassPanel>
    </AppShell>
  );
}

/**
 * Audited entitlement grants, and the only place one is ever made.
 *
 * Separated from the payment panels deliberately: a support decision shown
 * among payments reads as one, and the whole point of a grant is that it is
 * recorded as the thing it actually is.
 */
function GrantPanel({
  rows,
  columns,
  loading,
  failed,
  truncated,
  scope,
  onChanged,
  onRetry,
}: {
  rows: GrantRow[];
  columns: readonly OcadeTableColumn<GrantRow>[];
  loading: boolean;
  failed: boolean;
  truncated: boolean;
  scope: string;
  onChanged: () => Promise<void>;
  onRetry: () => void;
}) {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [foundLabel, setFoundLabel] = useState<string | null>(null);
  const [tier, setTier] = useState<"pro" | "max">("pro");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);

  /**
   * Find the account an email currently belongs to.
   *
   * The id it returns is what the grant is made against. An email is a label
   * that can be changed and re-registered; the id cannot, so resolving once and
   * granting against the result is the difference between giving access to a
   * person and giving it to whoever holds an address today.
   */
  async function locateAccount() {
    const wanted = email.trim().toLowerCase();
    if (!wanted) return;
    setBusy(true);
    try {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .eq("email", wanted)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setUserId("");
        setFoundLabel(null);
        toast.error("No account has that email address.");
        return;
      }
      setUserId(data.id);
      setFoundLabel(`${data.display_name ?? "Account"} — ${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The account could not be looked up.");
    } finally {
      setBusy(false);
    }
  }

  async function grant() {
    const request = { userId, tier, reason: reason.trim(), days };
    const problem = grantRequestProblem(request);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const supabase = await loadSupabaseClient();
      const { error } = await supabase.rpc("ocade_grant_entitlement", {
        target_user: request.userId,
        grant_tier: request.tier,
        grant_reason: request.reason,
        days: request.days,
      });
      if (error) {
        /*
         * The database refuses without the role, without a recent second
         * factor, and when an admin names their own account. Its message is the
         * one worth passing on verbatim rather than rewording into something
         * vaguer than what actually happened.
         */
        toast.error(error.message);
        return;
      }
      toast.success("Entitlement granted. It is recorded with your account and your reason.");
      setReason("");
      setEmail("");
      setUserId("");
      setFoundLabel(null);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(row: GrantRow) {
    const why = window.prompt("Why is this grant being revoked? This is recorded.")?.trim();
    if (!why) return;
    setBusy(true);
    try {
      const supabase = await loadSupabaseClient();
      const { error } = await supabase.rpc("ocade_revoke_entitlement", {
        grant_id: row.id,
        revoke_reason: why,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Grant revoked. The record of it stays.");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassPanel className="mt-4 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        Entitlement grants
        <span className="text-xs text-muted-foreground">({rows.length})</span>
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        An entitlement OCADE decided to give — never a payment, and never written into the
        subscription record. It needs a recent second factor, a written reason and an end date, it
        cannot be given to the account giving it, and revoking one keeps the record that it existed.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="grant-email">Find the account by email</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            <Input
              id="grant-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="person@example.com"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={busy || !email.trim()}
              onClick={() => void locateAccount()}
            >
              Find account
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {foundLabel
              ? `Granting to ${foundLabel}`
              : "The grant is made against the account's permanent id, not its email address."}
          </p>
        </div>

        <div>
          <Label htmlFor="grant-tier">Tier</Label>
          <select
            id="grant-tier"
            className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={tier}
            onChange={(event) => setTier(event.target.value === "max" ? "max" : "pro")}
          >
            <option value="pro">Pro</option>
            <option value="max">Max</option>
          </select>
        </div>

        <div>
          <Label htmlFor="grant-days">Days</Label>
          <Input
            id="grant-days"
            type="number"
            min={1}
            max={GRANT_MAX_DAYS}
            value={days}
            onChange={(event) => setDays(Number.parseInt(event.target.value, 10) || 0)}
            className="mt-1"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="grant-reason">Reason</Label>
          <Textarea
            id="grant-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why this account is being given paid access, in a sentence somebody could read back in a year."
            className="mt-1"
            rows={2}
          />
        </div>

        <div className="sm:col-span-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={busy || !userId}
            onClick={() => void grant()}
          >
            Grant entitlement
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <OcadeDataTable<GrantRow>
          caption="Entitlement grants"
          tableId="admin-entitlement-grants"
          preferenceScope={scope}
          columns={columns}
          rows={rows}
          loading={loading}
          error={failed ? "Grants could not be read. Your admin role may have changed." : null}
          onRetry={onRetry}
          searchPlaceholder="Account, tier or reason"
          emptyMessage="No grant matches that search."
          defaultPageSize={25}
          freezeFirstColumn
          exportFileName="ocade-entitlement-grants"
          rowActions={(row) => [
            {
              label: "Revoke",
              run: () => void revoke(row),
              destructive: true,
              // A revoked grant stays in the list as the record it is; offering
              // to revoke it again would be a control that does nothing.
              disabled: Boolean(row.revokedAt) || busy,
            },
          ]}
        />
        {truncated ? <Truncated what="grants" cap={BILLING_LIMITS.grants} /> : null}
      </div>
    </GlassPanel>
  );
}
