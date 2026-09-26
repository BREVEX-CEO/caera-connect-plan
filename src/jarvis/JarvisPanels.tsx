/** The rail's sections, the Permissions drawer and the graph node panel. */
import { Fragment, useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FINISHED, hostOf, type Capability } from "./protocol";
import { isAllowed } from "./permissions";
import type { GraphNode } from "./graph";
import {
  createJarvisPairing,
  forgetJarvis,
  revokeJarvisDevice,
  setJarvisPermission,
  type JarvisState,
} from "./jarvis.functions";

export type Section = "conversations" | "history" | "tasks" | "activity" | "apps" | "devices";

const TITLES: Record<Section, string> = {
  conversations: "Conversations",
  history: "History",
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
  allowed: boolean,
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

export function SectionPanel({
  section,
  state,
  signedIn,
  activeConversation,
  onClose,
  onOpenConversation,
  onChanged,
}: {
  section: Section;
  state: JarvisState | undefined;
  signedIn: boolean;
  activeConversation: string | null;
  onClose: () => void;
  onOpenConversation: (id: string) => void;
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
  onOpenConversation,
  onChanged,
}: {
  section: Section;
  state: JarvisState;
  activeConversation: string | null;
  onOpenConversation: (id: string) => void;
  onChanged: () => void;
}) {
  const [opened, setOpened] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);

  if (section === "conversations" || section === "tasks") {
    const list =
      section === "conversations"
        ? state.conversations
            .filter((c) => !c.archived)
            .map((c) => ({ id: c.id, title: c.title, sub: when(c.updated_at), open: c.id }))
        : state.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            sub: `${t.status.replace("_", " ")} · step ${Math.min(t.current_step + 1, Math.max(1, t.plan.length))} of ${Math.max(1, t.plan.length)}`,
            open: t.conversation_id,
          }));
    if (list.length === 0) {
      return <p className="text-muted-foreground">Nothing here yet.</p>;
    }
    return (
      <ul className="flex flex-col gap-0.5">
        {list.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpenConversation(item.open)}
              aria-current={item.open === activeConversation ? "true" : undefined}
              className="w-full rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              <span className="block truncate">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{item.sub}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (section === "history") {
    const done = state.tasks.filter((t) => FINISHED.includes(t.status));
    if (done.length === 0)
      return <p className="text-muted-foreground">Finished tasks appear here.</p>;
    return (
      <ul className="flex flex-col gap-2">
        {done.map((t) => (
          <li key={t.id} className="rounded-md border border-border/60 p-2">
            <p className="truncate font-medium">{t.title}</p>
            <p className="text-xs text-muted-foreground">
              {t.status} · {when(t.updated_at)}
            </p>
            {t.result ? (
              opened === t.id ? (
                <p className="mt-1 whitespace-pre-wrap text-xs">{t.result}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpened(t.id)}
                  className="mt-1 text-xs underline underline-offset-2"
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
        <p className="mt-3 text-xs text-muted-foreground">
          Apps on your computer or phone: not available yet.
        </p>
      </>
    );
  }

  // Devices
  const devices = state.devices.filter((d) => !d.revoked_at && d.last_seen_at);
  return (
    <>
      {devices.length === 0 ? (
        <p className="text-muted-foreground">
          No device is connected. Browser tasks run on a connected computer.
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {devices.map((d) => (
          <li key={d.id} className="rounded-md border border-border/60 p-2">
            <p className="font-medium">{d.name}</p>
            <p className="text-xs text-muted-foreground">
              {d.online ? "Online" : "Offline"}
              {d.platform ? ` · ${d.platform}` : ""}
            </p>
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
            <p className="text-xs text-muted-foreground">
              Computer control, files and screen: not available yet.
            </p>
            <button
              type="button"
              onClick={() =>
                void revokeJarvisDevice({ data: { id: d.id } })
                  .then(onChanged)
                  .catch(() => toast.error("That device could not be removed."))
              }
              className="mt-2 text-xs text-destructive underline underline-offset-2"
            >
              Remove device
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-md border border-border/60 p-2">
        {pairing ? (
          <>
            <p className="text-xs text-muted-foreground">On the computer, run:</p>
            <code className="mt-1 block break-all rounded bg-secondary px-2 py-1 text-xs">
              python ocade_device.py pair --server {window.location.origin} --code {pairing.code}
            </code>
            <p className="mt-1 text-xs text-muted-foreground">
              Code <span data-testid="pairing-code">{pairing.code}</span> works once, until{" "}
              {when(pairing.expiresAt)}.
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() =>
              void createJarvisPairing()
                .then((value) => {
                  setPairing(value);
                  onChanged();
                })
                .catch(() => toast.error("A pairing code could not be created."))
            }
            className="w-full rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
          >
            Connect a device
          </button>
        )}
      </div>
    </>
  );
}

const UNAVAILABLE: [Capability, string][] = [
  ["files", "Files"],
  ["screen", "Screen"],
  ["camera", "Camera"],
  ["apps", "Apps on your computer"],
  ["messaging", "Messaging"],
  ["computer_control", "Computer control"],
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
