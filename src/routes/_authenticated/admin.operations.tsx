import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, BellRing, Gauge, ScrollText } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { OcadeDataTable, type OcadeTableColumn } from "@/components/ui/ocade-data-table";
import { useSession } from "@/lib/session";
import { requireAdminRole } from "@/lib/admin/route-gate";
import {
  attentionCount,
  loadAuditEvents,
  loadNotificationDelivery,
  loadUsageWindows,
  OPERATIONS_LIMITS,
  type AuditEventRow,
  type DeliveryRow,
  type UsageWindowRow,
} from "@/lib/admin/operations";
import { useFormatters, type Formatters } from "@/lib/locale/use-formatters";

/**
 * OPERATIONS — the usage, audit and delivery half of PLAN.md §G.
 *
 * THREE QUESTIONS AN OPERATOR ACTUALLY ASKS, and nothing else. How much of the
 * allowance is being spent and when do the windows turn over; what has been
 * done to organizations and by whom; is notification delivery working. Each is
 * a table because each is a list somebody needs to sort, filter and take away
 * with them — and the canonical table gives all three of those without any of
 * it being written here.
 *
 * THE EXPORTS ARE EXACTLY WHAT THE SERVER HANDED OVER. Every row came back
 * through row-level security under this administrator's own token, so a CSV
 * cannot contain anything they could not already read on screen. That is the
 * whole of §G's "authorized exports": the authorisation is the read, and the
 * export is a copy of it.
 *
 * WHAT IS DELIBERATELY NOT HERE. §G also asks for a billing and seat overview
 * and for payment-event state. The deployment currently carries TWO
 * subscription tables written by two different paths — `subscriptions`, which
 * the provider webhook writes, and `ocade_subscriptions`, which the entitlement
 * resolver reads — and an operator screen that picked one of them would be
 * asserting an answer to the question the payments work exists to settle. It is
 * recorded in the execution state and held with that work rather than guessed
 * at here, because a billing screen that is confidently wrong is worse than one
 * that does not exist yet.
 *
 * NOTIFICATION DELIVERY IS COUNTS. Answering "is email working?" from raw rows
 * would put every title and body in the deployment in front of an operator, and
 * the database has no admin policy that would let it: the aggregate is the only
 * way in, and it returns categories and states, never anything anybody wrote.
 */
export const Route = createFileRoute("/_authenticated/admin/operations")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Operations — CARCC CADANE Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireAdminRole("the operations console"),
  component: AdminOperationsPage,
});

/*
 * Declared out here so the array identity is stable across renders: the table
 * infers each column's sort kind from the values it holds, and a fresh array
 * every render would redo that on every keystroke in the search box.
 *
 * THE DATE COLUMNS TAKE THE FORMATTERS RATHER THAN CALLING `toLocaleString()`.
 * A column defined at module scope cannot use a hook, which is precisely how
 * three admin tables ended up formatting dates in whatever the browser was set
 * to instead of the locale the person chose. They are built once per locale by
 * `useMemo` in the component below.
 */
function usageColumns(formatters: Formatters): readonly OcadeTableColumn<UsageWindowRow>[] {
  return [
    { key: "userId", label: "Account", required: true, value: (row) => row.userId },
    { key: "windowKind", label: "Window", value: (row) => row.windowKind },
    {
      key: "windowStart",
      label: "Opened",
      sort: "date",
      value: (row) => row.windowStart,
      render: (row) => formatters.dateTime(row.windowStart),
    },
    {
      key: "used",
      label: "Spent",
      sort: "number",
      value: (row) => row.used,
      // Two decimals because the ledger keeps hundredths, and rounding to whole
      // numbers here would show a spent window as untouched.
      render: (row) => row.used.toFixed(2),
    },
    {
      key: "updatedAt",
      label: "Last spent",
      sort: "date",
      value: (row) => row.updatedAt,
      render: (row) => formatters.dateTime(row.updatedAt),
    },
  ];
}

function auditColumns(formatters: Formatters): readonly OcadeTableColumn<AuditEventRow>[] {
  return [
    {
      key: "organizationName",
      label: "Organization",
      required: true,
      value: (row) => row.organizationName ?? "",
      render: (row) => row.organizationName ?? "—",
    },
    { key: "event", label: "Event", value: (row) => row.event },
    {
      key: "createdAt",
      label: "When",
      sort: "date",
      value: (row) => row.createdAt,
      render: (row) => formatters.dateTime(row.createdAt),
    },
    { key: "actorId", label: "Actor", value: (row) => row.actorId ?? "" },
    { key: "subjectId", label: "About", value: (row) => row.subjectId ?? "" },
  ];
}

function deliveryColumns(formatters: Formatters): readonly OcadeTableColumn<DeliveryRow>[] {
  return [
    { key: "category", label: "Category", required: true, value: (row) => row.category },
    { key: "channel", label: "Channel", value: (row) => row.channel },
    { key: "state", label: "State", value: (row) => row.state },
    { key: "occurrences", label: "Count", sort: "number", value: (row) => row.occurrences },
  ];
}

function Truncated({ what, cap }: { what: string; cap: number }) {
  return (
    <p className="mt-2 text-xs text-[color:var(--state-warning)]">
      More {what} exist than one page shows. This covers the most recent {cap}.
    </p>
  );
}

