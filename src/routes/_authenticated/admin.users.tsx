import { useMemo, useState } from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Users, LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { supabase } from "@/integrations/supabase/client";

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
    meta: [
      { title: "Accounts — CAERA CADANE Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      throw redirect({
        to: "/access-denied",
        search: {
          area: "the account overview",
          reason: "This area requires the admin role on your CAERA CADANE account.",
        },
      });
    }
  },
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

function AdminUsersPage() {
  const [query, setQuery] = useState("");

  const accounts = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: async () => {
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = accounts.data ?? [];
    if (!q) return rows;
    return rows.filter((r) =>
      [r.display_name, r.email, r.phone, r.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [accounts.data, query]);

  return (
    <AppShell>
      <PageHeader
        title="Accounts & support"
        description="Every registered CAERA CADANE profile and the support tickets that are still open."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <GlassPanel className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
              Registered accounts
              <span className="text-xs text-muted-foreground">({filtered.length})</span>
            </h2>
            <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background/50 px-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, phone"
                aria-label="Search accounts"
                className="w-52 bg-transparent py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {accounts.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
            </div>
          ) : accounts.error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              Accounts could not be loaded. Your admin role may have changed.
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No accounts match that search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-2 pr-3 font-medium">Person</th>
                    <th className="py-2 pr-3 font-medium">Contact</th>
                    <th className="py-2 pr-3 font-medium">Roles</th>
                    <th className="py-2 pr-3 font-medium">Onboarded</th>
                    <th className="py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pr-3 text-foreground">{row.display_name ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        <div>{row.email ?? "—"}</div>
                        {row.phone ? <div>{row.phone}</div> : null}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.roles.join(", ")}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {row.onboarding_completed ? "Yes" : "No"}
                      </td>
                      <td className="py-2 text-muted-foreground">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
