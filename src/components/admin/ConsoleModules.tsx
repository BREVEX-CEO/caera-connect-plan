import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { Pending } from "@/components/settings/rows";
import {
  readJarvisExecution,
  setJarvisExecution,
  type ControlKey,
  type StaffPermission,
} from "@/lib/admin/access.functions";
import {
  closeCase,
  endAllStaffSessions,
  grantStaff,
  listAudit,
  listCaseConversations,
  listCases,
  listStaff,
  messageOf,
  readCaseConversation,
  readSystemHealth,
  ready,
  revokeStaff,
  setStaffPermissions,
  STAFF_ROLE_NAMES,
  transferOwnership,
  withdrawStaffInvite,
  type MyStaff,
  type StaffMember,
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
  { id: "devices.read", name: "See devices" },
  { id: "devices.manage", name: "Remove devices" },
  { id: "tasks.read", name: "See JARVIS tasks" },
  { id: "security.read", name: "See account security" },
  { id: "sessions.manage", name: "End customer sessions" },
  { id: "grants.manage", name: "Give or take back plans" },
  { id: "execution.manage", name: "Pause or resume JARVIS" },
  { id: "health.read", name: "See system health" },
  { id: "audit.read", name: "See the audit record" },
  { id: "staff.manage", name: "Manage staff" },
  { id: "cases.read", name: "Read conversations under a case" },
  { id: "cases.manage", name: "Open and close cases" },
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
  const handOver = useMutation({
    mutationFn: () =>
      withProof(() => transferOwnership({ data: { userId: member.userId, reason: why } })),
    onSuccess: async () => {
      toast.success("Ownership handed over. You are the Backup Owner now.");
      window.location.reload();
    },
    onError: (error) => toast.error(messageOf(error)),
  });

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
        {touchable ? (
          <span className="flex gap-2">
            <button
              type="button"
              className={button}
              aria-expanded={editing}
              onClick={() => setEditing((value) => !value)}
            >
              Change
            </button>
          </span>
        ) : null}
      </div>
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
            {me.role === "primary_owner" && member.role === "backup_owner" ? (
              <button
                type="button"
                className={button}
                disabled={!ready(why) || handOver.isPending}
                onClick={() => handOver.mutate()}
              >
                {handOver.isPending ? "Handing over…" : "Hand ownership over"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
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
                      {kase.reason} · until {new Date(kase.expiresAt).toLocaleString()}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={button}
                    aria-expanded={openId === kase.id}
                    onClick={() => setOpenId(openId === kase.id ? null : kase.id)}
                  >
                    {openId === kase.id ? "Hide" : "Read"}
                  </button>
                </div>
                {openId === kase.id ? (
                  <CaseReader
                    caseId={kase.id}
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

function CaseReader({
  caseId,
  canClose,
  onClosed,
}: {
  caseId: string;
  canClose: boolean;
  onClosed: () => void;
}) {
  const [conversation, setConversation] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const { withProof, dialog } = useConfirmIdentity();
  const conversations = useQuery({
    queryKey: ["admin", "case", caseId],
    queryFn: () => listCaseConversations({ data: { caseId } }),
  });
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
      {conversations.data ? (
        <ul className="flex flex-wrap gap-1.5">
          {conversations.data.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={conversation === row.id ? `${button} bg-accent` : button}
                onClick={() => setConversation(row.id)}
              >
                {row.title || "Untitled"}
              </button>
            </li>
          ))}
          {conversations.data.length === 0 ? (
            <li className="text-[13px] text-muted-foreground">No conversations.</li>
          ) : null}
        </ul>
      ) : (
        <Pending
          query={conversations}
          loading="Loading conversations…"
          problem="Conversations could not be read."
        />
      )}
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

const CONTROL_NAMES: Record<ControlKey, string> = {
  jarvis_execution: "All device work",
  jarvis_agent: "Device Agent",
  jarvis_extension: "Browser extension",
};

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
              {(
                [
                  ["Computers online", health.data.devicesOnline],
                  ["Tasks working", health.data.tasksRunning],
                  ["Tasks waiting", health.data.tasksWaiting],
                  ["Computers waiting to connect", health.data.pendingEnrollments],
                  ["Staff", health.data.staff],
                ] as const
              ).map(([name, value]) => (
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
      <EmergencyStop canChange={me.permissions.includes("execution.manage")} />
    </>
  );
}

/**
 * THE EMERGENCY STOP FOR JARVIS DEVICE WORK. One switch per family, a reason on
 * the record, and a recent second factor, all enforced by the database.
 */
function EmergencyStop({ canChange }: { canChange: boolean }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const state = useQuery({
    queryKey: ["admin", "jarvis-execution"],
    queryFn: () => readJarvisExecution(),
  });
  const { withProof, dialog } = useConfirmIdentity();
  const change = useMutation({
    mutationFn: (input: { key: ControlKey; paused: boolean }) =>
      withProof(() => setJarvisExecution({ data: { ...input, reason } })),
    onSuccess: async ({ paused }, { key }) => {
      toast.success(`${CONTROL_NAMES[key]}: ${paused ? "paused" : "running"}.`);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "jarvis-execution"] });
    },
    onError: (error: unknown) => toast.error(messageOf(error)),
  });
  if (!state.data) {
    // The emergency stop never silently disappears: loading and failure are said, with a retry.
    return (
      <Section title="JARVIS device work">
        <Pending
          query={state}
          loading="Reading whether JARVIS device work is running…"
          problem="The emergency stop could not be read. Try again before relying on it."
        />
      </Section>
    );
  }
  const go = ready(reason) && !change.isPending;
  return (
    <Section title="JARVIS device work">
      {dialog}
      <ul className="mt-2 divide-y divide-border/50">
        {state.data.map((control) => (
          <li key={control.key} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-foreground">{CONTROL_NAMES[control.key]}</span>
              {control.reason ? (
                <span className="block truncate text-[13px] text-muted-foreground">
                  Last change: {control.reason}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className={
                  control.paused
                    ? "rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive"
                    : "rounded-full bg-success/15 px-2 py-0.5 text-xs text-success"
                }
              >
                {control.paused ? "Paused" : "Running"}
              </span>
              {canChange ? (
                <button
                  type="button"
                  disabled={!go}
                  onClick={() => change.mutate({ key: control.key, paused: !control.paused })}
                  aria-label={`${control.paused ? "Resume" : "Pause"} ${CONTROL_NAMES[control.key]}`}
                  className={
                    control.paused
                      ? "h-7 rounded-md border border-border px-2 disabled:opacity-50"
                      : "h-7 rounded-md border border-destructive/50 px-2 text-destructive disabled:opacity-50"
                  }
                >
                  {change.isPending && change.variables?.key === control.key
                    ? "Changing…"
                    : control.paused
                      ? "Resume"
                      : "Pause"}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {canChange ? (
        <div className="mt-2">
          <Reason value={reason} onChange={setReason} label="Why" />
        </div>
      ) : null}
    </Section>
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
