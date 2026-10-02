import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { AppShell } from "@/components/shell/AppShell";
import { Pending } from "@/components/settings/rows";
import {
  AuditModule,
  CasesModule,
  Reason,
  StaffModule,
  SystemModule,
} from "@/components/admin/ConsoleModules";
import { requireStaff } from "@/lib/admin/route-gate";
import { isConsoleHost, onSite } from "@/lib/admin/console-host";
import { enterTheConsole } from "@/lib/admin/open-console";
import { BrandMark } from "@/components/shell/BrandMark";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { useSession } from "@/lib/session";
import {
  grantAccountAccess,
  listAccountAccess,
  listAccountDevices,
  removeAccountDevice,
  revokeAccountAccess,
  type AdminAccountRow,
  type StaffPermission,
} from "@/lib/admin/access.functions";
import {
  adjustCustomerUsage,
  deleteCustomerAccount,
  endCustomerSessions,
  messageOf,
  openCase,
  readCustomer,
  readMyStaff,
  ready,
  resetCustomerSecondFactor,
  STAFF_ROLE_NAMES,
  suspendCustomer,
  type MyStaff,
  type StaffRole,
} from "@/lib/admin/staff.functions";

/**
 * THE OWNER CONSOLE AND THE STAFF CONSOLE: ONE ROUTE, SHOWN BY PERMISSION.
 *
 * Who is staff, and what each may do, is `public.ocade_staff` in the database
 * (Primary Owner, Backup Owner, Admin, Support, Billing, Operations, Read-only,
 * with per-person changes). This page asks the database which modules to show;
 * every read and change it makes is checked there again. Customers are sent
 * back to Chat without a word, and nothing on their screens names this place.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Console — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: () => requireStaff(),
  component: ConsolePage,
});

type Module = "customers" | "cases" | "staff" | "system" | "audit";

const MODULES: { id: Module; name: string; needs: StaffPermission[] }[] = [
  { id: "customers", name: "Customers", needs: ["customers.read"] },
  { id: "cases", name: "Cases", needs: ["cases.read", "cases.manage"] },
  { id: "staff", name: "Staff", needs: ["staff.manage"] },
  { id: "system", name: "System", needs: ["health.read", "execution.manage"] },
  { id: "audit", name: "Audit", needs: ["audit.read"] },
];

const DEFAULT_DAYS = 30;

function ConsolePage() {
  // The site's /admin is only the way across; the console itself is on its own origin.
  return isConsoleHost(window.location.hostname) ? <Console /> : <OpenConsole />;
}

/**
 * ON THE SITE: THE WAY ACROSS, ON A PRESS. A way in is minted only when the
 * person asks for it here (or from the account menu), never because a link
 * opened this address.
 */
