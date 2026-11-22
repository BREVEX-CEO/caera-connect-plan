/** The rail's Conversations, and JARVIS's place in Settings. */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { deleteConversation, listConversations } from "@/lib/ocade.functions";
import {
  confirmJarvisStep,
  resolveJarvisStep,
  answerJarvisForm,
  replayJarvisTask,
  clearJarvisApprovals,
  setJarvisTaskMode,
  getJarvisTask,
  instructJarvisTask,
  listJarvisAccess,
  listJarvisDevices,
  pairJarvisDevice,
  removeJarvisDevice,
  resumeJarvisTask,
  setJarvisAccess,
  stopJarvisTask,
  takeOverJarvisTask,
} from "@/lib/jarvis/functions";
import { toast } from "sonner";
import { Schedules } from "./Schedules";
import { Skills } from "./Skills";
import { buildPassport, passportReport } from "@/lib/jarvis/proof-passport";
import { saveSkill } from "@/lib/jarvis/skills.functions";
import { workflowBody } from "@/lib/jarvis/skillforge";
import { PermissionGuide } from "./PermissionGuide";
import { ControlModePicker, type ControlMode } from "./ControlMode";
import { Watches } from "./Watches";
import { useSession } from "@/lib/session";
import { toBase64 } from "@/lib/chat/attachments";
import { addLibraryItem, LIBRARY_MAX_BYTES } from "@/lib/library/library.functions";

/** One stable colour per agent lane, paired with its name (plan 14F.3.5). */
const AGENT_STYLE = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300",
];

export type Section = "conversations" | "schedules" | "skills";

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

const TITLES: Record<Section, string> = {
  conversations: "Conversations",
  schedules: "Scheduled",
  skills: "Skills",
};

export function SectionPanel({
  section,
  signedIn,
  activeConversation,
  onClose,
  onOpenConversation,
}: {
  section: Section;
  signedIn: boolean;
  activeConversation: string | null;
  onClose: () => void;
  onOpenConversation: (id: string | null) => void;
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
          <p className="text-muted-foreground">Sign in to see your {section}.</p>
        ) : section === "schedules" ? (
          <>
            <Schedules />
            <Watches />
          </>
        ) : section === "skills" ? (
          <Skills />
        ) : (
          <Conversations
            activeConversation={activeConversation}
            onOpenConversation={onOpenConversation}
          />
        )}
      </div>
    </aside>
  );
}

/** Past JARVIS conversations: readable, searchable and deletable. */
function Conversations({
  activeConversation,
  onOpenConversation,
}: {
  activeConversation: string | null;
  onOpenConversation: (id: string | null) => void;
}) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [find, setFind] = useState("");
  const queryKey = ["jarvis", "conversations", user?.id ?? ""];
  const conversations = useQuery({
    queryKey,
    queryFn: () => listConversations({ data: { surface: "jarvis" } }),
  });
  if (conversations.isPending) return null;
  if (conversations.isError) {
    return <p className="text-muted-foreground">Your conversations could not be loaded.</p>;
  }
  const list = conversations.data.filter((c) => !c.archived);
  if (list.length === 0) return <p className="text-muted-foreground">Nothing here yet.</p>;
  const wanted = find.trim().toLowerCase();
  const shown = wanted ? list.filter((c) => c.title.toLowerCase().includes(wanted)) : list;
  return (
    <>
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
              onClick={() => onOpenConversation(item.id)}
              aria-current={item.id === activeConversation ? "true" : undefined}
              className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-accent"
            >
              <span className="block truncate">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{when(item.updated_at)}</span>
            </button>
            <button
              type="button"
              aria-label={`Delete ${item.title}`}
              onClick={() => {
                if (!window.confirm("Delete this conversation for good?")) return;
                void deleteConversation({ data: { id: item.id } })
                  .then(() => {
                    void queryClient.invalidateQueries({ queryKey });
                    if (item.id === activeConversation) onOpenConversation(null);
                  })
                  .catch(() => toast.error("That conversation could not be deleted."));
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

const ACCESS: { capability: string; label: string }[] = [
  { capability: "files", label: "Files in its JARVIS folder" },
  { capability: "apps", label: "Open and use allowed apps" },
  { capability: "browser", label: "Use allowed websites" },
  { capability: "screen", label: "Send pictures to JARVIS's online planner" },
  {
    capability: "computer_control",
    label: "Click on screen when nothing else works, and run commands you confirm",
  },
  { capability: "mcp", label: "Use tool servers you approved on that computer" },
  {
    capability: "background",
    label:
      "Work in app windows while you keep using your computer (never moves your mouse or types; typing and clicking still wait for you)",
  },
];

/** Settings > Devices: pair a computer, choose exactly what JARVIS may use on it, remove it. */
export function JarvisAccess() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ["jarvis", "devices", user?.id ?? ""],
    queryFn: () => listJarvisDevices(),
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });
  const [code, setCode] = useState("");
  const [linked, setLinked] = useState(false);
  const [pairing, setPairing] = useState(false);
  const validCode = /^[0-9A-F]{16}$/.test(code);
  /*
   * THE COMPANION'S LINK FILLS THE CODE IN (plan v8 5.5): `#pair=<code>` after enrolling, so a
   * signed-in person only confirms. Never paired by the link alone: the code could have come
   * from someone else's computer, so the person still presses Pair, warned to pair only the
   * computer in front of them. Read once from the fragment (never sent to a server) and dropped.
   */
  useEffect(() => {
    const linkedCode = /(?:^#|&)pair=([0-9A-Fa-f]{16})(?:&|$)/.exec(window.location.hash)?.[1];
    if (!linkedCode) return;
    setCode(linkedCode.toUpperCase());
    setLinked(true);
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  }, []);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["jarvis"] });
  return (
    <div className="space-y-4 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>
          Open the OCADE companion on your Windows or Mac computer and choose a JARVIS folder.
        </li>
        <li>Enter the pairing code from the companion and keep it running.</li>
        <li>Allow access to its JARVIS folder, then ask JARVIS for your first task.</li>
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (pairing || !validCode) return;
          setPairing(true);
          void pairJarvisDevice({ data: { code } })
            .then(() => {
              setCode("");
              toast.success("Computer paired.");
              refresh();
            })
            .catch((error: Error) => toast.error(error.message))
            .finally(() => setPairing(false));
        }}
      >
        <label className="sr-only" htmlFor="jarvis-pair-code">
          Pairing code
        </label>
        <input
          id="jarvis-pair-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[\s-]+/g, ""))}
          placeholder="Pairing code"
          maxLength={32}
          pattern="[0-9A-F]{16}"
          autoComplete="off"
          aria-describedby="jarvis-pair-code-hint"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 font-mono outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={pairing || !validCode}
          className="min-h-11 rounded-md bg-foreground px-4 text-background disabled:opacity-40"
        >
          {pairing ? "Pairing…" : "Pair"}
        </button>
      </form>
      <p id="jarvis-pair-code-hint" className="text-xs text-muted-foreground">
        Enter the 16 characters shown by the companion.
      </p>
      {linked ? (
        <p role="note" className="text-muted-foreground">
          The companion filled in its code. Press Pair only if that companion is running on the
          computer in front of you.
        </p>
      ) : null}
      {devices.isError ? (
        <p className="text-muted-foreground">Your computers could not be loaded.</p>
      ) : null}
      {devices.data?.length === 0 ? (
        <p className="text-muted-foreground">No computer is paired yet.</p>
      ) : null}
      {devices.data?.map((device) => (
        <DeviceAccess
          key={device.id}
          device={device}
          onChanged={refresh}
          onRefresh={() => devices.refetch({ throwOnError: true })}
        />
      ))}
    </div>
  );
}

