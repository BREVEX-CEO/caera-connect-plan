import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { OcadeDataTable, type OcadeTableColumn } from "@/components/ui/ocade-data-table";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { useSession } from "@/lib/session";
import { requireAdminRole } from "@/lib/admin/route-gate";

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
};

type RoleRow = { user_id: string; role: string };

type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  last_message_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/users")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Accounts — CARCC CADANE Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireAdminRole("the account directory"),
  component: AdminUsersPage,
});

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type AccountRow = ProfileRow & { roles: string[] };

/*
 * The columns an administrator reads an account by.
 *
 * Declared out here rather than inside the component so the array identity is
 * stable across renders: the table infers each column's sort kind from the
 * values it holds, and a fresh array every render would redo that work on every
 * keystroke in the search box.
 */
const ACCOUNT_COLUMNS: readonly OcadeTableColumn<AccountRow>[] = [
  {
    key: "display_name",
    label: "Person",
    // The identifying column: it is what the row IS, so it is never hidden and
    // it is the one that stays put when a narrow window scrolls sideways.
    required: true,
    value: (row) => row.display_name ?? "",
  },
  { key: "email", label: "Email", value: (row) => row.email ?? "" },
  { key: "phone", label: "Phone", value: (row) => row.phone ?? "" },
  { key: "country", label: "Country", value: (row) => row.country ?? "" },
  { key: "roles", label: "Roles", value: (row) => row.roles.join(", ") },
  {
    key: "onboarding_completed",
    label: "Onboarded",
    // Declared rather than inferred: a column that is entirely `false` on the
    // first page would otherwise be read as text and sort alphabetically.
    sort: "boolean",
    value: (row) => Boolean(row.onboarding_completed),
  },
  {
    key: "created_at",
    label: "Joined",
    sort: "date",
    value: (row) => (row.created_at ? new Date(row.created_at) : null),
    render: (row) => formatDate(row.created_at),
  },
];

function AdminUsersPage() {
  const { user } = useSession();

  const accounts = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const [profiles, roles] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, email, phone, country, onboarding_completed, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      const roleMap = new Map<string, string[]>();
      for (const r of (roles.data ?? []) as RoleRow[]) {
        roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
      }
      return ((profiles.data ?? []) as ProfileRow[]).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? ["user"],
      }));
    },
  });

  const tickets = useQuery({
    queryKey: ["admin", "open-tickets"],
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      const { data, error } = await supabase
        .from("ocade_support_tickets")
        .select("id, user_id, subject, status, priority, last_message_at")
        .not("status", "in", "(resolved,closed)")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as TicketRow[];
    },
  });

  return (
    <AppShell>
      <PageHeader
        title="Accounts & support"
        description="Every registered CARCC CADANE profile and the support tickets that are still open."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <GlassPanel className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            Registered accounts
            <span className="text-xs text-muted-foreground">({accounts.data?.length ?? 0})</span>
          </h2>

          {/*
           * ONE TABLE, NOT A SECOND ONE.
           *
           * This screen had its own hand-written `<table>`: a search box, no
           * sorting, no pagination, and up to five hundred rows rendered into
           * a single scroll. It had no narrow-screen fallback either, so on a
           * phone the page scrolled sideways — the defect the route audit
           * checks for on every other route.
           *
           * Migrating it to the canonical table is what PLAN.md §M asks for,
           * and it is also how this screen gains sortable headers, a page
           * size, column control and an export without any of that being
           * written twice.
           *
           * THE EXPORT IS EXACTLY WHAT THE SERVER ALREADY HANDED OVER. The
           * rows come from a query this administrator ran under their own
           * policy; the CSV is those rows and nothing else, so it cannot
           * contain an account they could not already read on screen.
           */}
          <OcadeDataTable<AccountRow>
            caption="Registered accounts"
            tableId="admin-accounts"
            preferenceScope={user?.id ?? "device"}
            columns={ACCOUNT_COLUMNS}
            rows={accounts.data ?? []}
            loading={accounts.isLoading}
            error={
              accounts.error
                ? "Accounts could not be loaded. Your admin role may have changed."
                : null
            }
            onRetry={() => void accounts.refetch()}
            searchPlaceholder="Name, email, phone"
            emptyMessage="No accounts match that search."
            defaultPageSize={25}
            freezeFirstColumn
            exportFileName="ocade-accounts"
            filters={[
              {
                id: "onboarded",
                label: "Onboarded",
                options: [
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ],
                test: (row, value) =>
                  value === "yes" ? Boolean(row.onboarding_completed) : !row.onboarding_completed,
              },
              {
                id: "role",
                label: "Role",
                options: [
                  { value: "admin", label: "Admin" },
                  { value: "user", label: "User" },
                ],
                test: (row, value) => row.roles.includes(value),
              },
            ]}
          />
        </GlassPanel>

        <GlassPanel className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <LifeBuoy className="h-4 w-4 text-muted-foreground" aria-hidden />
            Open support tickets
            <span className="text-xs text-muted-foreground">({tickets.data?.length ?? 0})</span>
          </h2>
          {tickets.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
            </div>
          ) : tickets.error ? (
            <p className="text-xs text-destructive">Tickets could not be loaded.</p>
          ) : (tickets.data ?? []).length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No open tickets right now.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(tickets.data ?? []).map((t) => (
                <li key={t.id} className="rounded-md border border-border/50 bg-background/40 p-2">
                  <p className="text-xs font-medium text-foreground">{t.subject}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t.status} · {t.priority} · {formatDate(t.last_message_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/admin/support"
            className="mt-3 inline-flex text-xs text-primary underline underline-offset-4"
          >
            Open the support queue to reply →
          </Link>
        </GlassPanel>
      </div>
    </AppShell>
  );
}