function OpenConsole() {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The console opens on its own address and asks for your authenticator code there.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setProblem(null);
            void enterTheConsole().catch((cause: unknown) => {
              setProblem(messageOf(cause));
              setBusy(false);
            });
          }}
          className="mt-4 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Opening…" : "Open the console"}
        </button>
        {problem ? (
          <p className="mt-3 text-sm text-foreground" role="alert">
            {problem}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

/**
 * ON THE CONSOLE'S ORIGIN, NO CUSTOMER SCREENS. Chat, JARVIS and the Library are
 * the site's; the way back to them is a real navigation to the site, never a
 * route rendered here.
 */
function ConsoleShell({ children }: { children: ReactNode }) {
  const site = onSite(new URL("/", window.location.href)).toString();
  // Whose console this is, always in view: a way in handed over by somebody
  // else would otherwise put a person to work in another account unknowingly.
  const { user } = useSession();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-border/60 px-5">
        <a href={site} aria-label="OCADE" className="shrink-0 rounded-md">
          <BrandMark showWordmark />
        </a>
        <span className="min-w-0 flex-1 truncate text-right text-sm text-muted-foreground">
          {user?.email}
        </span>
        <button
          type="button"
          onClick={async () => {
            const supabase = await loadSupabaseClient();
            await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
            window.location.replace(site);
          }}
          className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Sign out of the console
        </button>
      </header>
      <main id="workspace">{children}</main>
    </div>
  );
}

function Console() {
  /*
   * Read again here, not only in the gate, and again whenever the tab is
   * looked at: access removed elsewhere leaves this screen at once instead of
   * sitting on a stale copy of what it used to be allowed.
   */
  const me = useQuery({
    queryKey: ["staff", "me", "console"],
    queryFn: () => readMyStaff(),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const [module, setModule] = useState<Module | null>(null);

  if (me.isSuccess && me.data === null) {
    // No longer staff: back to Chat, told nothing, exactly as a customer is.
    window.location.replace(onSite(new URL("/", window.location.href)).toString());
    return null;
  }
  if (!me.data) {
    return (
      <ConsoleShell>
        <div className="mx-auto w-full max-w-4xl px-5 py-8">
          <Pending
            query={me}
            loading="Opening the console…"
            problem="The console could not open."
          />
        </div>
      </ConsoleShell>
    );
  }
  const staff = me.data;
  const owner = staff.role === "primary_owner" || staff.role === "backup_owner";
  const visible = MODULES.filter((m) => m.needs.some((p) => staff.permissions.includes(p)));
  const current = visible.find((m) => m.id === module) ?? visible[0];
  const blocked = !staff.secondFactor && staff.role !== "primary_owner";

  return (
    <ConsoleShell>
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {owner ? "Owner Console" : "Staff Console"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {STAFF_ROLE_NAMES[staff.role]}. You see what your role allows; every change asks for a
          recent code and is written to the audit record.
        </p>
        {staff.secondFactor ? null : <SecondFactorNotice blocking={blocked} />}
        {blocked ? null : (
          <>
            <nav aria-label="Console" className="mt-5 flex flex-wrap gap-1.5">
              {visible.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-current={current?.id === m.id ? "page" : undefined}
                  onClick={() => setModule(m.id)}
                  className={
                    current?.id === m.id
                      ? "h-8 rounded-md bg-accent px-3 text-sm text-foreground"
                      : "h-8 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
                  }
                >
                  {m.name}
                </button>
              ))}
            </nav>
            {current?.id === "customers" ? (
              <CustomersModule me={staff} onOpenCases={() => setModule("cases")} />
            ) : null}
            {current?.id === "cases" ? <CasesModule me={staff} /> : null}
            {current?.id === "staff" ? <StaffModule me={staff} /> : null}
            {current?.id === "system" ? <SystemModule me={staff} /> : null}
            {current?.id === "audit" ? <AuditModule /> : null}
          </>
        )}
      </div>
    </ConsoleShell>
  );
}

/**
 * THE SECOND FACTOR, SAID BEFORE ANYTHING IS TRIED. Staff other than the
 * Primary Owner read nothing until this session answered it; the Primary Owner
 * may look while setting it up, and changes nothing until then.
 */
function SecondFactorNotice({ blocking }: { blocking: boolean }) {
  const assurance = useQuery({
    queryKey: ["admin", "assurance"],
    queryFn: async () => (await import("@/lib/security/mfa")).currentAssurance(),
    retry: false,
  });
  const enrolled = assurance.data?.next === "aal2";
  return (
    <p
      className="mt-3 rounded-md border border-border/60 p-3 text-[13px] text-foreground"
      role="status"
    >
      {blocking
        ? "The console opens once this session has answered your second factor."
        : "Changes need your second factor."}{" "}
      {enrolled ? (
        <a href="/auth/challenge?next=/admin" className="underline underline-offset-2">
          Enter your code
        </a>
      ) : (
        "Set up two-step verification under Settings → Account, then come back."
      )}
    </p>
  );
}

/* ------------------------------------------------------------ customers -- */

function CustomersModule({ me, onOpenCases }: { me: MyStaff; onOpenCases: () => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [grantFor, setGrantFor] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const may = (permission: StaffPermission) => me.permissions.includes(permission);

  /*
   * THE DATABASE SEARCHES, NOT THIS PAGE. The term goes to the server, which is
   * also why it is part of the query key: a different term is a different answer.
   */
  const term = query.trim();
  const accounts = useQuery({
    queryKey: ["admin", "access", term],
    queryFn: () => listAccountAccess({ data: { query: term } }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "access"] });
  const { withProof, dialog } = useConfirmIdentity();

  const grant = useMutation({
    mutationFn: (input: { userId: string; tier: "pro" | "max"; days: number; reason: string }) =>
      withProof(() => grantAccountAccess({ data: input })),
    onSuccess: async () => {
      toast.success("Access granted.");
      setGrantFor(null);
      await refresh();
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });
  const revoke = useMutation({
    mutationFn: (input: { grantId: string; reason: string }) =>
      withProof(() => revokeAccountAccess({ data: input })),
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
    <>
      {dialog}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">
                    {row.displayName ?? row.email ?? row.id}
                  </span>
                  {row.displayName ? (
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {row.email ?? "No email"}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2 text-[13px]">
                  <AccessBadge row={row} />
                  {row.roles.length > 0 ? (
                    <span className="text-muted-foreground">
                      {row.roles.map((r) => STAFF_ROLE_NAMES[r as StaffRole] ?? r).join(", ")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(open === row.id ? null : row.id)}
                    aria-expanded={open === row.id}
                    className="h-7 rounded-md border border-border px-2 text-foreground transition-colors hover:bg-accent"
                  >
                    {open === row.id ? "Close" : "Open"}
                  </button>
                  {!may("grants.manage") ? null : row.grant ? (
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
                      {revoke.isPending ? "Revoking…" : "Revoke"}
                    </button>
                  ) : row.isSelf ? (
                    <span className="text-muted-foreground">Someone else grants yours</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setGrantFor(grantFor === row.id ? null : row.id)}
                      aria-expanded={grantFor === row.id}
                      className="h-7 rounded-md border border-border px-2 text-foreground transition-colors hover:bg-accent"
                    >
                      Give access
                    </button>
                  )}
                </span>
              </div>
              {grantFor === row.id && !row.isSelf ? (
                <GrantForm
                  busy={grant.isPending}
                  onCancel={() => setGrantFor(null)}
                  onSubmit={(values) => grant.mutate({ userId: row.id, ...values })}
                />
              ) : null}
              {open === row.id ? (
                <CustomerDetail row={row} me={me} onOpenCases={onOpenCases} />
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
    </>
  );
}

/** One customer, in the parts this staff member may see. */
function CustomerDetail({
  row,
  me,
  onOpenCases,
}: {
  row: AdminAccountRow;
  me: MyStaff;
  onOpenCases: () => void;
}) {
  const may = (permission: StaffPermission) => me.permissions.includes(permission);
  const detail = useQuery({
    queryKey: ["admin", "customer", row.id],
    queryFn: () => readCustomer({ data: { userId: row.id } }),
  });
  const { withProof, dialog } = useConfirmIdentity();
  const [why, setWhy] = useState("");
  const [hours, setHours] = useState("24");
  const end = useMutation({
    mutationFn: () =>
      withProof(() => endCustomerSessions({ data: { userId: row.id, reason: why } })),
    onSuccess: ({ ended }) => {
      toast.success(`Sessions ended (${ended}). They sign in again on every device.`);
      setWhy("");
      void detail.refetch();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const kase = useMutation({
    mutationFn: () =>
      withProof(() => openCase({ data: { userId: row.id, reason: why, hours: Number(hours) } })),
    onSuccess: () => {
      toast.success("Case opened. The customer has been told.");
      setWhy("");
      onOpenCases();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const reset = useMutation({
    mutationFn: () =>
      withProof(() => resetCustomerSecondFactor({ data: { userId: row.id, reason: why } })),
    onSuccess: ({ removed }) => {
      toast.success(
        removed
          ? "Their two-step verification is off, and they are signed out everywhere."
          : "They had no two-step verification to turn off.",
      );
      setWhy("");
      void detail.refetch();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const validHours = Number.isInteger(Number(hours)) && Number(hours) >= 1 && Number(hours) <= 72;

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border p-3 text-[13px]">
      {dialog}
      {detail.data ? (
        <>
          {detail.data.security ? (
            <p className="text-muted-foreground">
              Two-step {detail.data.security.secondFactor ? "on" : "off"} ·{" "}
              {detail.data.security.sessions} active session
              {detail.data.security.sessions === 1 ? "" : "s"} · last sign-in{" "}
              {detail.data.security.lastSignIn
                ? new Date(detail.data.security.lastSignIn).toLocaleString()
                : "never"}
            </p>
          ) : null}
          {detail.data.usage ? (
            <p className="text-muted-foreground">
              Usage:{" "}
              {detail.data.usage.length
                ? detail.data.usage.map((w) => `${w.kind} ${w.used}`).join(" · ")
                : "none yet"}
            </p>
          ) : null}
          {detail.data.tasks ? (
            detail.data.tasks.length ? (
              <ul className="space-y-1">
                {detail.data.tasks.map((task, index) => (
                  <li key={index} className="flex justify-between gap-2">
                    <span className="truncate text-foreground">{task.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {task.status} · {new Date(task.updatedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No JARVIS tasks.</p>
            )
          ) : null}
        </>
      ) : (
        <Pending
          query={detail}
          loading="Loading the account…"
          problem="The account could not be read."
        />
      )}
      {may("devices.read") ? (
        <AccountDevices userId={row.id} canRemove={may("devices.manage")} />
      ) : null}
      {!row.isSelf && (may("usage.manage") || may("accounts.manage") || may("accounts.delete")) ? (
        <AccountOperations
          row={row}
          may={may}
          suspended={detail.data?.security?.suspended ?? null}
          onChanged={() => void detail.refetch()}
        />
      ) : null}
      {!row.isSelf && (may("sessions.manage") || may("cases.manage")) ? (
        <div className="space-y-2 border-t border-border/50 pt-3">
          <Reason value={why} onChange={setWhy} label="Why" />
          <div className="flex flex-wrap items-center gap-2">
            {may("sessions.manage") ? (
              <button
                type="button"
                disabled={!ready(why) || end.isPending}
                onClick={() => end.mutate()}
                className="h-7 rounded-md border border-destructive/50 px-2 text-destructive disabled:opacity-50"
              >
                {end.isPending ? "Ending…" : "End all their sessions"}
              </button>
            ) : null}
            {may("sessions.manage") && detail.data?.security?.secondFactor ? (
              // Only for somebody who lost their phone and their recovery codes.
              <button
                type="button"
                disabled={!ready(why) || reset.isPending}
                onClick={() => reset.mutate()}
                className="h-7 rounded-md border border-destructive/50 px-2 text-destructive disabled:opacity-50"
              >
                {reset.isPending ? "Turning off…" : "Turn off their two-step"}
              </button>
            ) : null}
            {may("cases.manage") ? (
              <>
                <label className="flex items-center gap-1 text-muted-foreground">
                  <span>Case for</span>
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={hours}
                    onChange={(event) => setHours(event.target.value)}
                    aria-label="Case length in hours"
                    className="h-7 w-16 rounded-md border border-border bg-transparent px-2 text-foreground outline-none focus-visible:border-ring"
                  />
                  <span>hours</span>
                </label>
                <button
                  type="button"
                  disabled={!ready(why) || !validHours || kase.isPending}
                  onClick={() => kase.mutate()}
                  className="h-7 rounded-md border border-border px-2 text-foreground disabled:opacity-50"
                >
                  {kase.isPending ? "Opening…" : "Open a case"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * GIVE BACK USAGE, SUSPEND OR RESTORE, DELETE. Each one is the database's to
 * allow (permission, second factor, recent proof, a reason, never an owner and
 * never oneself) and is kept on the record; the deletion also needs the
 * account's own address typed.
 */
function AccountOperations({
  row,
  may,
  suspended,
  onChanged,
}: {
  row: AdminAccountRow;
  may: (permission: StaffPermission) => boolean;
  suspended: boolean | null;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const { withProof, dialog } = useConfirmIdentity();
  const [why, setWhy] = useState("");
  const [surface, setSurface] = useState<"chat" | "jarvis">("chat");
  const [period, setPeriod] = useState<"session" | "week">("session");
  const [uses, setUses] = useState("1");
  const [typed, setTyped] = useState("");
  const count = Number(uses);
  const validUses = Number.isFinite(count) && count >= 0.01 && count <= 1000;
  const giveBack = useMutation({
    mutationFn: () =>
      withProof(() =>
        adjustCustomerUsage({
          data: { userId: row.id, surface, window: period, uses: -count, reason: why },
        }),
      ),
    onSuccess: ({ used }) => {
      toast.success(`Given back. They have used ${used} in this ${period} now.`);
      setWhy("");
      onChanged();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const suspend = useMutation({
    mutationFn: (on: boolean) =>
      withProof(() => suspendCustomer({ data: { userId: row.id, suspend: on, reason: why } })),
    onSuccess: (_, on) => {
      toast.success(
        on
          ? "Suspended. They are signed out everywhere and their devices are disconnected."
          : "Restored. They can sign in again and connect their devices.",
      );
      setWhy("");
      onChanged();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const erase = useMutation({
    mutationFn: () =>
      withProof(() =>
        deleteCustomerAccount({ data: { userId: row.id, email: typed, reason: why } }),
      ),
    onSuccess: ({ reference, recorded }) => {
      toast.success(`The account is deleted. Reference ${reference}.`);
      if (!recorded) toast.error(`The deletion's final record was not written. Note ${reference}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const typedMatches =
    Boolean(row.email) && typed.trim().toLowerCase() === row.email!.toLowerCase();

  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      {dialog}
      <Reason value={why} onChange={setWhy} label="Reason for the record" />
      {may("usage.manage") ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-muted-foreground">
            <span>Give back</span>
            <input
              type="number"
              min={0.01}
              max={1000}
              step={1}
              value={uses}
              onChange={(event) => setUses(event.target.value)}
              aria-label="Uses to give back"
              className="h-7 w-16 rounded-md border border-border bg-transparent px-2 text-foreground outline-none focus-visible:border-ring"
            />
            <span>uses of</span>
          </label>
          <select
            value={surface}
            onChange={(event) => setSurface(event.target.value as "chat" | "jarvis")}
            aria-label="Which allowance"
            className="h-7 rounded-md border border-border bg-transparent px-1 text-foreground"
          >
            <option value="chat">Chat</option>
            <option value="jarvis">JARVIS</option>
          </select>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as "session" | "week")}
            aria-label="Which window"
            className="h-7 rounded-md border border-border bg-transparent px-1 text-foreground"
          >
            <option value="session">this session</option>
            <option value="week">this week</option>
          </select>
          <button
            type="button"
            disabled={!ready(why) || !validUses || giveBack.isPending}
            onClick={() => giveBack.mutate()}
            className="h-7 rounded-md border border-border px-2 text-foreground disabled:opacity-50"
          >
            {giveBack.isPending ? "Giving back…" : "Give back"}
          </button>
        </div>
      ) : null}
      {may("accounts.manage") ? (
        <div className="flex flex-wrap items-center gap-2">
          {suspended !== true ? (
            <button
              type="button"
              disabled={!ready(why) || suspend.isPending}
              onClick={() => suspend.mutate(true)}
              className="h-7 rounded-md border border-destructive/50 px-2 text-destructive disabled:opacity-50"
            >
              {suspend.isPending ? "Working…" : "Suspend the account"}
            </button>
          ) : null}
          {suspended !== false ? (
            <button
              type="button"
              disabled={!ready(why) || suspend.isPending}
              onClick={() => suspend.mutate(false)}
              className="h-7 rounded-md border border-border px-2 text-foreground disabled:opacity-50"
            >
              {suspend.isPending ? "Working…" : "Restore the account"}
            </button>
          ) : null}
          {suspended ? <span className="text-destructive">Suspended</span> : null}
        </div>
      ) : null}
      {may("accounts.delete") && row.email ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Type their email to delete"
            aria-label="Type the account's email address to delete it"
            autoComplete="off"
            className="h-7 w-64 max-w-full rounded-md border border-border bg-transparent px-2 text-foreground outline-none focus-visible:border-ring"
          />
          <button
            type="button"
            disabled={!ready(why) || !typedMatches || erase.isPending}
            onClick={() => erase.mutate()}
            className="h-7 rounded-md bg-destructive px-2 text-destructive-foreground disabled:opacity-50"
          >
            {erase.isPending ? "Deleting…" : "Delete the account permanently"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * ONE ACCOUNT'S JARVIS DEVICES. Removing one ends its key and its open work;
 * the database requires a second factor and a reason and keeps the record.
 */
function AccountDevices({ userId, canRemove: allowed }: { userId: string; canRemove: boolean }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const devices = useQuery({
    queryKey: ["admin", "devices", userId],
    queryFn: () => listAccountDevices({ data: { userId } }),
  });
  const { withProof, dialog } = useConfirmIdentity();
  const remove = useMutation({
    mutationFn: (deviceId: string) =>
      withProof(() => removeAccountDevice({ data: { deviceId, reason } })),
    onSuccess: async ({ removed }) => {
      toast[removed ? "success" : "error"](
        removed ? "Device removed." : "That device was already removed.",
      );
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "devices", userId] });
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });
  if (!devices.data) {
    return (
      <div className="mt-3">
        <Pending query={devices} loading="Loading devices…" problem="Devices could not be read." />
      </div>
    );
  }
  if (devices.data.length === 0) {
    return <p className="mt-3 text-[13px] text-muted-foreground">No JARVIS devices.</p>;
  }
  const canRemove = allowed && reason.trim().length >= 10 && !remove.isPending;
  return (
    <div className="mt-3 rounded-md border border-border p-3 text-[13px]">
      {dialog}
      <ul className="space-y-2">
        {devices.data.map((device) => (
          <li key={device.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-foreground">{device.name}</span>
              <span className="block truncate text-muted-foreground">
                {device.platform ?? (device.kind === "android" ? "Phone" : "Computer")} ·{" "}
                {device.lastSeenAt
                  ? `seen ${new Date(device.lastSeenAt).toLocaleString()}`
                  : "never connected"}
              </span>
            </span>
            {device.removedAt ? (
              <span className="shrink-0 text-muted-foreground">Removed</span>
            ) : !allowed ? null : (
              <button
                type="button"
                disabled={!canRemove}
                onClick={() => remove.mutate(device.id)}
                className="h-7 shrink-0 rounded-md border border-border px-2 text-destructive transition-colors hover:bg-accent disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {allowed && devices.data.some((device) => !device.removedAt) ? (
        <label className="mt-3 block">
          <span className="sr-only">Reason for removing a device</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why a device is being removed (at least ten characters)"
            className="h-8 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          />
        </label>
      ) : null}
    </div>
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
    reason.trim().length >= 10;

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
          : "Choose a tier, 1 to 366 days, and a reason of at least ten characters."}
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
