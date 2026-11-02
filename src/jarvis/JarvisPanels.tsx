/** The rail's Conversations, and JARVIS's place in Settings. */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { deleteConversation, listConversations } from "@/lib/ocade.functions";
import {
  confirmJarvisStep,
  resolveJarvisStep,
  getJarvisTask,
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
import { useSession } from "@/lib/session";

export type Section = "conversations";

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

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
      aria-label="Conversations"
      className="flex h-full w-72 max-w-[80vw] flex-col border-r border-border/60 bg-background/90"
    >
      <div className="flex h-12 items-center justify-between px-3">
        <h2 className="text-sm font-medium">Conversations</h2>
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
  {
    capability: "computer_control",
    label: "Click on screen when nothing else works, and run commands you confirm",
  },
  { capability: "mcp", label: "Use tool servers you approved on that computer" },
];

/** Settings > Devices: pair a computer, choose exactly what JARVIS may use on it, remove it. */
export function JarvisAccess() {
  const queryClient = useQueryClient();
  const devices = useQuery({ queryKey: ["jarvis", "devices"], queryFn: () => listJarvisDevices() });
  const [code, setCode] = useState("");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["jarvis"] });
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Install the OCADE JARVIS companion on a Windows computer, choose its JARVIS folder there,
        then type the pairing code it shows. JARVIS only uses what you turn on below.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void pairJarvisDevice({ data: { code } })
            .then(() => {
              setCode("");
              toast.success("Computer paired.");
              refresh();
            })
            .catch((error: Error) => toast.error(error.message));
        }}
      >
        <label className="sr-only" htmlFor="jarvis-pair-code">
          Pairing code
        </label>
        <input
          id="jarvis-pair-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Pairing code"
          maxLength={16}
          pattern="[0-9A-F]{16}"
          autoComplete="off"
          className="h-9 flex-1 rounded-md border border-border bg-transparent px-2 font-mono outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={code.length !== 16}
          className="rounded-md bg-foreground px-3 text-background disabled:opacity-40"
        >
          Pair
        </button>
      </form>
      {devices.isError ? (
        <p className="text-muted-foreground">Your computers could not be loaded.</p>
      ) : null}
      {devices.data?.length === 0 ? (
        <p className="text-muted-foreground">No computer is paired yet.</p>
      ) : null}
      {devices.data?.map((device) => (
        <DeviceAccess key={device.id} device={device} onChanged={refresh} />
      ))}
    </div>
  );
}

function DeviceAccess({
  device,
  onChanged,
}: {
  device: Awaited<ReturnType<typeof listJarvisDevices>>[number];
  onChanged: () => void;
}) {
  const granted = useQuery({
    queryKey: ["jarvis", "access", device.id],
    queryFn: () => listJarvisAccess({ data: { deviceId: device.id } }),
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
            {device.last_seen_at ? `Last seen ${when(device.last_seen_at)}` : "Not seen yet"}
          </p>
        </div>
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
      </div>
      {ACCESS.map(({ capability, label }) => (
        <label key={capability} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={has(capability)}
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

/** One task: what JARVIS is doing, what it proved, and the person's controls. */
export function TaskPanel({
  task,
  onChanged,
}: {
  task: Awaited<ReturnType<typeof getJarvisTask>>;
  onChanged: () => void;
}) {
  const open = ["running", "waiting", "taken_over"].includes(task.status);
  const act = (work: Promise<unknown>) =>
    void work.then(onChanged).catch((error: Error) => toast.error(error.message));
  return (
    <section
      aria-label="JARVIS task"
      aria-live="polite"
      className="mx-auto mb-2 w-full max-w-2xl rounded-2xl border border-border/60 p-3 text-sm"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{STATUS_WORDS[task.status] ?? task.status}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{task.title}</span>
        <Elapsed timing={task.timing} live={open} />
        {task.status === "running" ? (
          <button
            type="button"
            onClick={() => act(takeOverJarvisTask({ data: { taskId: task.id } }))}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent"
          >
            Take over
          </button>
        ) : null}
        {task.status === "taken_over" || task.status === "waiting" ? (
          <button
            type="button"
            onClick={() => act(resumeJarvisTask({ data: { taskId: task.id } }))}
            className="rounded-full border border-border px-3 py-1 hover:bg-accent"
          >
            Resume
          </button>
        ) : null}
        {open ? (
          <button
            type="button"
            onClick={() => act(stopJarvisTask({ data: { taskId: task.id } }))}
            className="rounded-full bg-destructive px-3 py-1 font-medium text-destructive-foreground"
          >
            STOP
          </button>
        ) : null}
      </div>
      {task.blocker ? <p className="mt-1 text-muted-foreground">{task.blocker}</p> : null}
      <ol className="mt-2 space-y-1">
        {task.steps.map((step) => (
          <li key={step.id} className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-muted-foreground">
              {step.status.replace("_", " ")}
            </span>
            <span className="min-w-0 flex-1 truncate">{step.summary}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {duration(step.durationMs)}
            </span>
            {step.effect ? (
              <pre className="mt-1 max-h-48 w-full basis-full overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                {step.effect}
              </pre>
            ) : null}
            {step.needsConfirmation ? (
              <button
                type="button"
                onClick={() => act(confirmJarvisStep({ data: { activityId: step.id } }))}
                className="rounded-full bg-foreground px-3 py-0.5 text-xs text-background"
              >
                Allow this step
              </button>
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
              {check.state === "passed" ? "✓" : check.state === "failed" ? "✗" : "·"}{" "}
              {check.description}
            </li>
          ))}
        </ul>
      ) : null}
      {task.artifacts.length ? (
        <div className="mt-2 text-xs">
          <p className="text-muted-foreground">
            {task.status === "completed" ? "Your files" : "Files written so far"} — on{" "}
            {task.device ?? "your computer"}, in its OCADE JARVIS folder:
          </p>
          <ul className="mt-1 space-y-0.5 font-mono">
            {task.artifacts.map((path) => (
              <li key={path} className="break-all">
                {path}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