const DEVICE_LABELS: Record<string, string> = {
  ready: "Ready",
  offline: "Offline",
  permission_required: "Permission required",
  busy: "Busy",
  disconnected: "Disconnected",
  removed: "Removed",
};

function DeviceAccess({
  device,
  onChanged,
  onRefresh,
}: {
  device: Awaited<ReturnType<typeof listJarvisDevices>>[number];
  onChanged: () => void;
  onRefresh: () => Promise<unknown>;
}) {
  const { user } = useSession();
  const granted = useQuery({
    queryKey: ["jarvis", "access", user?.id ?? "", device.id],
    queryFn: () => listJarvisAccess({ data: { deviceId: device.id } }),
    enabled: Boolean(user) && !device.revoked_at,
  });
  const [site, setSite] = useState("");
  const has = (capability: string) => granted.data?.includes(capability) ?? false;
  const set = (capability: string, allowed: boolean) =>
    void setJarvisAccess({ data: { deviceId: device.id, capability, allowed } })
      .then(onChanged)
      .catch((error: Error) => toast.error(error.message));
  const apps = (Array.isArray(device.installed_apps) ? device.installed_apps : []) as {
    name: string;
    exe: string;
  }[];
  const sites = (granted.data ?? []).filter((c) => c.startsWith("site:"));
  const servers = ((device.capabilities as { mcp?: { id: string; publisher: string }[] } | null)
    ?.mcp ?? []) as { id: string; publisher: string }[];
  return (
    <section className="space-y-2 rounded-lg border border-border/60 p-3" aria-label={device.name}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{device.name}</h3>
          <p className="text-xs text-muted-foreground">
            {DEVICE_LABELS[device.state] ?? device.state}
            {device.last_seen_at ? ` · Last seen ${when(device.last_seen_at)}` : ""}
          </p>
        </div>
        {!device.revoked_at ? (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Remove ${device.name}? Any task on it stops.`)) return;
              void removeJarvisDevice({ data: { deviceId: device.id } })
                .then(onChanged)
                .catch((error: Error) => toast.error(error.message));
            }}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            Remove
          </button>
        ) : null}
      </div>
      {!device.revoked_at ? (
        <PermissionGuide
          deviceId={device.id}
          platform={device.platform}
          engines={(device.capabilities as { engines?: unknown } | null)?.engines}
          onRefresh={onRefresh}
        />
      ) : null}
      {device.state === "permission_required" && has("files") ? (
        <button type="button" onClick={() => set("files", true)} className="text-xs underline">
          Allow JARVIS access again
        </button>
      ) : null}
      {granted.isError && !device.revoked_at ? (
        <p role="status" className="text-xs text-muted-foreground">
          Permissions could not be loaded.
        </p>
      ) : null}
      {!device.revoked_at &&
        ACCESS.map(({ capability, label }) => (
          <label key={capability} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={has(capability)}
              disabled={!granted.isSuccess}
              onChange={(e) => set(capability, e.target.checked)}
            />
            {label}
          </label>
        ))}
      {has("apps") && apps.length ? (
        <details>
          <summary className="cursor-pointer text-muted-foreground">Allowed apps</summary>
          <div className="mt-1 max-h-48 space-y-1 overflow-y-auto">
            {apps.map((app) => (
              <label key={app.exe} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={has(`app:${app.exe}`)}
                  onChange={(e) => set(`app:${app.exe}`, e.target.checked)}
                />
                <span className="truncate">{app.name}</span>
              </label>
            ))}
          </div>
        </details>
      ) : null}
      {has("mcp") && servers.length ? (
        <div className="space-y-1">
          <p className="text-muted-foreground">Approved tool servers</p>
          {servers.map((server) => (
            <label key={server.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={has(`mcp:${server.id}`)}
                onChange={(e) => set(`mcp:${server.id}`, e.target.checked)}
              />
              <span className="truncate">
                {server.id} <span className="text-muted-foreground">({server.publisher})</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
      {has("browser") ? (
        <div className="space-y-1">
          <p className="text-muted-foreground">Allowed websites</p>
          {sites.map((entry) => (
            <div key={entry} className="flex items-center justify-between">
              <span>{entry.slice(5)}</span>
              <button
                type="button"
                className="text-xs text-muted-foreground"
                onClick={() => set(entry, false)}
              >
                Remove
              </button>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              set(`site:${site.trim().toLowerCase()}`, true);
              setSite("");
            }}
          >
            <input
              value={site}
              onChange={(event) => setSite(event.target.value)}
              placeholder="example.com"
              aria-label="Website to allow"
              className="h-8 flex-1 rounded-md border border-border bg-transparent px-2 outline-none"
            />
            <button
              type="submit"
              disabled={!site.trim()}
              className="rounded-md border border-border px-2"
            >
              Allow
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

const STATUS_WORDS: Record<string, string> = {
  running: "Working",
  waiting: "Waiting",
  taken_over: "You have control",
  stopped: "Stopped",
  blocked: "Needs you",
  failed: "Failed",
  completed: "Done and checked",
};

function duration(ms: number | null) {
  if (ms === null) return "";
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

type Timing = Awaited<ReturnType<typeof getJarvisTask>>["timing"];

/** Elapsed time from the server's start; ticks locally only while the task is open. */
function Elapsed({ timing, live }: { timing: Timing; live: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [live]);
  const total = live ? Math.max(0, now - Date.parse(timing.acceptedAt)) : timing.totalElapsedMs;
  const parts = [duration(total)];
  if (!live && timing.activeExecutionMs !== null)
    parts.push(`active ${duration(timing.activeExecutionMs)}`);
  if (timing.userWaitMs > 0) parts.push(`waiting on you ${duration(timing.userWaitMs)}`);
  if (timing.pausedMs > 0) parts.push(`paused ${duration(timing.pausedMs)}`);
  return (
    <span
      className="shrink-0 text-xs tabular-nums text-muted-foreground"
      title="Time since you asked"
    >
      {parts.join(" · ")}
    </span>
  );
}

/**
 * Tell an open task something new (plan 14F.4.4): for everyone or one agent. The draft stays while
 * it is sending or if sending fails; accepted means recorded for JARVIS's next turn, not done.
 */
function Instruct({
  taskId,
  agents,
  revision,
  onChanged,
}: {
  taskId: string;
  agents: number[];
  revision: string | null;
  onChanged: () => void | Promise<unknown>;
}) {
  type Draft = { text: string; lane: number | null; previous: string | null };
  const [draft, setDraft] = useState<Draft>({ text: "", lane: null, previous: revision });
  const [state, setState] = useState<"idle" | "sending" | "accepted" | "conflict">("idle");
  const attempt = useRef<{ draft: Draft; id: string } | null>(null);
  const accepted = useRef<{ previous: string | null; id: string } | null>(null);
  const sending = useRef(false);
  const edit = (change: Partial<Pick<Draft, "text" | "lane">>) => {
    const last = accepted.current;
    const currentRevision = last && last.previous === revision ? last.id : revision;
    setDraft((current) => ({
      ...current,
      previous: current.text.trim() || state === "sending" ? current.previous : currentRevision,
      ...change,
    }));
    if (state === "accepted") setState("idle");
  };
  const send = async () => {
    if (!draft.text.trim() || sending.current || state === "conflict") return;
    sending.current = true;
    const submission =
      attempt.current?.draft === draft ? attempt.current : { draft, id: crypto.randomUUID() };
    attempt.current = submission;
    setState("sending");
    try {
      const result = await instructJarvisTask({
        data: { taskId, ...draft, clientId: submission.id },
      });
      if (result.status === "conflict") {
        setState("conflict");
      } else {
        accepted.current = { previous: draft.previous, id: result.id };
        setDraft((current) => ({
          ...current,
          text: current === draft ? "" : current.text,
          previous: result.id,
        }));
        setState("accepted");
      }
      void onChanged();
    } catch (error) {
      setState("idle");
      toast.error(error instanceof Error ? error.message : "Could not send this instruction.");
    } finally {
      sending.current = false;
    }
  };
  const visibleAgents =
    draft.lane !== null && !agents.includes(draft.lane) ? [...agents, draft.lane] : agents;
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label className="sr-only" htmlFor={`instruct-${taskId}`}>
        Tell JARVIS something new for this task
      </label>
      <input
        id={`instruct-${taskId}`}
        value={draft.text}
        maxLength={2000}
        onChange={(event) => edit({ text: event.target.value })}
        placeholder="Change something while it works…"
        className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-1 text-base sm:text-sm"
      />
      {visibleAgents.length > 1 || draft.lane !== null ? (
        <select
          aria-label="Who the instruction is for"
          value={draft.lane ?? ""}
          onChange={(event) =>
            edit({ lane: event.target.value === "" ? null : Number(event.target.value) })
          }
          className="min-h-11 rounded-full border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="">Everyone</option>
          {visibleAgents.map((agent) => (
            <option key={agent} value={agent}>
              Agent {agent + 1}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="submit"
        disabled={!draft.text.trim() || state === "sending" || state === "conflict"}
        className="min-h-11 rounded-full border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send"}
      </button>
      {state === "conflict" ? (
        <div className="basis-full space-y-1 text-xs">
          <p role="alert">The task received a newer instruction. Your draft is still here.</p>
          <button
            type="button"
            onClick={() => {
              if (revision === draft.previous) {
                void onChanged();
                return;
              }
              setDraft((current) => ({ ...current, previous: revision }));
              setState("idle");
            }}
            className="min-h-11 rounded-full border border-border px-3 text-sm hover:bg-accent"
          >
            {revision === draft.previous ? "Refresh task" : "Use latest task state"}
          </button>
        </div>
      ) : null}
      {state === "accepted" ? (
        <span role="status" className="basis-full text-xs text-muted-foreground">
          Received. JARVIS reads it when planning again. Check Activity for steps already queued.
        </span>
      ) : null}
    </form>
  );
}

/**
 * The short form JARVIS generated for the details it needs (R12-06): only those fields, in
 * OCADE's own design, with the destination still shown in the task; sending it answers JARVIS
 * and the task continues. Values stay as typed if sending fails.
 */
/**
 * SkillForge (28.2.1): what the person showed, as an editable workflow. They name it, rename the
 * values that change each time, drop steps, and save it as their own skill; nothing runs here.
 */
function LearnedSkill({ workflow }: { workflow: NonNullable<Task["learned"]> }) {
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [keep, setKeep] = useState(() => workflow.steps.map(() => true));
  const [names, setNames] = useState(() => workflow.parameters.map((p) => p.name));
  const [busy, setBusy] = useState(false);
  const edited = () => {
    const renamed = new Map(workflow.parameters.map((p, i) => [p.name, names[i] || p.name]));
    const steps = workflow.steps
      .filter((_, i) => keep[i])
      .map((step) =>
        step.operation === "ui.set_value"
          ? {
              ...step,
              value: step.value.replace(
                /\{\{([a-z][a-z0-9_]*)\}\}/g,
                (_, p: string) => `{{${renamed.get(p) ?? p}}}`,
              ),
            }
          : step,
      );
    const used = new Set(
      steps
        .flatMap((s) => (s.operation === "ui.set_value" ? [s.value] : []))
        .join(" ")
        .match(/[a-z][a-z0-9_]*/g),
    );
    return {
      ...workflow,
      steps,
      parameters: workflow.parameters
        .map((p, i) => ({ name: names[i] || p.name, default: p.default }))
        .filter((p) => used.has(p.name)),
    };
  };
  return (
    <details className="mt-2 rounded-xl border border-border p-3 text-xs">
      <summary className="cursor-pointer font-medium">Make a skill from what you showed</summary>
      <p className="mt-1 text-muted-foreground">
        Run it later with /name and new values, for example{" "}
        {workflow.parameters[0] ? `${workflow.parameters[0].name}="…"` : "/name"}. JARVIS repeats
        these steps in {workflow.app} without asking the AI, stops at a control that is no longer
        there, and still checks the result. A protected field is never recorded: you type it.
      </p>
      <ol className="mt-2 space-y-1">
        {workflow.steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Keep step ${i + 1}`}
              checked={keep[i]}
              onChange={(event) =>
                setKeep(keep.map((k, j) => (j === i ? event.target.checked : k)))
              }
            />
            <span>
              {step.operation === "secret"
                ? "You type into the protected field"
                : step.operation === "ui.invoke"
                  ? `Press "${step.label}"`
                  : `Set "${step.label}" to ${step.value}`}
            </span>
          </li>
        ))}
      </ol>
      {workflow.parameters.map((p, i) => (
        <label key={p.name} className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Value name for "{p.default.slice(0, 40)}"</span>
          <input
            className="rounded border border-border bg-background px-2 py-0.5"
            value={names[i]}
            pattern="[a-z][a-z0-9_]{0,39}"
            onChange={(event) => setNames(names.map((n, j) => (j === i ? event.target.value : n)))}
          />
        </label>
      ))}
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          aria-label="Skill title"
          placeholder="What it does"
          className="rounded border border-border bg-background px-2 py-0.5"
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          aria-label="Skill name"
          placeholder="name-for-slash"
          className="rounded border border-border bg-background px-2 py-0.5"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value.toLowerCase())}
        />
        <button
          type="button"
          disabled={
            busy || !title.trim() || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(name) || !keep.some(Boolean)
          }
          onClick={() => {
            setBusy(true);
            saveSkill({ data: { id: null, name, title, body: workflowBody(title, edited()) } })
              .then(() => toast.success(`Saved as /${name}.`))
              .catch((error: Error) => toast.error(error.message))
              .finally(() => setBusy(false));
          }}
          className="rounded-full border border-border px-3 py-1 hover:bg-accent disabled:opacity-50"
        >
          Save skill
        </button>
      </div>
    </details>
  );
}

