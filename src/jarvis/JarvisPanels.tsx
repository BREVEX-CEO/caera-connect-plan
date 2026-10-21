/** The rail's Conversations, and Devices & Access in Settings. */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { deleteConversation } from "@/lib/ocade.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { readAgentRelease } from "@/lib/agent/release.functions";
import { useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { FINISHED, hostOf, type Capability, TASK_STATUS } from "./protocol";
import { isAllowed } from "./permissions";
import { readPreferences, useJarvisPreferences, writePreferences } from "./preferences";
import { useSession } from "@/lib/session";
import {
  approveJarvisDevice,
  declineJarvisDevice,
  forgetJarvis,
  readJarvisEnrollment,
  readJarvisState,
  removeJarvisSchedule,
  revokeJarvisDevice,
  setJarvisBackground,
  setJarvisPermission,
  updateJarvisTask,
  type JarvisState,
} from "./jarvis.functions";

export type Section = "conversations" | "devices";

const TITLES: Record<Section, string> = {
  conversations: "Conversations",
  devices: "Devices",
};

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

async function decide(
  capability: string,
  allowed: boolean | null,
  deviceId: string | null,
  done: () => void,
) {
  try {
    await setJarvisPermission({
      data: { capability: capability as Capability, allowed, deviceId },
    });
    done();
  } catch {
    toast.error("That permission could not be saved.");
  }
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={cn("flex items-start gap-3 py-2 text-sm", disabled && "opacity-50")}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-info"
      />
      <span className="flex-1">
        {label}
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

const DEVICE_STATUS = {
  ready: { label: "Ready", tone: "bg-success/15 text-success" },
  busy: { label: "Working", tone: "bg-info/15 text-info" },
  needs_permission: { label: "Needs permission", tone: "bg-muted text-foreground" },
  offline: { label: "Offline", tone: "bg-muted text-muted-foreground" },
} as const;

export function SectionPanel({
  section,
  state,
  signedIn,
  activeConversation,
  target,
  onTarget,
  onClose,
  onOpenConversation,
  onChanged,
}: {
  section: Section;
  state: JarvisState | undefined;
  signedIn: boolean;
  activeConversation: string | null;
  /** The computer new tasks go to, chosen by the person. */
  target: string | null;
  onTarget: (deviceId: string | null) => void;
  onClose: () => void;
  onOpenConversation: (id: string | null) => void;
  onChanged: () => void;
}) {
  return (
    <aside
      aria-label={TITLES[section]}
      className="flex h-full w-72 max-w-[80vw] flex-col border-r border-border/60 bg-background/90"
    >
      <div className="flex h-12 items-center justify-between px-3">
        <h2 className="text-sm font-medium">{TITLES[section]}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="ocade-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3 text-sm">
        {!signedIn ? (
          <p className="text-muted-foreground">
            Sign in to see your {TITLES[section].toLowerCase()}.
          </p>
        ) : !state ? null : (
          <SectionBody
            section={section}
            state={state}
            activeConversation={activeConversation}
            target={target}
            onTarget={onTarget}
            onOpenConversation={onOpenConversation}
            onChanged={onChanged}
          />
        )}
      </div>
    </aside>
  );
}

function SectionBody({
  section,
  state,
  activeConversation,
  target,
  onTarget,
  onOpenConversation,
  onChanged,
}: {
  section: Section;
  state: JarvisState;
  activeConversation: string | null;
  target: string | null;
  onTarget: (deviceId: string | null) => void;
  onOpenConversation: (id: string | null) => void;
  onChanged: () => void;
}) {
  const [opened, setOpened] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [find, setFind] = useState("");

  // Reminders and scheduled work, removable here: their record lives on the server.
  const REPEATS: Record<string, string> = {
    none: "once",
    daily: "every day",
    weekdays: "every weekday",
    weekly: "every week",
  };
  const scheduled = state.schedules.length ? (
    <section aria-label="Scheduled" className="mb-3">
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">Scheduled</h3>
      <ul className="flex flex-col gap-1">
        {state.schedules.map((s) => (
          <li key={s.id} className="flex items-start gap-2 border-b border-border/40 py-1">
            <div className="min-w-0 flex-1">
              <p className="break-words">{s.what}</p>
              <p className="text-xs text-muted-foreground">
                {s.device_id
                  ? `On ${state.devices.find((d) => d.id === s.device_id)?.name ?? "a computer"}`
                  : "Reminder"}
                {` · ${when(s.next_at)} · ${REPEATS[s.repeat] ?? s.repeat}`}
              </p>
              {s.last_outcome && s.last_outcome !== "Started" && s.last_outcome !== "Reminded" ? (
                <p className="text-xs text-muted-foreground">Last time: {s.last_outcome}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={`Remove ${s.what}`}
              disabled={removing === s.id}
              onClick={() => {
                setRemoving(s.id);
                void removeJarvisSchedule({ data: { id: s.id } })
                  .then(onChanged)
                  .catch(() => toast.error("That could not be removed. Try again."))
                  .finally(() => setRemoving(null));
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

  if (section === "conversations") {
    // Tasks live in their conversations: each row names its latest task and
    // how it stands, so there is no second list to keep in step.
    const latestTask = (conversationId: string) =>
      state.tasks.find((t) => t.conversation_id === conversationId);
    const list = state.conversations
      .filter((c) => !c.archived)
      .map((c) => {
        const task = latestTask(c.id);
        return {
          id: c.id,
          title: c.title,
          sub: task
            ? `${task.title} · ${TASK_STATUS[task.status].toLowerCase()} · ${when(task.updated_at)}`
            : when(c.updated_at),
          open: c.id,
          result: task && FINISHED.includes(task.status) ? task.result : null,
        };
      });
    if (list.length === 0) {
      return (
        <>
          {scheduled}
          <p className="text-muted-foreground">Nothing here yet.</p>
        </>
      );
    }
    const wanted = find.trim().toLowerCase();
    const shown = wanted
      ? list.filter((item) => `${item.title} ${item.sub}`.toLowerCase().includes(wanted))
      : list;
    return (
      <>
        {scheduled}
        <input
          type="search"
          value={find}
          onChange={(event) => setFind(event.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="mb-2 h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {shown.length === 0 ? (
          <p className="text-muted-foreground">No conversation matches.</p>
        ) : null}
        <ul className="flex flex-col gap-0.5">
          {shown.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenConversation(item.open)}
                aria-current={item.open === activeConversation ? "true" : undefined}
                className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-accent"
              >
                <span className="block truncate">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.sub}</span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${item.title}`}
                onClick={() => {
                  if (!window.confirm("Delete this conversation and its tasks for good?")) return;
                  void deleteConversation({ data: { id: item.id } })
                    .then(() => {
                      onChanged();
                      if (item.id === activeConversation) onOpenConversation(null);
                    })
                    .catch(() => toast.error("That conversation could not be deleted."));
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
              {item.result ? (
                opened === item.id ? (
                  <p className="w-full whitespace-pre-wrap px-2 pb-1 text-xs">{item.result}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpened(item.id)}
                    className="px-2 pb-1 text-xs underline underline-offset-2"
                  >
                    Show result
                  </button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      </>
    );
  }

  // Apps and websites live under Devices (PLAN.md section M): rarely changed, so
  // not a rail entry of their own. The same rules, the same controls.
  const appsAndSites = (
    <>
      <p className="mb-2 text-xs text-muted-foreground">
        Websites JARVIS has used or you have set. Turning one off stops JARVIS from opening it.
      </p>
      {state.sites.length === 0 ? <p className="text-muted-foreground">No websites yet.</p> : null}
      {state.sites.map((site) => (
        <Toggle
          key={site}
          label={site}
          checked={
            state.permissions.find((p) => p.capability === `site:${site}` && p.device_id === null)
              ?.allowed !== false
          }
          onChange={(allowed) => void decide(`site:${site}`, allowed, null, onChanged)}
        />
      ))}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("site") as HTMLInputElement;
          const host = hostOf(input.value);
          if (!host || !/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(host)) {
            toast.error("Enter a website address, such as example.com.");
            return;
          }
          void decide(`site:${host}`, true, null, onChanged);
          input.value = "";
        }}
      >
        <label htmlFor="jarvis-allow-site" className="sr-only">
          Website to allow
        </label>
        <input
          id="jarvis-allow-site"
          name="site"
          placeholder="example.com"
          className="min-w-0 flex-1 rounded-md border border-border/60 bg-transparent px-2 py-1"
        />
        <button type="submit" className="rounded-md border border-border px-2 py-1 text-xs">
          Allow site
        </button>
      </form>
      <p className="mt-1 text-xs text-muted-foreground">
        Addresses on your own network need your permission first.
      </p>
    </>
  );

  // Devices
  const devices = state.devices.filter((d) => !d.revoked_at && d.last_seen_at);
  const openTasks = state.tasks.filter((t) => !FINISHED.includes(t.status) && t.device_id);
  return (
    <>
      <h3 className="mb-1 text-sm font-medium">Remote PC</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        What JARVIS is doing on your computers, from any device. Each computer does one task at a
        time.
      </p>
      {openTasks.length === 0 ? (
        <p className="mb-3 text-muted-foreground">No computer is working on a task.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {openTasks.map((t) => {
            const on = devices.find((d) => d.id === t.device_id);
            return (
              <li key={t.id} className="rounded-md border border-border/60 p-2">
                <p className="truncate font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {on ? `${on.name} · ${on.online ? "Online" : "Offline"} · ` : ""}
                  {t.status.replace("_", " ")} · step{" "}
                  {Math.min(t.current_step + 1, Math.max(1, t.plan.length))} of{" "}
                  {Math.max(1, t.plan.length)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenConversation(t.conversation_id)}
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void updateJarvisTask({ data: { id: t.id, status: "stopped" } })
                        .then(onChanged)
                        .catch(() => toast.error("That task could not be stopped."))
                    }
                    className="rounded-md bg-foreground px-2 py-1 text-xs text-background"
                  >
                    Stop
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <h3 className="mb-1 text-sm font-medium">Connected</h3>
      {devices.length === 0 ? (
        <p className="text-muted-foreground">
          No device is connected. Browser tasks run on a connected computer.
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {devices.map((d) => (
          <li key={d.id} className="rounded-md border border-border/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-medium">{d.name}</p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                  DEVICE_STATUS[d.status].tone,
                )}
              >
                {DEVICE_STATUS[d.status].label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {d.status === "needs_permission"
                ? "Turn on what JARVIS may do below"
                : d.status === "offline"
                  ? d.kind === "android"
                    ? "Open OCADE on the phone"
                    : "Open the OCADE Device Agent on it"
                  : "Can work now"}
              {d.platform ? ` · ${d.platform}` : ""}
              {/* Two computers with one name (a reinstall) are told apart by when each was last here. */}
              {d.status === "offline" && d.last_seen_at
                ? ` · last seen ${new Date(d.last_seen_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                : ""}
            </p>
            {devices.length > 1 ? (
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="jarvis-target"
                  checked={target === d.id}
                  onChange={() => onTarget(d.id)}
                />
                New tasks run on this {d.kind === "android" ? "phone" : "computer"}
              </label>
            ) : null}
            {d.kind === "android" ? null : (
              <>
                <Toggle
                  label="Browser control"
                  checked={isAllowed(state.permissions, "browser", d.id)}
                  onChange={(allowed) => void decide("browser", allowed, d.id, onChanged)}
                />
                <Toggle
                  label="Use my own browser"
                  hint={d.capabilities.browser_real ? undefined : "Not authorized on this device"}
                  disabled={!d.capabilities.browser_real}
                  checked={isAllowed(state.permissions, "browser_real", d.id)}
                  onChange={(allowed) => void decide("browser_real", allowed, d.id, onChanged)}
                />
              </>
            )}
            {COMPUTER_TOGGLES.map(([capability, label, hint]) => (
              <Toggle
                key={capability}
                label={label}
                hint={
                  d.capabilities[capability]
                    ? hint
                    : d.kind === "android"
                      ? "Not available on this phone"
                      : "Not available on this computer"
                }
                disabled={!d.capabilities[capability]}
                checked={isAllowed(state.permissions, capability, d.id)}
                onChange={(allowed) => void decide(capability, allowed, d.id, onChanged)}
              />
            ))}
            {d.kind === "agent" ? (
              <Toggle
                label="Background Mode"
                hint="This computer keeps working on its task after you close OCADE here. You can watch or stop it from any device, and anything that needs you waits for you."
                checked={d.background_enabled}
                onChange={(enabled) =>
                  void setJarvisBackground({ data: { id: d.id, enabled } })
                    .then(onChanged)
                    .catch(() => toast.error("That could not be saved."))
                }
              />
            ) : null}
            {d.kind === "agent" ? (
              <Toggle
                label="Scheduled work"
                hint={
                  d.background_enabled
                    ? "JARVIS may start work you scheduled, on its own, at the time you chose. Anything that needs you still waits for you."
                    : "Needs Background Mode on this computer."
                }
                disabled={!d.background_enabled}
                checked={d.background_enabled && isAllowed(state.permissions, "autonomous", d.id)}
                onChange={(allowed) => void decide("autonomous", allowed, d.id, onChanged)}
              />
            ) : null}
            {removing === d.id ? (
              <div role="alertdialog" aria-label={`Remove ${d.name}`} className="mt-2 text-xs">
                <p>
                  Remove {d.name}? It stops working with OCADE at once
                  {openTasks.some((t) => t.device_id === d.id) ? " and its task stops" : ""}.
                </p>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRemoving(null);
                      if (target === d.id) onTarget(null);
                      void revokeJarvisDevice({ data: { id: d.id } })
                        .then(onChanged)
                        .catch(() => toast.error("That device could not be removed."));
                    }}
                    className="rounded-md bg-destructive px-2 py-1 text-destructive-foreground"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(null)}
                    className="rounded-md border border-border px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRemoving(d.id)}
                className="mt-2 text-xs text-destructive underline underline-offset-2"
              >
                Remove device
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-md border border-border/60 p-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Connect a computer</p>
        <p className="mt-1">
          Start the OCADE Device Agent on the computer. It opens OCADE here so you can confirm it
          with one click — no codes or passwords. Each computer gets its own key, and you can remove
          it at any time.
        </p>
        <AgentDownload />
      </div>
      <h3 className="mb-1 mt-4 text-sm font-medium">Apps and websites</h3>
      {appsAndSites}
    </>
  );
}

/**
 * The installer, offered only when one is really published. Nothing here links
 * to a file that is not there, and an installer Windows cannot yet name the
 * publisher of is said to be one.
 */
function AgentDownload() {
  const release = useQuery({
    queryKey: ["agent", "release"],
    queryFn: () => readAgentRelease(),
    staleTime: 10 * 60_000,
  });
  if (release.isPending) return <p className="mt-1">Checking for the installer…</p>;
  if (release.isError) {
    return (
      <p className="mt-1">
        OCADE could not check for the installer.{" "}
        <button
          type="button"
          onClick={() => void release.refetch()}
          className="text-foreground underline underline-offset-2"
        >
          Try again
        </button>
      </p>
    );
  }
  if (!release.data?.windows) {
    return <p className="mt-1">The installer for Windows and macOS is not published yet.</p>;
  }
  return (
    <>
      <a
        href={release.data.windows}
        download
        className="mt-2 inline-flex h-8 items-center rounded-md bg-foreground px-3 text-xs font-medium text-background"
      >
        Get the Device Agent for Windows
      </a>
      <p className="mt-1">
        Version {release.data.version}. It starts with Windows and keeps itself up to date.
        {release.data.publisherVerified
          ? ""
          : " Windows may say the publisher is not verified yet; choose More info, then Run anyway."}{" "}
        The macOS installer is not published yet.
      </p>
    </>
  );
}

/** Per-computer capabilities, each off until the person turns it on for that computer. */
const COMPUTER_TOGGLES: [Capability, string, string][] = [
  ["apps", "Open apps", "Apps this computer found. Terminals and system tools ask first."],
  ["files", "Files in the workspace", "Only inside the folder chosen on the computer."],
  [
    "terminal",
    "Run commands in the work folder",
    "Commands run with your access to that folder. Publishing, deleting or installing asks first.",
  ],
  ["screen", "See the screen", "Used when nothing more direct works."],
  ["computer_control", "Mouse and keyboard", "Your own input pauses JARVIS until you continue."],
];

/**
 * Browser only, or the whole PC: one choice over each computer's own permissions above
 * (apps, files, commands, screen, mouse and keyboard), which the server still enforces per
 * step. High-impact steps (deleting, installing, publishing, paying) ask either way.
 */
export function ScopeToggle({
  state,
  onChanged,
}: {
  state: JarvisState | undefined;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const computers = (state?.devices ?? []).filter((d) => d.kind !== "android");
  const usable = (d: (typeof computers)[number]) =>
    COMPUTER_TOGGLES.filter(([capability]) => d.capabilities[capability]).map(([c]) => c);
  if (!state || !computers.some((d) => usable(d).length)) return null;
  const whole = computers.every((d) =>
    usable(d).every((capability) => isAllowed(state.permissions, capability, d.id)),
  );
  const choose = async (next: boolean) => {
    if (next === whole || saving) return;
    setSaving(true);
    try {
      for (const d of computers)
        for (const capability of usable(d))
          await setJarvisPermission({ data: { capability, allowed: next, deviceId: d.id } });
    } catch {
      toast.error("That could not be saved. Try again.");
    } finally {
      setSaving(false);
      onChanged();
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label="Where JARVIS may work"
      className="inline-flex rounded-full border border-border p-0.5 text-xs"
    >
      {[
        { label: "Browser only", value: false },
        { label: "Whole PC", value: true },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={whole === option.value}
          disabled={saving}
          onClick={() => void choose(option.value)}
          className={cn(
            "h-7 rounded-full px-3 transition-colors duration-150 disabled:opacity-50",
            whole === option.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Devices & Access, in Settings: what JARVIS may do, its memories, and each computer and its
 * own permissions. Read from the same JARVIS record the workspace shows.
 */
export function JarvisAccess() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const prefs = useJarvisPreferences();
  const access = useQuery({
    queryKey: ["jarvis", "state", user?.id ?? ""],
    queryFn: () => readJarvisState({ data: { maintain: false } }),
    enabled: Boolean(user),
  });
  const state = access.data;
  const onChanged = () => void queryClient.invalidateQueries({ queryKey: ["jarvis", "state"] });
  if (!state) {
    return access.isError ? (
      <p className="text-sm text-muted-foreground">Devices and access could not be loaded.</p>
    ) : null;
  }
  const rows = state.permissions;
  const set = (capability: Capability, allowed: boolean) =>
    void decide(capability, allowed, null, onChanged);
  return (
    <div className="text-sm">
      <section aria-label="What JARVIS may do" className="mb-4">
        <h3 className="mb-1 text-sm font-medium">What JARVIS may do</h3>

        <Toggle
          label="OCADE JARVIS"
          hint="Turn off to stop every JARVIS task and action."
          checked={isAllowed(rows, "master")}
          onChange={(v) => set("master", v)}
        />
        <Toggle
          label="Browser control"
          checked={isAllowed(rows, "browser")}
          onChange={(v) => set("browser", v)}
        />
        <Toggle
          label="Use my own browser"
          hint="Only on devices where you started your browser for JARVIS."
          checked={isAllowed(rows, "browser_real")}
          onChange={(v) => set("browser_real", v)}
        />
        <Toggle
          label="Memory"
          hint="Let JARVIS remember preferences you tell it. Separate from Chat."
          checked={isAllowed(rows, "memory")}
          onChange={(v) => set("memory", v)}
        />
        {state.memories.length ? (
          <section aria-label="Saved memories" className="mt-1">
            <h3 className="mb-1 text-xs font-medium text-muted-foreground">Saved memories</h3>
            <ul className="flex flex-col gap-1">
              {state.memories.map((memory) => (
                <li
                  key={memory.id}
                  className="flex items-start gap-2 border-b border-border/40 py-1"
                >
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs">
                    {memory.content}
                  </p>
                  <button
                    type="button"
                    aria-label={`Forget ${memory.content.slice(0, 40)}`}
                    onClick={() =>
                      void forgetJarvis({ data: { id: memory.id } })
                        .then(onChanged)
                        .catch(() => toast.error("That memory could not be removed."))
                    }
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          JARVIS never makes purchases and asks before anything sensitive.
        </p>
      </section>
      <section aria-label="Devices">
        <SectionBody
          section="devices"
          state={state}
          activeConversation={null}
          target={prefs.target}
          onTarget={(target) => writePreferences({ ...readPreferences(), target })}
          onOpenConversation={() => undefined}
          onChanged={onChanged}
        />
      </section>
    </div>
  );
}

/**
 * One click to connect a device the person is setting up right now. The
 * fingerprint is shown so it can be compared with the one the device shows;
 * "Not mine" deletes the request.
 */
export function ConnectDevice({
  id,
  onDone,
}: {
  id: string;
  onDone: (connected: boolean) => void;
}) {
  const request = useQuery({
    queryKey: ["jarvis", "enrollment", id],
    queryFn: () => readJarvisEnrollment({ data: { id } }),
  });
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const { withProof, dialog } = useConfirmIdentity();
  const self = useRef<HTMLElement>(null);
  useModalFocus(self, true);
  const row = request.data;
  const device = row?.kind === "android" ? "phone" : "computer";
  const connect = () => {
    setBusy(true);
    void withProof(() => approveJarvisDevice({ data: { id, ...(code ? { code } : {}) } }))
      .then((out) => {
        if (out.ok) return onDone(true);
        toast.error(out.message);
        // It may have expired while the code was being typed: show that, not a dead Connect.
        void request.refetch();
      })
      .catch((cause: unknown) =>
        toast.error(cause instanceof Error ? cause.message : "The device could not be connected."),
      )
      .finally(() => setBusy(false));
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      {dialog}
      <section
        ref={self}
        role="dialog"
        aria-modal="true"
        aria-label="Connect a device"
        className="w-full max-w-sm rounded-xl bg-background p-4 text-sm"
      >
        {request.isLoading ? (
          <p className="text-muted-foreground">Checking the request…</p>
        ) : request.isError ? (
          <>
            <p>OCADE could not check this connection request just now.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void request.refetch()}
                className="rounded-md border border-border px-3 py-1.5"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => onDone(false)}
                className="rounded-md border border-border px-3 py-1.5"
              >
                Close
              </button>
            </div>
          </>
        ) : !row ? (
          <>
            <p>This connection request has expired or was already used.</p>
            <p className="mt-2 text-muted-foreground">
              Ask again from the device: on a computer, the OCADE icon near the clock, then Connect
              this computer; on a phone, the OCADE app, then Set up OCADE.
            </p>
            <button
              type="button"
              onClick={() => onDone(false)}
              className="mt-3 rounded-md border border-border px-3 py-1.5"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-medium">Connect “{row.name}”?</h2>
            <p className="mt-2 text-muted-foreground">
              {row.platform ? `${row.platform} · ` : ""}
              It will run JARVIS tasks you start, within the permissions you set. Only connect a{" "}
              {device} you are setting up now.
            </p>
            {row.fingerprint ? (
              <p className="mt-2">
                Check that it shows{" "}
                <span className="font-mono" data-testid="device-fingerprint">
                  {row.fingerprint}
                </span>
                .
              </p>
            ) : (
              <label className="mt-2 block">
                <span>
                  This request came from another network. Type the fingerprint your {device} shows.
                  If somebody sent you this link or a code, choose Not mine.
                </span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.slice(0, 40))}
                  aria-label="Fingerprint the device shows"
                  placeholder="0000-0000-0000-0000"
                  autoComplete="off"
                  className="mt-2 h-9 w-full rounded-md border border-border bg-transparent px-2 font-mono uppercase text-foreground outline-none focus-visible:border-ring"
                />
              </label>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy || (!row.fingerprint && code.replace(/[^0-9a-f]/gi, "").length < 16)}
                onClick={connect}
                className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-60"
              >
                Connect
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  // Closed only once the refusal is saved: a failed one stays here to try again
                  // (PLAN Phase 16 V13), and a second click cannot send it twice.
                  setBusy(true);
                  void declineJarvisDevice({ data: { id } }).then(
                    () => onDone(false),
                    (cause: unknown) => {
                      setBusy(false);
                      toast.error(
                        cause instanceof Error
                          ? cause.message
                          : "That could not be refused just now. Try again.",
                      );
                    },
                  );
                }}
                className="rounded-md px-3 py-1.5 hover:bg-accent"
              >
                Not mine
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
