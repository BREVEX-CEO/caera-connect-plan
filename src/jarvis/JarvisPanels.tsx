/** The rail's sections, the Permissions drawer and the graph node panel. */
import { Fragment, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { deleteConversation } from "@/lib/ocade.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FINISHED, hostOf, type Capability } from "./protocol";
import { isAllowed } from "./permissions";
import type { GraphNode } from "./graph";
import {
  approveJarvisDevice,
  declineJarvisDevice,
  forgetJarvis,
  readJarvisEnrollment,
  revokeJarvisDevice,
  setJarvisBackground,
  setJarvisPermission,
  updateJarvisTask,
  type JarvisState,
} from "./jarvis.functions";

export type Section = "conversations" | "tasks" | "activity" | "apps" | "devices";

const TITLES: Record<Section, string> = {
  conversations: "Conversations",
  tasks: "Tasks",
  activity: "Activity",
  apps: "Allowed Apps",
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
        className="mt-0.5 h-4 w-4 accent-current"
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

  if (section === "conversations" || section === "tasks") {
    const list =
      section === "conversations"
        ? state.conversations
            .filter((c) => !c.archived)
            .map((c) => ({
              id: c.id,
              title: c.title,
              sub: when(c.updated_at),
              open: c.id,
              result: null as string | null,
            }))
        : state.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            sub: FINISHED.includes(t.status)
              ? `${t.status.replace("_", " ")} · ${when(t.updated_at)}`
              : `${t.status.replace("_", " ")} · step ${Math.min(t.current_step + 1, Math.max(1, t.plan.length))} of ${Math.max(1, t.plan.length)}`,
            open: t.conversation_id,
            result: t.result,
          }));
    if (list.length === 0) {
      return <p className="text-muted-foreground">Nothing here yet.</p>;
    }
    return (
      <ul className="flex flex-col gap-0.5">
        {list.map((item) => (
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
            {section === "conversations" ? (
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
            ) : null}
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
    );
  }

  if (section === "activity") {
    return (
      <>
        <p className="mb-2 text-xs text-muted-foreground">
          Detailed activity is kept for 90 days. Task results stay.
        </p>
        {state.activity.length === 0 ? (
          <p className="text-muted-foreground">No activity yet.</p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {state.activity.map((a) => (
            <li key={a.id} className="border-b border-border/40 py-1">
              <p>{a.summary}</p>
              <p className="text-xs text-muted-foreground">
                {a.status === "note" ? "" : `${a.status.replace("_", " ")} · `}
                {when(a.created_at)}
              </p>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (section === "apps") {
    return (
      <>
        <p className="mb-2 text-xs text-muted-foreground">
          Websites JARVIS has used or you have set. Turning one off stops JARVIS from opening it.
        </p>
        {state.sites.length === 0 ? (
          <p className="text-muted-foreground">No websites yet.</p>
        ) : null}
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
        <h3 className="mt-4 text-sm font-medium">Apps on your computers</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Always opens without asking. Ask waits for you. Never is refused.
        </p>
        {state.apps.every((group) => group.apps.length === 0) ? (
          <p className="text-muted-foreground">No computer has reported its apps yet.</p>
        ) : null}
        {state.apps
          .filter((group) => group.apps.length > 0)
          .map((group) => (
            <section key={group.deviceId} aria-label={group.deviceName} className="mb-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{group.deviceName}</p>
              <ul className="flex flex-col gap-1">
                {group.apps.map((app) => {
                  const id = `app-${group.deviceId}-${app.name}`;
                  return (
                    <li key={app.name} className="flex items-center gap-2">
                      <label htmlFor={id} className="min-w-0 flex-1 truncate">
                        {app.name}
                      </label>
                      <select
                        id={id}
                        value={app.rule}
                        onChange={(event) =>
                          void decide(
                            `app:${app.name.toLowerCase()}`,
                            event.target.value === "always"
                              ? true
                              : event.target.value === "never"
                                ? false
                                : null,
                            group.deviceId,
                            onChanged,
                          )
                        }
                        className="rounded-md border border-border/60 bg-background px-1 py-0.5 text-xs"
                      >
                        <option value="always">Always</option>
                        <option value="ask">Ask</option>
                        <option value="never">Never</option>
                      </select>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </>
    );
  }

  // Devices
  const devices = state.devices.filter((d) => !d.revoked_at && d.last_seen_at);
  const agentCount = devices.filter((d) => d.kind === "agent").length;
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
                  ? "Open the OCADE Device Agent on it"
                  : "Can work now"}
              {d.platform ? ` · ${d.platform}` : ""}
              {d.kind === "extension" ? " · Browser extension" : ""}
            </p>
            {d.kind === "agent" && agentCount > 1 ? (
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="jarvis-target"
                  checked={target === d.id}
                  onChange={() => onTarget(d.id)}
                />
                New tasks run on this computer
              </label>
            ) : null}
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
            {d.kind === "agent"
              ? COMPUTER_TOGGLES.map(([capability, label, hint]) => (
                  <Toggle
                    key={capability}
                    label={label}
                    hint={d.capabilities[capability] ? hint : "Not available on this computer"}
                    disabled={!d.capabilities[capability]}
                    checked={isAllowed(state.permissions, capability, d.id)}
                    onChange={(allowed) => void decide(capability, allowed, d.id, onChanged)}
                  />
                ))
              : null}
            {d.kind === "agent" ? (
              <Toggle
                label="Background Mode"
                hint="This computer stays ready after you close OCADE here, so you can continue or stop its task from another device."
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
                label="Co-work"
                hint="Your own mouse and keyboard do not pause JARVIS on this computer."
                checked={isAllowed(state.permissions, "cowork", d.id)}
                onChange={(allowed) => void decide("cowork", allowed, d.id, onChanged)}
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
        <p className="mt-1">The signed installer for Windows and macOS is not published yet.</p>
      </div>
    </>
  );
}

const UNAVAILABLE: [Capability, string][] = [
  ["camera", "Camera"],
  ["messaging", "Messaging"],
];

/** Per-computer capabilities, each off until the person turns it on for that computer. */
const COMPUTER_TOGGLES: [Capability, string, string][] = [
  ["apps", "Open apps", "Only apps this computer found; Allowed Apps decides which."],
  ["files", "Files in the workspace", "Only inside the folder chosen on the computer."],
  ["terminal", "Run commands in the workspace", "Publishing, deleting or installing asks first."],
  ["screen", "See the screen", "Used when nothing more direct works."],
  ["computer_control", "Mouse and keyboard", "Your own input pauses JARVIS until you continue."],
];

export function PermissionsDrawer({
  state,
  signedIn,
  accent,
  onAccent,
  onClose,
  onChanged,
}: {
  state: JarvisState | undefined;
  signedIn: boolean;
  accent: string | null;
  onAccent: (accent: string | null) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows = state?.permissions ?? [];
  const set = (capability: Capability, allowed: boolean) =>
    void decide(capability, allowed, null, onChanged);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close permissions"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Permissions"
        className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto bg-background p-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-medium">Permissions</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {signedIn && state ? (
          <>
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
            <p className="mt-2 text-xs text-muted-foreground">
              Mode: Smart. JARVIS never makes purchases and asks before sensitive submissions.
            </p>
            <h3 className="mt-4 text-sm font-medium">Not available yet</h3>
            <ul className="text-sm text-muted-foreground">
              {UNAVAILABLE.map(([key, label]) => (
                <li key={key}>{label}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sign in to manage what JARVIS may do.</p>
        )}
        <h3 className="mt-4 text-sm font-medium">Orb colour</h3>
        <div className="mt-1 flex items-center gap-2">
          <label htmlFor="jarvis-accent" className="sr-only">
            Orb colour
          </label>
          <input
            id="jarvis-accent"
            type="color"
            value={accent ?? "#ffffff"}
            onChange={(event) => onAccent(event.target.value)}
            className="h-8 w-12 rounded border border-border/60 bg-transparent"
          />
          <button
            type="button"
            onClick={() => onAccent(null)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Monochrome
          </button>
        </div>
      </div>
    </div>
  );
}

export function NodePanel({
  node,
  state,
  onOpen,
  onClose,
  onChanged,
}: {
  node: GraphNode;
  state: JarvisState | undefined;
  onOpen: () => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [node.id]);
  const memory =
    node.kind === "memory" ? state?.memories.find((m) => m.id === node.recordId) : undefined;
  const openable = node.kind !== "memory";
  return (
    <section
      aria-label={node.label}
      className="glass-strong absolute bottom-28 left-3 right-3 z-20 rounded-xl p-3 sm:left-auto sm:w-72"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-medium">{node.label}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {node.meta.map(([key, value]) => (
          <Fragment key={key}>
            <dt className="text-muted-foreground">{key}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {openable ? (
          <button
            type="button"
            onClick={onOpen}
            className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground"
          >
            Open
          </button>
        ) : null}
        {memory ? (
          revealed ? null : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-md px-3 py-1 text-xs hover:bg-accent"
            >
              Show saved text
            </button>
          )
        ) : null}
        {memory ? (
          <button
            type="button"
            onClick={() =>
              void forgetJarvis({ data: { id: memory.id } })
                .then(() => {
                  onChanged();
                  onClose();
                })
                .catch(() => toast.error("That memory could not be removed."))
            }
            className="rounded-md px-3 py-1 text-xs text-destructive hover:bg-accent"
          >
            Forget
          </button>
        ) : null}
      </div>
      {memory && revealed ? (
        <p className="mt-2 whitespace-pre-wrap text-xs">{memory.content}</p>
      ) : null}
    </section>
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
  const row = request.data;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Connect a device"
        className="w-full max-w-sm rounded-xl bg-background p-4 text-sm"
      >
        {request.isLoading ? (
          <p className="text-muted-foreground">Checking the request…</p>
        ) : !row ? (
          <>
            <p>This connection request has expired or was already used.</p>
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
            <h2 className="text-base font-medium">
              Connect {row.kind === "extension" ? "this browser" : `“${row.name}”`}?
            </h2>
            <p className="mt-2 text-muted-foreground">
              {row.platform ? `${row.platform} · ` : ""}
              It will run JARVIS tasks you start, within the permissions you set. Only connect a{" "}
              {row.kind === "extension" ? "browser" : "computer"} you are setting up now.
            </p>
            <p className="mt-2">
              Check that it shows{" "}
              <span className="font-mono" data-testid="device-fingerprint">
                {row.fingerprint}
              </span>
              .
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void approveJarvisDevice({ data: { id } })
                    .then((out) => {
                      if (!out.ok) toast.error(out.message);
                      onDone(out.ok);
                    })
                    .catch(() => toast.error("The device could not be connected."))
                    .finally(() => setBusy(false));
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
              >
                Connect
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void declineJarvisDevice({ data: { id } }).finally(() => onDone(false))
                }
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