function TaskForm({
  taskId,
  formId,
  question,
  fields,
  onDone,
}: {
  taskId: string;
  formId: string;
  question: string | null;
  fields: NonNullable<Task["form"]>;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ payload: string; clientId: string } | null>(null);
  const missing = fields.some((field) => field.required && !values[field.name]?.trim());
  return (
    <form
      aria-label="Details JARVIS needs"
      aria-describedby={question ? `question-${formId}` : undefined}
      className="mt-2 space-y-2 rounded-xl border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (missing || busy) return;
        setBusy(true);
        setError(null);
        const payload = JSON.stringify(values);
        if (attempt.current?.payload !== payload)
          attempt.current = { payload, clientId: crypto.randomUUID() };
        void answerJarvisForm({
          data: { taskId, formId, values, clientId: attempt.current.clientId },
        })
          .then(onDone)
          .catch((error: unknown) =>
            setError(
              error instanceof Error && !(error instanceof TypeError)
                ? error.message
                : "Could not send your answers. Your entries are still here.",
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      {question ? (
        <p id={`question-${formId}`} className="text-sm">
          {question}
        </p>
      ) : null}
      {fields.map((field) => {
        const id = `form-${formId}-${field.name}`;
        const common = {
          id,
          value: values[field.name] ?? "",
          required: field.required,
          disabled: busy,
          onChange: (event: { target: { value: string } }) =>
            setValues((previous) => ({ ...previous, [field.name]: event.target.value })),
          className:
            "mt-1 min-h-11 w-full rounded-md border border-border bg-background px-2 py-1 text-base",
        };
        return (
          <label key={field.name} htmlFor={id} className="block text-xs">
            <span>
              {field.label}
              {field.required ? " (required)" : ""}
            </span>
            {field.type === "choice" ? (
              <select {...common}>
                <option value="">Choose…</option>
                {field.options!.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "long_text" ? (
              <textarea {...common} rows={3} maxLength={1000} />
            ) : (
              <input
                {...common}
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                step={field.type === "number" ? "any" : undefined}
                maxLength={1000}
              />
            )}
          </label>
        );
      })}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={missing || busy}
        className="min-h-11 rounded-full bg-foreground px-3 py-1 text-sm text-background disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send to JARVIS"}
      </button>
    </form>
  );
}

/** One task: what JARVIS is doing, what it proved, and the person's controls. */
type Task = Awaited<ReturnType<typeof getJarvisTask>>;

function TaskEvidence({ task }: { task: Task }) {
  const [caseReport, setCaseReport] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState<"passport" | "case" | null>(null);
  const caseButton = useRef<HTMLButtonElement>(null);
  const casePacket = caseReport
    ? ["Case summary for a professional", question.trim(), caseReport].filter(Boolean).join("\n\n")
    : null;

  const prepare = async (type: "passport" | "case") => {
    setBusy(type);
    try {
      const passport = await buildPassport(task);
      const report = passportReport(passport);
      if (type === "case") {
        setCaseReport(report);
        return;
      }
      download(`ocade-proof-${task.id}.json`, JSON.stringify(passport, null, 2));
      download(`ocade-proof-${task.id}.txt`, report);
      toast.success("Proof Passport saved with private details omitted.");
    } catch {
      toast.error("Couldn’t prepare the report. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void prepare("passport")}
        className="min-h-11 rounded-full border border-border px-3 hover:bg-accent disabled:opacity-60"
      >
        {busy === "passport" ? "Preparing Passport…" : "Proof Passport"}
      </button>
      {task.status !== "completed" ? (
        <button
          ref={caseButton}
          type="button"
          disabled={busy !== null}
          aria-expanded={casePacket !== null}
          onClick={() => (casePacket === null ? void prepare("case") : setCaseReport(null))}
          className="min-h-11 rounded-full border border-border px-3 hover:bg-accent disabled:opacity-60"
        >
          {busy === "case" ? "Preparing case summary…" : "Prepare a case summary"}
        </button>
      ) : null}
      {casePacket !== null ? (
        <section
          aria-label="Case summary"
          className="min-w-0 basis-full space-y-3 rounded-lg border p-3"
        >
          <p className="text-muted-foreground">
            Review what you’ll save for a professional of your choice. OCADE saves this on your
            device.
          </p>
          <label className="block space-y-1">
            <span className="font-medium">Question for the professional (optional)</span>
            <textarea
              rows={2}
              maxLength={2000}
              className="block w-full rounded-md border border-border bg-background p-2 text-base"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="font-medium">Download preview</span>
            <textarea
              readOnly
              rows={6}
              className="block w-full rounded-md border border-border bg-background p-2 text-base"
              value={casePacket}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => download(`ocade-case-${task.id}.txt`, casePacket)}
              className="min-h-11 rounded-full bg-primary px-4 font-medium text-primary-foreground"
            >
              Download summary
            </button>
            <button
              type="button"
              onClick={() => {
                setCaseReport(null);
                caseButton.current?.focus();
              }}
              className="min-h-11 rounded-full border border-border px-4 hover:bg-accent"
            >
              Close preview
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

export function TaskPanel({
  task,
  onChanged,
  onRetry,
  onUseFile,
}: {
  task: Task;
  onChanged: () => void | Promise<unknown>;
  onRetry: (objective: string) => void;
  onUseFile: (path: string) => void;
}) {
  const open = ["running", "waiting", "taken_over"].includes(task.status);
  const [switching, setSwitching] = useState(false);
  const switchMode = async (mode: ControlMode) => {
    if (switching) return;
    setSwitching(true);
    try {
      await setJarvisTaskMode({ data: { taskId: task.id, mode } });
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JARVIS couldn't switch modes.");
    } finally {
      setSwitching(false);
    }
  };
  const parallel = new Set(task.steps.map((step) => step.lane)).size > 1;
  // The timeline (R12-09): filter by agent and by what happened; entries are the real steps.
  const [agentFilter, setAgentFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "problems" | "waiting">("all");
  const [previewOpen, setPreviewOpen] = useState(true);
  const shown = task.steps.filter(
    (step) =>
      (agentFilter === null || step.lane === agentFilter) &&
      (statusFilter === "all" ||
        (statusFilter === "problems"
          ? ["failed", "blocked", "cancelled"].includes(step.status) || step.needsAnswer
          : ["queued", "claimed", "needs_confirmation"].includes(step.status))),
  );
  // Passive preview (R12-08): use the actual activity, and let the timeline own approval controls.
  const next = task.steps.find((step) => ["queued", "needs_confirmation"].includes(step.status));
  const executing =
    task.status === "running" ? task.steps.find((step) => step.status === "claimed") : undefined;
  const act = (work: Promise<unknown>) =>
    void work.then(onChanged).catch((error: Error) => toast.error(error.message));
  return (
    <section
      aria-label="JARVIS task"
      className="mx-auto mb-2 w-full max-w-2xl rounded-2xl border border-border/60 p-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="font-medium">
          {STATUS_WORDS[task.status] ?? task.status}
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{task.title}</span>
        <Elapsed timing={task.timing} live={open} />
        {task.status === "running" ? (
          <button
            type="button"
            onClick={() => act(takeOverJarvisTask({ data: { taskId: task.id } }))}
            className="min-h-11 rounded-full border border-border px-4 hover:bg-accent"
          >
            Take over
          </button>
        ) : null}
        {task.status === "taken_over" || (task.status === "waiting" && !task.form) ? (
          <button
            type="button"
            onClick={() => act(resumeJarvisTask({ data: { taskId: task.id } }))}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent"
          >
            Continue
          </button>
        ) : null}
        {!open ? <TaskEvidence key={task.id} task={task} /> : null}
        {task.status === "completed" && task.checks.every((check) => check.state === "passed") ? (
          <button
            type="button"
            onClick={() => {
              const name = window.prompt(
                "Name this skill (lowercase letters, digits and hyphens). You can edit it in Skills.",
              );
              if (!name) return;
              act(
                saveSkill({
                  data: {
                    id: null,
                    name,
                    title: task.title.slice(0, 120),
                    // Only the step summaries: no file contents, receipts or private values.
                    body: [
                      `Outcome: ${task.title}`,
                      "Steps that worked:",
                      ...task.steps.map((step, index) => `${index + 1}. ${step.summary}`),
                    ]
                      .join("\n")
                      .slice(0, 8000),
                  },
                }).then(() => toast.success(`Saved as /${name}.`)),
              );
            }}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent"
          >
            Save as skill
          </button>
        ) : null}
        {task.status === "completed" &&
        task.checks.length > 0 &&
        task.checks.every((check) => check.state === "passed") ? (
          <button
            type="button"
            onClick={() =>
              act(
                replayJarvisTask({ data: { taskId: task.id } }).then(() =>
                  toast.success("Running it again from the steps that worked."),
                ),
              )
            }
            title="Repeats the file and document steps that worked, without asking the AI, then checks the result again."
            className="rounded-full border border-border px-3 py-1 hover:bg-accent"
          >
            Run again exactly
          </button>
        ) : null}
        {!open && task.mode === "rehearsal" ? (
          <button
            type="button"
            onClick={() => {
              onRetry(task.title);
              toast.info(
                "Review the rehearsal in 'OCADE output/rehearsal', then send this to do it for real.",
              );
            }}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent"
          >
            Do it for real
          </button>
        ) : null}
        {task.canRetry ? (
          <button
            type="button"
            onClick={() => {
              onRetry(task.title);
              toast.info("Review the draft and send it to retry.");
            }}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent"
          >
            Retry
          </button>
        ) : null}
        {open && task.approvalsForTask > 0 ? (
          <button
            type="button"
            onClick={() => act(clearJarvisApprovals({ data: { taskId: task.id } }))}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent"
          >
            Ask me again for each step
          </button>
        ) : null}
        {open ? (
          <button
            type="button"
            onClick={() => act(stopJarvisTask({ data: { taskId: task.id } }))}
            className="min-h-11 rounded-full bg-destructive px-4 font-medium text-destructive-foreground"
          >
            STOP
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2">
          {task.mode === "rehearsal" ? (
            <p className="text-xs">
              Rehearsal · Review the results in OCADE output/rehearsal before starting a live task.
            </p>
          ) : (
            <ControlModePicker
              mode={task.mode}
              pending={switching}
              onChange={(mode) => void switchMode(mode)}
            />
          )}
        </div>
      ) : null}
      {task.blocker && !task.form ? (
        <p className="mt-1 text-muted-foreground">{task.blocker}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        {task.source
          ? `Your key: ${task.source.alias} · ${task.source.model}${
              task.source.spent
                ? ` · ${task.source.estimated ? "about " : ""}${task.source.spent} so far`
                : ""
            }`
          : "OCADE-managed models"}
      </p>
      {task.contextUsed.length ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            What JARVIS looked at ({task.contextUsed.length})
          </summary>
          <ul className="mt-1 space-y-0.5">
            {task.contextUsed.map((item) => (
              <li key={item} className="truncate">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">
            These are the folders, files, websites and apps JARVIS successfully inspected for this
            task. Change what this computer can access in Settings.
          </p>
        </details>
      ) : null}
      {task.learned ? <LearnedSkill workflow={task.learned} /> : null}
      {task.warnings.length ? (
        <div
          role="alert"
          className="mt-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-2 text-xs"
        >
          <p className="font-medium">
            Possible scam signs. JARVIS will not fill, click or upload there without you.
          </p>
          <ul className="mt-1 space-y-0.5">
            {task.warnings.map((warning) => (
              <li key={warning.site}>
                {warning.site}:{" "}
                {warning.signs.map((sign) => `${sign.sign} (“${sign.evidence}”)`).join("; ")}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">
            These are OCADE&apos;s own rule checks, not a guarantee either way. Check the address
            yourself before entering anything.
          </p>
        </div>
      ) : null}
      {task.form && task.formId ? (
        <TaskForm
          key={task.formId}
          taskId={task.id}
          formId={task.formId}
          question={task.blocker}
          fields={task.form}
          onDone={onChanged}
        />
      ) : null}
      {open && task.agents.active + task.agents.waiting + task.agents.paused > 1 ? (
        <p className="mt-1 text-muted-foreground" aria-live="polite">
          {[
            [task.agents.active, "working"],
            [task.agents.waiting, "waiting"],
            [task.agents.paused, "paused"],
            [task.agents.blocked, "blocked"],
          ]
            .filter(([count]) => Number(count) > 0)
            .map(([count, word]) => `${count} ${word}`)
            .join(", ")}{" "}
          — independent parts run at the same time on your computer.
        </p>
      ) : null}
      {open ? (
        <Instruct
          key={task.id}
          taskId={task.id}
          agents={[...new Set(task.steps.map((step) => step.lane))].sort()}
          revision={task.instructionRevision}
          onChanged={onChanged}
        />
      ) : null}
      {task.instructionHistory.length ? (
        <details className="mt-2 rounded-xl border border-border px-3 py-1">
          <summary className="min-h-11 content-center cursor-pointer">Recent instructions</summary>
          <ol className="space-y-2 pb-2">
            {task.instructionHistory.map((instruction) => (
              <li key={instruction.id}>
                <p className="text-muted-foreground">
                  {instruction.from === "computer" ? "Companion" : "Website"} ·{" "}
                  {instruction.lane === null ? "Everyone" : `Agent ${instruction.lane + 1}`}
                </p>
                <p className="whitespace-pre-wrap break-words">{instruction.text}</p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {task.deviceOffline ? (
        <p className="mt-1 text-muted-foreground">
          {task.device ?? "Your computer"} is not reachable. JARVIS continues when it reconnects;
          nothing new starts until then.
        </p>
      ) : null}
      {task.milestones.length ? (
        <ol aria-label="Task milestones" className="mt-2 space-y-1 text-xs">
          {task.milestones.map((milestone, index) => (
            <li key={index} aria-current={milestone.state === "current" ? "step" : undefined}>
              <span className="font-medium">
                {milestone.state === "verified"
                  ? "Verified"
                  : milestone.state === "current"
                    ? "Current"
                    : "Pending"}
              </span>{" "}
              {milestone.description}
            </li>
          ))}
          {task.finalVerification && open ? (
            <li>Checking the whole result independently.</li>
          ) : null}
        </ol>
      ) : null}
      {open && (next || executing) ? (
        <details
          className="mt-2 rounded-xl border border-border px-3"
          open={previewOpen}
          onToggle={(event) => setPreviewOpen(event.currentTarget.open)}
        >
          <summary className="min-h-11 content-center cursor-pointer font-medium">
            Action preview
          </summary>
          <div className="space-y-1 pb-2 text-sm text-muted-foreground" aria-live="polite">
            {executing ? (
              <p>
                <span className="font-medium text-foreground">Executing</span> {executing.summary}
              </p>
            ) : null}
            {next ? (
              <p>
                <span className="font-medium text-foreground">
                  {next.status === "needs_confirmation" ? "Needs your approval" : "Planned"}
                </span>{" "}
                {next.summary}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
      {task.steps.length > 6 ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs" role="group" aria-label="Filter steps">
          {parallel ? (
            <select
              aria-label="Agent"
              value={agentFilter ?? ""}
              onChange={(event) =>
                setAgentFilter(event.target.value === "" ? null : Number(event.target.value))
              }
              className="rounded-full border border-border bg-background px-2 py-0.5"
            >
              <option value="">All agents</option>
              {[...new Set(task.steps.map((step) => step.lane))].sort().map((lane) => (
                <option key={lane} value={lane}>
                  Agent {lane + 1}
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label="Steps shown"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-full border border-border bg-background px-2 py-0.5"
          >
            <option value="all">All steps</option>
            <option value="problems">Problems only</option>
            <option value="waiting">Not finished</option>
          </select>
          <span className="self-center text-muted-foreground">
            {shown.length} of {task.steps.length}
          </span>
        </div>
      ) : null}
      <ol aria-label="Task actions" className="mt-2 space-y-1">
        {shown.map((step) => (
          <li key={step.id} className="flex flex-wrap items-center gap-2">
            {parallel ? (
              // Each agent keeps one colour and one name (never colour alone, 14F.3.5).
              <span
                className={`shrink-0 rounded px-1.5 text-[10px] font-medium ${AGENT_STYLE[step.lane] ?? ""}`}
              >
                Agent {step.lane + 1}
              </span>
            ) : null}
            <span className="w-20 shrink-0 text-xs text-muted-foreground">
              {step.disposition ?? step.status.replace("_", " ")}
            </span>
            {/* A step the person decides on is never cut short; the rest keep one line. */}
            <span className={`min-w-0 flex-1 ${step.effect ? "break-words" : "truncate"}`}>
              {step.summary}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {duration(step.durationMs)}
            </span>
            {step.effect ? (
              <pre className="mt-1 max-h-48 w-full basis-full overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                {step.effect}
              </pre>
            ) : null}
            {step.needsConfirmation ? (
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    act(
                      confirmJarvisStep({ data: { activityId: step.id } }).then(({ confirmed }) => {
                        if (!confirmed)
                          throw new Error("This step is no longer waiting for approval.");
                      }),
                    )
                  }
                  className="rounded-full bg-foreground px-3 py-0.5 text-xs text-background"
                >
                  Allow this step
                </button>
                {step.scope ? (
                  <button
                    type="button"
                    onClick={() =>
                      act(
                        confirmJarvisStep({ data: { activityId: step.id, scope: true } }).then(
                          ({ confirmed }) => {
                            if (!confirmed)
                              throw new Error("This step is no longer waiting for approval.");
                          },
                        ),
                      )
                    }
                    className="rounded-full border border-border px-3 py-0.5 text-xs hover:bg-accent"
                  >
                    Allow steps like this {step.scope} for this task
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => act(stopJarvisTask({ data: { taskId: task.id } }))}
                  className="rounded-full border border-border px-3 py-0.5 text-xs hover:bg-accent"
                >
                  Deny and stop
                </button>
              </span>
            ) : null}
            {step.needsAnswer ? (
              <span className="flex basis-full flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  Nobody saw whether this finished. Check your computer, then tell JARVIS:
                </span>
                {(
                  [
                    ["applied", "It happened"],
                    ["not_applied", "It did not happen"],
                  ] as const
                ).map(([resolution, label]) => (
                  <button
                    key={resolution}
                    type="button"
                    onClick={() =>
                      act(resolveJarvisStep({ data: { activityId: step.id, resolution } }))
                    }
                    className="rounded-full border border-border px-3 py-0.5 hover:bg-accent"
                  >
                    {label}
                  </button>
                ))}
              </span>
            ) : step.resolution ? (
              <span className="basis-full text-xs text-muted-foreground">
                You said it {step.resolution === "applied" ? "happened" : "did not happen"}.
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {task.checks.length ? (
        <ul className="mt-2 space-y-0.5 text-xs">
          {task.checks.map((check) => (
            <li key={check.id}>
              <span className="font-medium">
                {check.state === "passed"
                  ? "Verified"
                  : check.state === "failed"
                    ? "Failed"
                    : check.state === "unverified"
                      ? "Needs review"
                      : "Pending"}
              </span>{" "}
              {check.description}
            </li>
          ))}
        </ul>
      ) : null}
      {task.artifactFiles.length ? (
        <div className="mt-2 text-xs">
          <p className="text-muted-foreground">
            Files saved in the OCADE JARVIS folder on {task.device ?? "your computer"}.
          </p>
          <ul className="mt-1 space-y-1">
            {task.artifactFiles.map((file) => (
              <ArtifactItem key={file.path + file.sha256} file={file} onUseFile={onUseFile} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const PREVIEW_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  wav: "audio/wav",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/plain",
};

function ArtifactItem({
  file,
  onUseFile,
}: {
  file: Task["artifactFiles"][number];
  onUseFile: (path: string) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ copy: File; url: string; preview: boolean } | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const query = useQueryClient();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (selected) URL.revokeObjectURL(selected.url);
    },
    [selected],
  );

  const name = file.path.split("/").at(-1) ?? file.path;
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  const choose = async (copy: File) => {
    setSelected(null);
    setProblem(null);
    setChecking(true);
    try {
      if (copy.name.normalize("NFC").toLowerCase() !== name.normalize("NFC").toLowerCase()) {
        throw new Error("Choose " + name + " from the JARVIS folder.");
      }
      if (copy.size > LIBRARY_MAX_BYTES) {
        throw new Error("Open this large file directly in the JARVIS folder.");
      }
      const hash = await crypto.subtle.digest("SHA-256", await copy.arrayBuffer());
      const digest = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (digest !== file.sha256)
        throw new Error("This copy does not match the file JARVIS saved.");
      if (active.current) {
        const type = Object.hasOwn(PREVIEW_TYPES, extension) ? PREVIEW_TYPES[extension] : null;
        const url = URL.createObjectURL(
          new Blob([copy], { type: type ?? "application/octet-stream" }),
        );
        setSelected({ copy, url, preview: type !== null });
      }
    } catch (error) {
      if (active.current)
        setProblem(error instanceof Error ? error.message : "The file could not be opened.");
    } finally {
      if (active.current) setChecking(false);
    }
  };
  const save = async () => {
    if (!selected || uploading) return;
    setUploading(true);
    setProblem(null);
    try {
      const mime = Object.hasOwn(PREVIEW_TYPES, extension)
        ? PREVIEW_TYPES[extension]
        : "application/octet-stream";
      await addLibraryItem({
        data: {
          name,
          mime,
          kind: mime.startsWith("image/") ? "image" : "file",
          source: "generated",
          contentBase64: await toBase64(selected.copy),
        },
      });
      await query.invalidateQueries({ queryKey: ["library", "items"] });
      toast.success("Saved a copy in your Library.");
    } catch (error) {
      if (active.current)
        setProblem(error instanceof Error ? error.message : "The copy could not be uploaded.");
    } finally {
      if (active.current) setUploading(false);
    }
  };
  return (
    <li className="rounded-md border border-border/50 p-2">
      <p className="break-all font-mono">
        {file.recovery ? "Original copy · " : ""}
        {file.path}
      </p>
      <input
        ref={picker}
        type="file"
        className="hidden"
        aria-label={"Choose saved file " + name}
        onChange={(event) => {
          const copy = event.target.files?.[0];
          event.target.value = "";
          if (copy) void choose(copy);
        }}
      />
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={checking || uploading}
          className="underline"
        >
          {checking ? "Checking file…" : "Choose local copy"}
        </button>
        <button type="button" onClick={() => onUseFile(file.path)} className="underline">
          Use in next task
        </button>
        {selected ? (
          <>
            {selected.preview ? (
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Preview
              </a>
            ) : null}
            <a href={selected.url} download={name} className="underline">
              Download copy
            </a>
            <button
              type="button"
              onClick={() => void save()}
              disabled={uploading}
              className="underline"
            >
              {uploading ? "Uploading…" : "Upload copy to Library"}
            </button>
          </>
        ) : null}
      </div>
      {problem ? (
        <p role="alert" className="mt-1 text-destructive">
          {problem}
        </p>
      ) : null}
    </li>
  );
}

/** Save text the person asked for as a file on their device (nothing is uploaded). */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