function AdminOperationsPage() {
  const { user } = useSession();
  const formatters = useFormatters();

  /*
   * Rebuilt only when the locale changes, so the table still sees a stable
   * array identity between renders and does not re-infer its sort kinds on
   * every keystroke in the search box.
   */
  const usageTable = useMemo(() => usageColumns(formatters), [formatters]);
  const auditTable = useMemo(() => auditColumns(formatters), [formatters]);
  const deliveryTable = useMemo(() => deliveryColumns(formatters), [formatters]);

  const usage = useQuery({ queryKey: ["admin", "usage-windows"], queryFn: loadUsageWindows });
  const audit = useQuery({ queryKey: ["admin", "audit-events"], queryFn: loadAuditEvents });
  const delivery = useQuery({
    queryKey: ["admin", "notification-delivery"],
    queryFn: () => loadNotificationDelivery(),
  });

  const needsAttention = attentionCount(delivery.data?.rows ?? []);

  return (
    <AppShell>
      <PageHeader
        eyebrow="CARCC CADANE"
        title="Operations"
        description="Allowance windows, what has been done to organizations, and whether notifications are arriving."
      />

      <GlassPanel className="mt-6 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden />
          Commercial usage windows
          <span className="text-xs text-muted-foreground">({usage.data?.rows.length ?? 0})</span>
        </h2>
        <OcadeDataTable<UsageWindowRow>
          caption="Commercial usage windows"
          tableId="admin-usage-windows"
          preferenceScope={user?.id ?? "device"}
          columns={usageTable}
          rows={usage.data?.rows ?? []}
          loading={usage.isLoading}
          error={
            usage.error
              ? "Usage windows could not be read. Your admin role may have changed."
              : null
          }
          onRetry={() => void usage.refetch()}
          searchPlaceholder="Account or window"
          emptyMessage="No usage window matches that search."
          defaultPageSize={25}
          freezeFirstColumn
          exportFileName="ocade-usage-windows"
          filters={[
            {
              id: "kind",
              label: "Window",
              options: [
                { value: "session", label: "Session" },
                { value: "week", label: "Week" },
              ],
              test: (row, value) => row.windowKind === value,
            },
          ]}
        />
        {usage.data?.truncated ? (
          <Truncated what="usage windows" cap={OPERATIONS_LIMITS.usageWindows} />
        ) : null}
      </GlassPanel>

      <GlassPanel className="mt-4 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <ScrollText className="h-4 w-4 text-muted-foreground" aria-hidden />
          Organization audit log
          <span className="text-xs text-muted-foreground">({audit.data?.rows.length ?? 0})</span>
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Every membership, ownership and policy change, written by the database that made it. An
          organization&rsquo;s own administrators see their own trail; this is the platform view.
        </p>
        <OcadeDataTable<AuditEventRow>
          caption="Organization audit log"
          tableId="admin-audit-log"
          preferenceScope={user?.id ?? "device"}
          columns={auditTable}
          rows={audit.data?.rows ?? []}
          loading={audit.isLoading}
          error={
            audit.error
              ? "The audit log could not be read. Your admin role may have changed."
              : null
          }
          onRetry={() => void audit.refetch()}
          searchPlaceholder="Organization or event"
          emptyMessage="No organization event matches that search."
          defaultPageSize={25}
          freezeFirstColumn
          exportFileName="ocade-organization-audit"
        />
        {audit.data?.truncated ? (
          <Truncated what="audit events" cap={OPERATIONS_LIMITS.auditEvents} />
        ) : null}
      </GlassPanel>

      <GlassPanel className="mt-4 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <BellRing className="h-4 w-4 text-muted-foreground" aria-hidden />
          Notification delivery, last seven days
          <span className="text-xs text-muted-foreground">({delivery.data?.rows.length ?? 0})</span>
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Counts only. Titles and bodies are somebody&rsquo;s security alerts and support
          correspondence, and no administrator role can read them.
        </p>
        {needsAttention > 0 ? (
          <p
            className="mb-3 flex items-center gap-2 rounded-md border border-[color:var(--state-warning)]/40 px-3 py-2 text-xs text-foreground"
            role="status"
          >
            <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {needsAttention} notification{needsAttention === 1 ? "" : "s"} failed or dead-lettered
            in this window. A channel with no sender configured reports{" "}
            <code className="rounded bg-muted px-1 py-0.5">unavailable</code> instead and is not
            counted here.
          </p>
        ) : null}
        <OcadeDataTable<DeliveryRow>
          caption="Notification delivery"
          tableId="admin-notification-delivery"
          preferenceScope={user?.id ?? "device"}
          columns={deliveryTable}
          rows={delivery.data?.rows ?? []}
          loading={delivery.isLoading}
          error={
            delivery.error ? "Delivery could not be read. Your admin role may have changed." : null
          }
          onRetry={() => void delivery.refetch()}
          searchPlaceholder="Category, channel or state"
          emptyMessage="No delivery group matches that search."
          defaultPageSize={25}
          freezeFirstColumn
          exportFileName="ocade-notification-delivery"
        />
        {delivery.data?.truncated ? (
          <Truncated what="delivery groups" cap={OPERATIONS_LIMITS.deliveryRows} />
        ) : null}
      </GlassPanel>
    </AppShell>
  );
}
