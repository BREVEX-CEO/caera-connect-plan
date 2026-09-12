import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { requireAdminRole } from "@/lib/admin/route-gate";

/**
 * THE WHOLE OF ADMINISTRATION: ONE HIDDEN SCREEN.
 *
 * It was nine routes — a directory, accounts, billing, operations, support,
 * help publishing, status, a launch gate and a payments checklist — each with
 * its own data layer. `docs/PRD.md` keeps admin only where the service still
 * requires it and keeps it out of customer navigation entirely, and what the
 * service actually requires is the ability to look an account up and see the
 * roles attached to it. Operational history lives in the database, where an
 * operator reads it with the database's own tools rather than through a
 * dashboard OCADE has to maintain.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Administration — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireAdminRole(),
  component: AdminPage,
});

/** The page is capped rather than paginated: an operator searches, not browses. */
const ACCOUNT_LIMIT = 200;
const ROLE_LIMIT = 1_000;

interface AccountRow {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  roles: string[];
}

function AdminPage() {
  const [query, setQuery] = useState("");

  const accounts = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: async (): Promise<AccountRow[]> => {
      const supabase = await loadSupabaseClient();
      const [profiles, roles] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, email, created_at")
          .order("created_at", { ascending: false })
          .limit(ACCOUNT_LIMIT),
        supabase.from("user_roles").select("user_id, role").limit(ROLE_LIMIT),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;

      const byUser = new Map<string, string[]>();
      for (const row of roles.data ?? []) {
        const list = byUser.get(row.user_id) ?? [];
        list.push(row.role);
        byUser.set(row.user_id, list);
      }
      return (profiles.data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at,
        roles: byUser.get(row.id) ?? [],
      }));
    },
  });

  const term = query.trim().toLowerCase();
  const visible = (accounts.data ?? []).filter(
    (row) =>
      term.length === 0 ||
      (row.email ?? "").toLowerCase().includes(term) ||
      (row.displayName ?? "").toLowerCase().includes(term),
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The {ACCOUNT_LIMIT} most recent accounts and the roles on them.
        </p>

        <label className="mt-5 block">
          <span className="sr-only">Search accounts</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email or name"
            className="h-8 w-full max-w-sm rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
        </label>

        {accounts.isPending ? (
          <p className="mt-8 text-sm text-muted-foreground" role="status">
            Loading accounts…
          </p>
        ) : accounts.isError ? (
          <p className="mt-8 text-sm text-muted-foreground" role="alert">
            Accounts could not be read.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border/50 border-y border-border/50">
            {visible.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">
                    {row.displayName ?? row.email ?? row.id}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {row.email ?? "No email"}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {row.roles.length > 0 ? row.roles.join(", ") : "—"}
                </span>
              </li>
            ))}
            {visible.length === 0 ? (
              <li className="py-3 text-sm text-muted-foreground">No matching accounts.</li>
            ) : null}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
