import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { Pending } from "@/components/settings/rows";
import { type StaffPermission } from "@/lib/admin/access.functions";
import {
  closeCase,
  endAllStaffSessions,
  grantStaff,
  grantUnlimited,
  listAudit,
  listCases,
  listStaff,
  messageOf,
  readCaseConversation,
  readCustomer,
  readServiceControls,
  readSystemHealth,
  ready,
  revokeStaff,
  revokeUnlimited,
  setServiceControl,
  setStaffPermissions,
  STAFF_ROLE_NAMES,
  transferOwnership,
  withdrawStaffInvite,
  type MyStaff,
  type StaffMember,
  type Unlimited,
  type StaffRole,
} from "@/lib/admin/staff.functions";

/**
 * THE CONSOLE'S MODULES. Each one is shown only when the database says the
 * signed-in staff member holds its permission, and each change it makes goes
 * through a database function that checks the same thing again, asks for a
 * recent second factor and writes the change down. Every button here has a
 * loading state, a disabled state until its reason is written, a success and
 * a failure said in words, and a retry for anything it reads.
 */

/** A reason of at least ten characters, which every change on the record needs. */
export function Reason({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${label} (at least ten characters)`}
        maxLength={500}
        className="h-8 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-5 rounded-xl border border-border/60 p-4 text-sm">
      <h2 className="font-medium text-foreground">{title}</h2>
      {children}
    </section>
  );
}

const button =
  "h-7 shrink-0 rounded-md border border-border px-2 text-[13px] text-foreground transition-colors hover:bg-accent disabled:opacity-50";

/* ---------------------------------------------------------------- staff -- */

const ALL_PERMISSIONS: { id: StaffPermission; name: string }[] = [
  { id: "customers.read", name: "See customers" },
  { id: "usage.read", name: "See usage" },
  { id: "security.read", name: "See account security" },
  { id: "sessions.manage", name: "End customer sessions" },
  { id: "grants.manage", name: "Give or take back plans" },
  { id: "health.read", name: "See system health" },
  { id: "audit.read", name: "See the audit record" },
  { id: "staff.manage", name: "Manage staff" },
  { id: "cases.read", name: "Read conversations under a case" },
  { id: "cases.manage", name: "Open and close cases" },
  { id: "usage.manage", name: "Give back usage" },
  { id: "accounts.manage", name: "Suspend or restore accounts" },
  { id: "accounts.delete", name: "Delete accounts" },
  { id: "execution.manage", name: "Pause JARVIS in an emergency" },
];

const GRANTABLE_ROLES: StaffRole[] = [
  "admin",
  "support",
  "billing",
  "operations",
  "read_only",
  "backup_owner",
];

export function StaffModule({ me }: { me: MyStaff }) {
  const queryClient = useQueryClient();
  const staff = useQuery({ queryKey: ["admin", "staff"], queryFn: () => listStaff() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
  const { withProof, dialog } = useConfirmIdentity();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("support");
  const [why, setWhy] = useState("");
  const grant = useMutation({
    mutationFn: () => withProof(() => grantStaff({ data: { email, role, reason: why } })),
    onSuccess: async ({ status }) => {
      toast.success(
        status === "granted"
          ? `${email} is now ${STAFF_ROLE_NAMES[role]}.`
          : `Invitation saved. ${email} gets access when they sign up and verify that address.`,
      );
      setEmail("");
      setWhy("");
      await refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  const [emergency, setEmergency] = useState("");
  const endAll = useMutation({
    mutationFn: () => withProof(() => endAllStaffSessions({ data: { reason: emergency } })),
    onSuccess: ({ ended }) => {
      toast.success(`Every other staff session ended (${ended}).`);
      setEmergency("");
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  const roles =
    me.role === "primary_owner"
      ? GRANTABLE_ROLES
      : GRANTABLE_ROLES.filter((r) => r !== "backup_owner");
  const validEmail = /^[^@\s]+@[^@\s]+$/.test(email.trim());

  return (
    <>
      {dialog}
      <Section title="Staff">
        {staff.data ? (
          <ul className="mt-2 divide-y divide-border/50">
            {staff.data.staff.map((member) => (
              <StaffRow
                key={member.userId}
                member={member}
                me={me}
                held={staff.data.defaults[member.role] ?? []}
                onChanged={refresh}
              />
            ))}
          </ul>
        ) : (
          <Pending query={staff} loading="Loading staff…" problem="Staff could not be read." />
        )}
        {staff.data?.invites.length ? (
          <>
            <h3 className="mt-4 text-[13px] font-medium text-muted-foreground">
              Waiting for sign-up
            </h3>
            <ul className="mt-1 divide-y divide-border/50">
              {staff.data.invites.map((invite) => (
                <InviteRow key={invite.id} invite={invite} onChanged={refresh} />
              ))}
            </ul>
          </>
        ) : null}
      </Section>

      <Section title="Give someone access">
        <p className="mt-1 text-[13px] text-muted-foreground">
          OCADE finds the account by its verified email address and gives access to that account,
          not to the address. An address with no account yet waits as an invitation for 14 days.
        </p>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (validEmail && ready(why) && !grant.isPending) grant.mutate();
          }}
        >
          <label className="block">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="h-8 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </label>
          <label className="block">
            <span className="sr-only">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring"
            >
              {roles.map((option) => (
                <option key={option} value={option}>
                  {STAFF_ROLE_NAMES[option]}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Reason value={why} onChange={setWhy} label="Why" />
          </div>
          <button
            type="submit"
            disabled={!validEmail || !ready(why) || grant.isPending}
            className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
          >
            {grant.isPending ? "Giving access…" : "Give access"}
          </button>
        </form>
      </Section>

      <Section title="Emergency: sign every staff member out">
        <p className="mt-1 text-[13px] text-muted-foreground">
          Ends every staff session on every device, except this one. Use it when a staff account may
          be in the wrong hands; removing that person also stops their access at once.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="min-w-[12rem] flex-1">
            <Reason value={emergency} onChange={setEmergency} label="Why" />
          </div>
          <button
            type="button"
            disabled={!ready(emergency) || endAll.isPending}
            onClick={() => endAll.mutate()}
            className="h-8 rounded-md border border-destructive/50 px-3 text-sm text-destructive disabled:opacity-50"
          >
            {endAll.isPending ? "Signing out…" : "Sign all staff out"}
          </button>
        </div>
      </Section>
    </>
  );
}

function StaffRow({
  member,
  me,
  held,
  onChanged,
}: {
  member: StaffMember;
  me: MyStaff;
  /** What this member's role holds by default. */
  held: StaffPermission[];
  onChanged: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState("");
  const [granted, setGranted] = useState(member.granted);
  const [denied, setDenied] = useState(member.denied);
  const { withProof, dialog } = useConfirmIdentity();
  const owner = member.role === "primary_owner";
  const touchable =
    !member.isSelf && !owner && (member.role !== "backup_owner" || me.role === "primary_owner");

  const save = useMutation({
    mutationFn: () =>
      withProof(() =>
        setStaffPermissions({ data: { userId: member.userId, granted, denied, reason: why } }),
      ),
    onSuccess: async () => {
      toast.success("Permissions changed.");
      setWhy("");
      setEditing(false);
      await onChanged();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const remove = useMutation({
    mutationFn: () =>
      withProof(() => revokeStaff({ data: { userId: member.userId, reason: why } })),
    onSuccess: async ({ removed }) => {
      toast[removed ? "success" : "error"](
        removed ? "Access removed. It ends on their next request." : "They had no access.",
      );
      setWhy("");
      await onChanged();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const [stayOwner, setStayOwner] = useState(true);
  const [sure, setSure] = useState(false);
  const handOver = useMutation({
    mutationFn: () =>
      withProof(() =>
        transferOwnership({ data: { userId: member.userId, reason: why, stayOwner } }),
      ),
    onSuccess: async () => {
      toast.success(
        stayOwner
          ? "Ownership handed over. You are an Owner now."
          : "Ownership handed over. You are no longer staff.",
      );
      window.location.assign(stayOwner ? "/admin" : "/");
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const [usage, setUsage] = useState(false);

  // On = the role holds it or it was added, and it was not taken away.
  const on = (id: StaffPermission) =>
    (held.includes(id) || granted.includes(id)) && !denied.includes(id);
  const toggle = (id: StaffPermission) => {
    const turnOff = on(id);
    // Only ever a difference from the role: adding what it lacks, removing what it has.
    setGranted((list) =>
      !turnOff && !held.includes(id) ? [...list, id] : list.filter((p) => p !== id),
    );
    setDenied((list) =>
      turnOff && held.includes(id) ? [...list, id] : list.filter((p) => p !== id),
    );
  };

  return (
    <li className="py-3">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-foreground">
            {member.email ?? member.userId}
            {member.isSelf ? " (you)" : ""}
          </span>
          <span className="block text-[13px] text-muted-foreground">
            {STAFF_ROLE_NAMES[member.role]}
            {member.granted.length || member.denied.length ? " · with changes" : ""}
          </span>
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            className={button}
            aria-expanded={usage}
            onClick={() => setUsage((value) => !value)}
          >
            Usage
          </button>
          {touchable ? (
            <button
              type="button"
              className={button}
              aria-expanded={editing}
              onClick={() => {
                // Every edit starts from the record as it is now, not as it was first loaded.
                if (!editing) {
                  setGranted(member.granted);
                  setDenied(member.denied);
                }
                setEditing(!editing);
              }}
            >
              Change
            </button>
          ) : null}
        </span>
      </div>
      {usage ? <StaffUsage member={member} me={me} /> : null}
      {editing && touchable ? (
        <div className="mt-3 space-y-3 rounded-md border border-border p-3">
          <p className="text-[13px] text-muted-foreground">
            Filled is what this person can do. Tap to turn one on or off; green was added to{" "}
            {STAFF_ROLE_NAMES[member.role]}, struck through was taken away from it.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {ALL_PERMISSIONS.map((permission) => {
              const added = granted.includes(permission.id) && !held.includes(permission.id);
              const removed = denied.includes(permission.id);
              return (
                <li key={permission.id}>
                  <button
                    type="button"
                    onClick={() => toggle(permission.id)}
                    aria-pressed={on(permission.id)}
                    aria-label={`${permission.name}${added ? " (added)" : removed ? " (taken away)" : ""}`}
                    className={
                      added
                        ? "rounded-full bg-success/15 px-2 py-0.5 text-xs text-success"
                        : removed
                          ? "rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive line-through"
                          : on(permission.id)
                            ? "rounded-full bg-accent px-2 py-0.5 text-xs text-foreground"
                            : "rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {permission.name}
                  </button>
                </li>
              );
            })}
          </ul>
          <Reason value={why} onChange={setWhy} label="Why" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              disabled={!ready(why) || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save permissions"}
            </button>
            <button
              type="button"
              className={`${button} text-destructive`}
              disabled={!ready(why) || remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Removing…" : "Remove access"}
            </button>
          </div>
          {me.role === "primary_owner" && member.role === "backup_owner" ? (
            <fieldset className="space-y-2 border-t border-border/50 pt-3 text-[13px]">
              <legend className="font-medium text-foreground">Make them the Primary Owner</legend>
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={stayOwner}
                  onChange={(event) => setStayOwner(event.target.checked)}
                />
                Stay an Owner myself afterwards
              </label>
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={sure}
                  onChange={(event) => setSure(event.target.checked)}
                />
                I understand {member.email ?? "they"} will hold every owner power, and only they can
                hand it back.
              </label>
              <button
                type="button"
                className={`${button} text-destructive`}
                disabled={!ready(why) || !sure || handOver.isPending}
                onClick={() => handOver.mutate()}
              >
                {handOver.isPending ? "Handing over…" : "Hand ownership over"}
              </button>
            </fieldset>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** What a member of staff used, and whether a window ever stops them: metadata only, never content. */
function StaffUsage({ member, me }: { member: StaffMember; me: MyStaff }) {
  const detail = useQuery({
    queryKey: ["admin", "customer", member.userId],
    queryFn: () => readCustomer({ data: { userId: member.userId } }),
  });
  if (!detail.data) {
    return (
      <div className="mt-2 text-[13px]">
        <Pending query={detail} loading="Loading usage…" problem="Usage could not be read." />
      </div>
    );
  }
  const { usage, unlimited, lastUsed } = detail.data;
  const owner = member.role === "primary_owner" || member.role === "backup_owner";
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-3 text-[13px]">
      <UsageSummary usage={usage} unlimited={unlimited} lastUsed={lastUsed} />
      {!member.isSelf && !owner && (me.role === "primary_owner" || me.role === "backup_owner") ? (
        <UnlimitedUse
          userId={member.userId}
          unlimited={unlimited}
          onChanged={() => void detail.refetch()}
        />
      ) : null}
    </div>
  );
}

/** One account's usage, as the console shows it everywhere. */
export function UsageSummary({
  usage,
  unlimited,
  lastUsed,
}: {
  usage: { surface: "chat" | "jarvis"; kind: string; used: number }[] | null;
  unlimited: Unlimited | null;
  lastUsed: { chat: string | null; jarvis: string | null } | null;
}) {
  if (!usage) return null;
  const when = (at: string | null) => (at ? new Date(at).toLocaleString() : "never");
  const limits = unlimited
    ? unlimited.why === "owner"
      ? "Unlimited (owner)"
      : unlimited.endsAt
        ? `Unlimited until ${new Date(unlimited.endsAt).toLocaleString()}`
        : "Unlimited until revoked"
    : "Normal limits";
  const used = usage.length
    ? usage
        .map((w) => `${w.surface === "chat" ? "Chat" : "JARVIS"} ${w.kind} ${w.used}`)
        .join(" · ")
    : "no use yet";
  return (
    <>
      <p className="text-muted-foreground">
        {limits} · {used}
      </p>
      {lastUsed ? (
        <p className="text-muted-foreground">
          Last Chat use {when(lastUsed.chat)} · last JARVIS step {when(lastUsed.jarvis)}
        </p>
      ) : null}
    </>
  );
}

/**
 * UNLIMITED USE, GIVEN OR TAKEN BACK BY AN OWNER. Until a time or until revoked;
 * the account's usage is still recorded either way, and the database refuses
 * anybody but an owner, any owner for themselves, and any change without a
 * recent code and a reason.
 */
export function UnlimitedUse({
  userId,
  unlimited,
  onChanged,
}: {
  userId: string;
  unlimited: Unlimited | null;
  onChanged: () => void;
}) {
  const { withProof, dialog } = useConfirmIdentity();
  const [why, setWhy] = useState("");
  const [until, setUntil] = useState("");
  const give = useMutation({
    mutationFn: () =>
      withProof(() =>
        grantUnlimited({
          data: { userId, until: until ? new Date(until).toISOString() : null, reason: why },
        }),
      ),
    onSuccess: () => {
      toast.success(
        until ? "Unlimited use given until then." : "Unlimited use given until revoked.",
      );
      setWhy("");
      onChanged();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const end = useMutation({
    mutationFn: () => withProof(() => revokeUnlimited({ data: { userId, reason: why } })),
    onSuccess: ({ revoked }) => {
      toast[revoked ? "success" : "error"](
        revoked ? "Back to normal limits." : "There was no unlimited use to end.",
      );
      setWhy("");
      onChanged();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <div className="space-y-2 border-t border-border/50 pt-2">
      {dialog}
      <Reason value={why} onChange={setWhy} label="Why unlimited use changes" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-muted-foreground">
          <span>Until</span>
          <input
            type="datetime-local"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            aria-label="Unlimited until (empty: until revoked)"
            className="h-7 rounded-md border border-border bg-transparent px-2 text-foreground outline-none focus-visible:border-ring"
          />
        </label>
        <button
          type="button"
          className={button}
          disabled={!ready(why) || give.isPending}
          onClick={() => give.mutate()}
        >
          {give.isPending ? "Giving…" : until ? "Give unlimited until then" : "Give unlimited use"}
        </button>
        {unlimited?.why === "grant" ? (
          <button
            type="button"
            className={`${button} text-destructive`}
            disabled={!ready(why) || end.isPending}
            onClick={() => end.mutate()}
          >
            {end.isPending ? "Ending…" : "Back to normal limits"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InviteRow({
  invite,
  onChanged,
}: {
  invite: { id: string; email: string; role: StaffRole; expiresAt: string };
  onChanged: () => Promise<unknown>;
}) {
  const [why, setWhy] = useState("");
  const [asking, setAsking] = useState(false);
  const { withProof, dialog } = useConfirmIdentity();
  const withdraw = useMutation({
    mutationFn: () =>
      withProof(() => withdrawStaffInvite({ data: { inviteId: invite.id, reason: why } })),
    onSuccess: async () => {
      toast.success("Invitation withdrawn.");
      await onChanged();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <li className="py-2">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate text-foreground">
          {invite.email} · {STAFF_ROLE_NAMES[invite.role]}
          <span className="block text-[13px] text-muted-foreground">
            Until {new Date(invite.expiresAt).toLocaleDateString()}
          </span>
        </span>
        <button type="button" className={button} onClick={() => setAsking((value) => !value)}>
          Withdraw
        </button>
      </div>
      {asking ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="min-w-[12rem] flex-1">
            <Reason value={why} onChange={setWhy} label="Why" />
          </div>
          <button
            type="button"
            className={button}
            disabled={!ready(why) || withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            {withdraw.isPending ? "Withdrawing…" : "Withdraw invitation"}
          </button>
        </div>
      ) : null}
    </li>
  );
}

/* ---------------------------------------------------------------- cases -- */

export function CasesModule({ me }: { me: MyStaff }) {
  const queryClient = useQueryClient();
  const cases = useQuery({ queryKey: ["admin", "cases"], queryFn: () => listCases() });
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <Section title="Open cases">
      <p className="mt-1 text-[13px] text-muted-foreground">
        A customer&apos;s conversations can be read only under an open case, until it closes or
        expires. The customer is told, and every read is written down.
      </p>
      {cases.data ? (
        cases.data.length ? (
          <ul className="mt-2 divide-y divide-border/50">
            {cases.data.map((kase) => (
              <li key={kase.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">
                      {kase.customerEmail ?? kase.customer}
                    </span>
                    <span className="block text-[13px] text-muted-foreground">
                      {kase.reason} · {kase.conversation?.title ?? "no conversation"} · until{" "}
                      {new Date(kase.expiresAt).toLocaleString()}
                      {kase.mine ? "" : " · read by another member of staff"}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={button}
                    aria-expanded={openId === kase.id}
                    onClick={() => setOpenId(openId === kase.id ? null : kase.id)}
                  >
                    {openId === kase.id ? "Hide" : kase.mine ? "Read" : "Manage"}
                  </button>
                </div>
                {openId === kase.id ? (
                  <CaseReader
                    caseId={kase.id}
                    conversationId={kase.mine ? (kase.conversation?.id ?? null) : null}
                    canClose={me.permissions.includes("cases.manage")}
                    onClosed={() => {
                      setOpenId(null);
                      void queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-muted-foreground">No open cases.</p>
        )
      ) : (
        <Pending query={cases} loading="Loading cases…" problem="Cases could not be read." />
      )}
    </Section>
  );
}

/** The case's one conversation, for its named reader; closing, for whoever manages cases. */
function CaseReader({
  caseId,
  conversationId: conversation,
  canClose,
  onClosed,
}: {
  caseId: string;
  conversationId: string | null;
  canClose: boolean;
  onClosed: () => void;
}) {
  const [why, setWhy] = useState("");
  const { withProof, dialog } = useConfirmIdentity();
  const messages = useQuery({
    queryKey: ["admin", "case", caseId, conversation],
    queryFn: () => readCaseConversation({ data: { caseId, conversationId: conversation! } }),
    enabled: conversation !== null,
  });
  const close = useMutation({
    mutationFn: () => withProof(() => closeCase({ data: { caseId, reason: why } })),
    onSuccess: () => {
      toast.success("Case closed. Access ended.");
      onClosed();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <div className="mt-3 rounded-md border border-border p-3">
      {dialog}
      {conversation ? (
        messages.data ? (
          <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {messages.data.map((message, index) => (
              <li key={index} className="text-[13px]">
                <span className="text-muted-foreground">
                  {message.role === "user" ? "Customer" : "OCADE"}:
                </span>{" "}
                <span className="whitespace-pre-wrap text-foreground">{message.content}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Pending
            query={messages}
            loading="Reading…"
            problem="That conversation could not be read."
          />
        )
      ) : null}
      {canClose ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="min-w-[12rem] flex-1">
            <Reason value={why} onChange={setWhy} label="Why it can close" />
          </div>
          <button
            type="button"
            className={button}
            disabled={!ready(why) || close.isPending}
            onClick={() => close.mutate()}
          >
            {close.isPending ? "Closing…" : "Close case"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- system -- */

export function SystemModule({ me }: { me: MyStaff }) {
  const health = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => readSystemHealth(),
    enabled: me.permissions.includes("health.read"),
    refetchInterval: 30_000,
  });
  return (
    <>
      {me.permissions.includes("health.read") ? (
        <Section title="System health">
          {health.data ? (
            <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([["Staff", health.data.staff]] as const).map(([name, value]) => (
                <div key={name}>
                  <dt className="text-[13px] text-muted-foreground">{name}</dt>
                  <dd className="text-lg font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Pending
              query={health}
              loading="Reading system health…"
              problem="System health could not be read."
            />
          )}
        </Section>
      ) : null}
      {me.permissions.includes("execution.manage") || me.permissions.includes("health.read") ? (
        <EmergencyControls canChange={me.permissions.includes("execution.manage")} />
      ) : null}
    </>
  );
}

const CONTROL_NAMES: Record<string, string> = {
  jarvis_agent: "New JARVIS tasks",
  jarvis_execution: "Work on customers' computers",
  jarvis_android: "Android companion",
};

/** Incident response: stop new work or all dispatch at once, with a reason, and say so. */
function EmergencyControls({ canChange }: { canChange: boolean }) {
  const controls = useQuery({
    queryKey: ["admin", "service-controls"],
    queryFn: () => readServiceControls(),
    refetchInterval: 15_000,
  });
  return (
    <Section title="Emergency pause">
      <p className="mt-1 text-[13px] text-muted-foreground">
        A pause takes effect on the next request: running steps finish or stop at their next check,
        nothing new starts, and customers see that JARVIS is paused. Every change is recorded with
        who made it and why.
      </p>
      {controls.data ? (
        <ul className="mt-2 divide-y divide-border/50">
          {controls.data.map((control) => (
            <ControlRow key={control.key} control={control} canChange={canChange} />
          ))}
        </ul>
      ) : (
        <Pending
          query={controls}
          loading="Reading the switches…"
          problem="The switches could not be read."
        />
      )}
    </Section>
  );
}

function ControlRow({
  control,
  canChange,
}: {
  control: { key: string; paused: boolean; reason: string | null; changedAt: string };
  canChange: boolean;
}) {
  const queryClient = useQueryClient();
  const [why, setWhy] = useState("");
  const [asking, setAsking] = useState(false);
  const { withProof, dialog } = useConfirmIdentity();
  const change = useMutation({
    mutationFn: () =>
      withProof(() =>
        setServiceControl({
          data: {
            key: control.key as "jarvis_agent" | "jarvis_execution" | "jarvis_android",
            pause: !control.paused,
            reason: why,
          },
        }),
      ),
    onSuccess: async (result) => {
      toast.success(result.paused ? "Paused." : "Running again.");
      setAsking(false);
      setWhy("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "service-controls"] });
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return (
    <li className="py-2">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-foreground">
          {CONTROL_NAMES[control.key] ?? control.key} · {control.paused ? "Paused" : "Running"}
          <span className="block text-[13px] text-muted-foreground">
            {new Date(control.changedAt).toLocaleString()}
            {control.reason ? ` · ${control.reason}` : ""}
          </span>
        </span>
        {canChange ? (
          <button type="button" className={button} onClick={() => setAsking((value) => !value)}>
            {control.paused ? "Resume" : "Pause"}
          </button>
        ) : null}
      </div>
      {asking ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="min-w-[12rem] flex-1">
            <Reason value={why} onChange={setWhy} label="Why" />
          </div>
          <button
            type="button"
            className={button}
            disabled={!ready(why) || change.isPending}
            onClick={() => change.mutate()}
          >
            {change.isPending ? "Changing…" : control.paused ? "Resume now" : "Pause now"}
          </button>
        </div>
      ) : null}
    </li>
  );
}

/* ---------------------------------------------------------------- audit -- */

const ACTION_NAMES: Record<string, string> = {
  remove_device: "Removed a device",
  owner_bootstrap: "Primary Owner named",
  owner_transfer: "Handed ownership over",
  staff_grant: "Gave staff access",
  staff_invite: "Invited staff",
  staff_invite_withdrawn: "Withdrew an invitation",
  staff_invite_accepted: "Invitation accepted",
  staff_permissions: "Changed staff permissions",
  staff_revoke: "Removed staff access",
  staff_sessions_ended: "Signed all staff out",
  customer_sessions_ended: "Ended a customer's sessions",
  second_factor_reset: "Turned off a customer's two-step verification",
  case_open: "Opened a case",
  case_close: "Closed a case",
  case_read: "Read a conversation under a case",
  usage_adjusted: "Gave back usage",
  account_suspended: "Suspended an account",
  account_restored: "Restored an account",
  account_deletion_started: "Began deleting an account",
  account_deleted: "Deleted an account",
  unlimited_granted: "Gave unlimited use",
  unlimited_revoked: "Ended unlimited use",
};

export function AuditModule() {
  const audit = useQuery({ queryKey: ["admin", "audit"], queryFn: () => listAudit() });
  return (
    <Section title="Audit record">
      {audit.data ? (
        audit.data.length ? (
          <ul className="mt-2 divide-y divide-border/50">
            {audit.data.map((entry) => (
              <li key={entry.id} className="py-2 text-[13px]">
                <span className="block text-foreground">
                  {ACTION_NAMES[entry.action] ?? entry.action}
                  {entry.target ? ` · ${entry.target}` : ""}
                </span>
                <span className="block text-muted-foreground">
                  {new Date(entry.at).toLocaleString()} · {entry.actor ?? "OCADE"} · {entry.reason}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-muted-foreground">Nothing recorded yet.</p>
        )
      ) : (
        <Pending
          query={audit}
          loading="Loading the record…"
          problem="The record could not be read."
        />
      )}
    </Section>
  );
}
