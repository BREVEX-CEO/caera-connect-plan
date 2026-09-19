import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell/AppShell";
import { Pending } from "@/components/settings/rows";
import { requireAdminRole } from "@/lib/admin/route-gate";
import {
  grantAccountAccess,
  listAccountAccess,
  revokeAccountAccess,
  type AdminAccountRow,
} from "@/lib/admin/access.functions";

/**
 * THE WHOLE OF ADMINISTRATION: ONE HIDDEN SCREEN.
 *
 * It was nine routes — a directory, accounts, billing, operations, support,
 * help publishing, status, a launch gate and a payments checklist — each with
 * its own data layer. `docs/PRD.md` keeps admin only where the service still
 * requires it and keeps it out of customer navigation entirely.
 *
 * What the service requires is two things, and until now it could only do one.
 * Looking an account up and seeing its roles was here. GIVING somebody access,
 * which `PLAN.md` Phase 3 asks for by name — search, current tier, grant
 * Free/Pro/Max, an end time, a reason, revoke, told apart from a payment, and
 * audited — was not, so the one operational task the plan names was a SQL
 * console job. It is here now, through the database functions that already
 * enforce the admin role, a recent second factor and a written reason.
 *
 * Operational history still lives in the database, where an operator reads it
 * with the database's own tools rather than through a dashboard OCADE has to
 * maintain.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Administration — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireAdminRole(),
  component: AdminPage,
});

const DEFAULT_DAYS = 30;

function AdminPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /*
   * THE DATABASE SEARCHES, NOT THIS PAGE.
   *
   * Filtering happened here over the 200 newest profiles, so the two hundred and
   * first account was unfindable and the screen said "No matching accounts"
   * about a real customer. The term goes to the server, which is also why it is
   * part of the query key: a different term is a different answer, cached
   * separately rather than overwriting the last one.
   */
  const term = query.trim();
  const accounts = useQuery({
    queryKey: ["admin", "access", term],
    queryFn: () => listAccountAccess({ data: { query: term } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "access"] });

  const grant = useMutation({
    mutationFn: (input: { userId: string; tier: "pro" | "max"; days: number; reason: string }) =>
      grantAccountAccess({ data: input }),
    onSuccess: async () => {
      toast.success("Access granted.");
      setOpen(null);
      await refresh();
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });

  const revoke = useMutation({
    mutationFn: (input: { grantId: string; reason: string }) =>
      revokeAccountAccess({ data: input }),
    onSuccess: async (result) => {
      toast[result.revoked ? "success" : "error"](
        result.revoked ? "Access revoked." : "That grant was already revoked.",
      );
      await refresh();
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });

  const visible = accounts.data?.accounts ?? [];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {term.length > 0
            ? "Accounts matching your search, their roles, and the access given to them by hand."
            : "The most recent accounts, their roles, and the access given to them by hand. Search to reach any other."}
        </p>
        <SecondFactorNotice />

        <label className="mt-5 block">
          <span className="sr-only">Search accounts</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email, name or account id"
            className="h-8 w-full max-w-sm rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
        </label>

        {accounts.isPending || accounts.isError ? (
          <div className="mt-6">
            <Pending
              query={accounts}
              loading="Loading accounts…"
              problem="Accounts could not be read."
            />
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border/50 border-y border-border/50">
            {visible.map((row) => (
              <li key={row.id} className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">
                      {row.displayName ?? row.email ?? row.id}
                    </span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {row.email ?? "No email"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-[13px]">
                    <AccessBadge row={row} />
                    {row.roles.length > 0 ? (
                      <span className="text-muted-foreground">{row.roles.join(", ")}</span>
                    ) : null}
                    {row.grant ? (
                      <button
                        type="button"
                        onClick={() => {
                          const reason = window.prompt("Why is this access being taken back?");
                          if (reason && reason.trim().length >= 3) {
                            revoke.mutate({ grantId: row.grant!.id, reason: reason.trim() });
                          }
                        }}
                        disabled={revoke.isPending}
                        className="h-7 rounded-md border border-border px-2 text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpen(open === row.id ? null : row.id)}
                        aria-expanded={open === row.id}
                        className="h-7 rounded-md border border-border px-2 text-foreground transition-colors hover:bg-accent"
                      >
                        Give access
                      </button>
                    )}
                  </span>
                </div>

                {open === row.id ? (
                  <GrantForm
                    busy={grant.isPending}
                    onCancel={() => setOpen(null)}
                    onSubmit={(values) => grant.mutate({ userId: row.id, ...values })}
                  />
                ) : null}
              </li>
            ))}
            {visible.length === 0 ? (
              <li className="py-3 text-sm text-muted-foreground">No matching accounts.</li>
            ) : null}
            {accounts.data?.more ? (
              <li className="py-3 text-sm text-muted-foreground">
                More accounts match than are shown. Narrow the search, or paste the account id.
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

/**
 * WHETHER A GRANT CAN BE SUBMITTED AT ALL, SAID BEFORE IT IS TRIED.
 *
 * `ocade_grant_entitlement` refuses without `aal2`, and it is right to. What was
 * missing was any way to reach `aal2`: nothing in the product enrolled a second
 * factor, so an operator filled in the form, pressed the button, and was told
 * the change needed something OCADE gave them no way to obtain. Enrollment lives
 * in Settings now, and this says so while the session cannot grant.
 *
 * The check is a prompt, not the protection — the database refuses regardless —
 * so an unreadable answer says nothing rather than blocking the screen.
 */
function SecondFactorNotice() {
  const assurance = useQuery({
    queryKey: ["admin", "assurance"],
    queryFn: async () => (await import("@/lib/security/mfa")).currentAssurance(),
    retry: false,
  });
  if (assurance.data?.current === "aal2" || assurance.data === undefined) return null;
  return (
    <p className="mt-3 text-[13px] text-foreground" role="status">
      {assurance.data.next === "aal2"
        ? "Giving or taking back access needs your second factor. Open any signed-in page to be asked for your code, then come back."
        : "Giving or taking back access needs a second factor. Set up two-step verification under Settings → Account, then come back."}
    </p>
  );
}

/**
 * A GRANT AND A PAYMENT ARE NEVER THE SAME BADGE.
 *
 * `docs/RULES.md` #34 keeps manual access separate from payment evidence, and
 * an operator deciding whether to revoke something needs to know which of the
 * two they are looking at before they press anything.
 */
function AccessBadge({ row }: { row: AdminAccountRow }) {
  if (row.grant) {
    return (
      <span
        className="rounded border border-border px-1.5 py-0.5 text-foreground"
        title={`Given by hand${row.grant.reason ? `: ${row.grant.reason}` : ""}`}
      >
        {row.grant.tier === "max" ? "Max" : "Pro"} · given until{" "}
        {new Date(row.grant.endsAt).toLocaleDateString()}
      </span>
    );
  }
  if (row.paid) return <span className="text-muted-foreground">Paid subscription</span>;
  return <span className="text-muted-foreground">Free</span>;
}

function GrantForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: { tier: "pro" | "max"; days: number; reason: string }) => void;
}) {
  const [tier, setTier] = useState<"pro" | "max">("pro");
  const [days, setDays] = useState(String(DEFAULT_DAYS));
  const [reason, setReason] = useState("");
  const parsedDays = Number(days);
  const valid =
    Number.isInteger(parsedDays) &&
    parsedDays >= 1 &&
    parsedDays <= 366 &&
    reason.trim().length >= 3;

  return (
    <form
      // `preventDefault` before anything else: a handler that awaits first has
      // already returned, and the browser submits the form itself.
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSubmit({ tier, days: parsedDays, reason: reason.trim() });
      }}
      className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border p-3"
    >
      <label className="text-[13px] text-muted-foreground">
        <span className="mb-1 block">Tier</span>
        <select
          value={tier}
          onChange={(event) => setTier(event.target.value as "pro" | "max")}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring"
        >
          <option value="pro">Pro</option>
          <option value="max">Max</option>
        </select>
      </label>
      <label className="text-[13px] text-muted-foreground">
        <span className="mb-1 block">Days</span>
        <input
          type="number"
          min={1}
          max={366}
          value={days}
          onChange={(event) => setDays(event.target.value)}
          className="h-8 w-20 rounded-md border border-border bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring"
        />
      </label>
      <label className="min-w-[12rem] flex-1 text-[13px] text-muted-foreground">
        <span className="mb-1 block">Reason</span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why this account is being given access"
          className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
        />
      </label>
      <button
        type="submit"
        disabled={!valid || busy}
        className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Give access
      </button>
      {/* What is about to be written, in one sentence, before it is written. */}
      <p className="basis-full text-[13px] text-muted-foreground">
        {valid
          ? `${tier === "max" ? "Max" : "Pro"} until ${new Date(
              Date.now() + parsedDays * 86_400_000,
            ).toLocaleDateString()}, recorded against your account with the reason above.`
          : "Choose a tier, 1 to 366 days, and a reason of at least three characters."}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent"
      >
        Cancel
      </button>
    </form>
  );
}

/** A server function rejects with a Response; its body is the sentence. */
function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "That change was not applied.";
}
