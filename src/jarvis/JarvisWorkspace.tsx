/**
 * The OCADE JARVIS workspace: a compact rail, the orb, the conversation, and
 * the task, browser and voice controls that appear only when they apply.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AppWindow,
  ArrowUp,
  History,
  ListChecks,
  Menu,
  MessageSquare,
  MessagesSquare,
  Mic,
  MonitorSmartphone,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  ShieldCheck,
  Square,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { useAppearance } from "@/lib/appearance";
import { loadChatMessages, persistChatMessage } from "@/lib/ocade-chat-store";
import { describeReset } from "@/lib/commercial/use-commercial-usage";
import { cn } from "@/lib/utils";
import { Orb } from "./Orb";
import { buildGraph, type GraphNode } from "./graph";
import { runJarvisTurn, Stopped } from "./agent";
import { liveDeps, ModelRefused } from "./live-deps";
import { isAllowed } from "./permissions";
import { FINISHED } from "./protocol";
import { readPreferences, writePreferences, type JarvisPreferences } from "./preferences";
import { useJarvisVoice } from "./use-voice";
import {
  createJarvisConversation,
  readJarvisState,
  updateJarvisTask,
  type JarvisTaskRow,
} from "./jarvis.functions";
import { NodePanel, PermissionsDrawer, SectionPanel, type Section } from "./JarvisPanels";
import { BrowserPanel, ConfirmBanner, TaskCard, TakeOverBanner, VoiceBar } from "./JarvisTask";

const JARVIS_STATE_KEY = ["jarvis", "state"] as const;

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "conversations", label: "Conversations", icon: MessagesSquare },
  { id: "history", label: "History", icon: History },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "apps", label: "Allowed Apps", icon: AppWindow },
  { id: "devices", label: "Devices", icon: MonitorSmartphone },
];

export function JarvisWorkspace({ conversationId }: { conversationId: string | null }) {
  const { user, loading } = useSession();
  const signedIn = Boolean(user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { motionReduced, theme, setAppearance } = useAppearance();
  const [prefs, setPrefs] = useState<JarvisPreferences>({
    accent: null,
    railExpanded: false,
    micAsked: true,
    wake: false,
  });
  useEffect(() => setPrefs(readPreferences()), []);
  const updatePrefs = (patch: Partial<JarvisPreferences>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writePreferences(next);
      return next;
    });

  const [activeTask, setActiveTask] = useState<JarvisTaskRow | null>(null);
  const taskLive = Boolean(activeTask && !FINISHED.includes(activeTask.status));
  const state = useQuery({
    queryKey: JARVIS_STATE_KEY,
    queryFn: () => readJarvisState(),
    enabled: signedIn,
    refetchInterval: taskLive ? 2500 : 30_000,
  });
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: JARVIS_STATE_KEY }),
    [queryClient],
  );
  const permissions = state.data?.permissions ?? [];
  const jarvisOn = isAllowed(permissions, "master");
  const graph = useMemo(() => buildGraph(state.data), [state.data]);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [liveAnswer, setLiveAnswer] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const [confirmAsk, setConfirmAsk] = useState<{
    summary: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [takeover, setTakeover] = useState<{
    reason: string;
    resolve: (choice: "resume" | "stop") => void;
  } | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [focusOrb, setFocusOrb] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The conversation's open task: the one this tab is running, else the newest unfinished one.
  const conversationTask =
    activeTask && activeTask.conversation_id === conversationId
      ? activeTask
      : (state.data?.tasks.find(
          (t) => t.conversation_id === conversationId && !FINISHED.includes(t.status),
        ) ?? null);
  useEffect(() => {
    if (!activeTask) return;
    const fresh = state.data?.tasks.find((t) => t.id === activeTask.id);
    if (fresh && fresh.updated_at !== activeTask.updated_at) setActiveTask(fresh);
  }, [state.data, activeTask]);

  useEffect(() => {
    setTurns([]);
    setLiveAnswer(null);
    setActiveTask(null);
    if (!conversationId || !signedIn) return;
    let current = true;
    loadChatMessages({ conversationId })
      .then((rows) => {
        if (!current) return;
        setTurns(
          rows
            .filter((r) => r.role === "user" || r.role === "assistant")
            .map((r) => ({ id: r.id, role: r.role as Turn["role"], content: r.content })),
        );
      })
      .catch(() => toast.error("That conversation could not be opened."));
    return () => {
      current = false;
    };
  }, [conversationId, signedIn]);

  const sendRef = useRef<(text: string, fromVoice: boolean) => Promise<void>>(
    async () => undefined,
  );
  const voice = useJarvisVoice((text) => void sendRef.current(text, true), prefs.wake);

  // Signing out ends voice and anything running.
  useEffect(() => {
    if (!loading && !signedIn) {
      voice.end();
      abort.current?.abort();
    }
  }, [loading, signedIn, voice]);

  const send = async (raw: string, fromVoice: boolean) => {
    const text = raw.trim();
    if (!text || running) return;
    if (!signedIn) {
      void navigate({ to: "/auth", search: { next: "/ocade-jarvis" } });
      return;
    }
    if (!jarvisOn) {
      toast.error("OCADE JARVIS is turned off.", { description: "Turn it on in Permissions." });
      return;
    }
    setDraft("");
    let id = conversationId;
    try {
      if (!id) {
        id = crypto.randomUUID();
        await createJarvisConversation({ data: { id } });
        void navigate({ to: "/ocade-jarvis", search: { c: id }, replace: true });
      }
      const saved = await persistChatMessage({ conversationId: id, role: "user", content: text });
      setTurns((list) => [...list, { id: saved.record.id, role: "user", content: text }]);
    } catch {
      toast.error("JARVIS could not save your message.", { description: "Nothing was sent." });
      setDraft(text);
      return;
    }

    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setLiveAnswer(null);
    const history = turns.slice(-20).map((t) => ({ role: t.role, content: t.content }));
    try {
      const out = await runJarvisTurn(
        {
          conversationId: id,
          history,
          text,
          memories: (state.data?.memories ?? []).map((m) => m.content),
          memoryEnabled: isAllowed(permissions, "memory"),
          task: conversationTask,
        },
        {
          signal: controller.signal,
          onText: setLiveAnswer,
          onTask: (task) => setActiveTask(task),
          onActivity: refresh,
          confirm: (summary) => new Promise((resolve) => setConfirmAsk({ summary, resolve })),
          takeOver: (reason) => new Promise((resolve) => setTakeover({ reason, resolve })),
        },
        liveDeps(id),
      );
      if (out.answer) {
        const saved = await persistChatMessage({
          conversationId: id,
          role: "assistant",
          content: out.answer,
        });
        setTurns((list) => [
          ...list,
          { id: saved.record.id, role: "assistant", content: out.answer },
        ]);
        if (fromVoice || voice.state !== "off") voice.speak(out.answer);
      }
    } catch (error) {
      if (error instanceof Stopped) {
        setTurns((list) => [
          ...list,
          { id: crypto.randomUUID(), role: "assistant", content: "Stopped." },
        ]);
      } else if (error instanceof ModelRefused) {
        toast.error(error.message);
      } else {
        toast.error("JARVIS could not finish that.", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      setLiveAnswer(null);
      setRunning(false);
      setConfirmAsk(null);
      setTakeover(null);
      abort.current = null;
      refresh();
    }
  };
  sendRef.current = send;

  const stop = async () => {
    abort.current?.abort();
    confirmAsk?.resolve(false);
    takeover?.resolve("stop");
    setConfirmAsk(null);
    setTakeover(null);
    const task = conversationTask;
    if (task && !FINISHED.includes(task.status)) {
      setActiveTask(await updateJarvisTask({ data: { id: task.id, status: "stopped" } }));
    }
    refresh();
  };

  const takeOverNow = async () => {
    const task = conversationTask;
    if (!task || task.status !== "running") return;
    setActiveTask(
      await updateJarvisTask({
        data: { id: task.id, status: "taken_over", blocker: "You took over." },
      }),
    );
  };

  const resume = async () => {
    if (takeover) {
      takeover.resolve("resume");
      setTakeover(null);
      return;
    }
    const task = conversationTask;
    if (!task) return;
    setActiveTask(
      await updateJarvisTask({ data: { id: task.id, status: "running", blocker: null } }),
    );
    void send("Continue the task from where it stopped.", false);
  };

  const openNode = (node: GraphNode) => {
    if (node.kind === "conversation" && node.recordId) {
      void navigate({ to: "/ocade-jarvis", search: { c: node.recordId } });
      setSelected(null);
    } else if (node.kind === "task") {
      const task = state.data?.tasks.find((t) => t.id === node.recordId);
      if (task) void navigate({ to: "/ocade-jarvis", search: { c: task.conversation_id } });
      setSelected(null);
    } else if (node.category) {
      const map = {
        conversation: "conversations",
        task: "tasks",
        memory: null,
        device: "devices",
        app: "apps",
      } as const;
      const target = map[node.category];
      if (target) setSection(target);
    }
  };

  const hasText = turns.length > 0 || liveAnswer !== null;
  const usage = state.data?.usage;
  const showMicAsk = signedIn && !prefs.micAsked && voice.supported;

  const rail = (mobile: boolean) => (
    <nav
      aria-label="JARVIS"
      className={cn(
        "flex h-full flex-col gap-1 border-r border-border/60 bg-background/80 p-2",
        mobile || prefs.railExpanded ? "w-56" : "w-14",
      )}
    >
      <RailLink to="/" icon={MessageSquare} label="Chat" expanded={mobile || prefs.railExpanded} />
      <RailButton
        icon={PenSquare}
        label="New conversation"
        expanded={mobile || prefs.railExpanded}
        onClick={() => {
          setDrawerOpen(false);
          void navigate({ to: "/ocade-jarvis", search: {} });
        }}
      />
      <div className="my-1 h-px bg-border/60" />
      {SECTIONS.map(({ id, label, icon }) => (
        <RailButton
          key={id}
          icon={icon}
          label={label}
          expanded={mobile || prefs.railExpanded}
          active={section === id}
          onClick={() => setSection((current) => (current === id ? null : id))}
        />
      ))}
      <div className="flex-1" />
      <RailButton
        icon={ShieldCheck}
        label="Permissions"
        expanded={mobile || prefs.railExpanded}
        onClick={() => setPermissionsOpen(true)}
      />
      <RailButton
        icon={theme === "light" ? Moon : Sun}
        label={theme === "light" ? "Dark theme" : "Light theme"}
        expanded={mobile || prefs.railExpanded}
        onClick={() => setAppearance({ theme: theme === "light" ? "dark" : "light" })}
      />
      {mobile ? null : (
        <RailButton
          icon={prefs.railExpanded ? PanelLeftClose : PanelLeftOpen}
          label={prefs.railExpanded ? "Collapse" : "Expand"}
          expanded={prefs.railExpanded}
          onClick={() => updatePrefs({ railExpanded: !prefs.railExpanded })}
        />
      )}
      {signedIn ? null : (
        <Link
          to="/auth"
          search={{ next: "/ocade-jarvis" }}
          className="mt-1 flex h-9 items-center justify-center rounded-md bg-primary px-2 text-sm font-medium text-primary-foreground"
        >
          Sign in
        </Link>
      )}
    </nav>
  );

  const sectionPanel = section ? (
    <SectionPanel
      section={section}
      state={state.data}
      signedIn={signedIn}
      activeConversation={conversationId}
      onClose={() => setSection(null)}
      onOpenConversation={(id) => {
        setDrawerOpen(false);
        void navigate({ to: "/ocade-jarvis", search: { c: id } });
      }}
      onChanged={refresh}
    />
  ) : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a href="#jarvis-composer" className="skip-link">
        Skip to the message box
      </a>
      <div className="hidden h-full md:flex">
        {rail(false)}
        {sectionPanel}
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative flex h-full max-w-full overflow-x-auto bg-background">
            {rail(true)}
            {sectionPanel}
          </div>
        </div>
      ) : null}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <Orb
          graph={graph}
          dimmed={hasText && !focusOrb}
          level={voice.level}
          accent={prefs.accent}
          reducedMotion={motionReduced}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />

        <header className="relative z-10 flex h-12 items-center gap-2 px-3">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent md:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
          <h1 className="text-sm font-medium tracking-wide">OCADE JARVIS</h1>
          <div className="flex-1" />
          {usage ? (
            <p className="hidden text-xs text-muted-foreground sm:block">
              {usage.remaining} of {usage.allowance} JARVIS uses left · resets{" "}
              {describeReset(usage.resetsInMs)}
            </p>
          ) : null}
          {hasText ? (
            <button
              type="button"
              aria-pressed={focusOrb}
              onClick={() => setFocusOrb((value) => !value)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {focusOrb ? "Show conversation" : "Focus orb"}
            </button>
          ) : null}
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
          <section
            aria-label="Conversation"
            className={cn(
              "ocade-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 transition-opacity",
              focusOrb ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-4 pt-4">
              {!hasText && !loading ? (
                <p className="mt-[28vh] text-center text-sm text-muted-foreground">
                  {signedIn
                    ? "Ask anything, or ask JARVIS to do something in your browser."
                    : "Sign in to talk to JARVIS. You can explore the orb without an account."}
                </p>
              ) : null}
              {turns.map((turn) => (
                <p
                  key={turn.id}
                  className={cn(
                    "whitespace-pre-wrap rounded-lg px-3 py-2 text-[15px] leading-relaxed",
                    turn.role === "user"
                      ? "self-end bg-secondary text-secondary-foreground"
                      : "self-start bg-background/70 backdrop-blur",
                  )}
                >
                  {turn.content}
                </p>
              ))}
              {liveAnswer ? (
                <p className="self-start whitespace-pre-wrap rounded-lg bg-background/70 px-3 py-2 text-[15px] backdrop-blur">
                  {liveAnswer}
                </p>
              ) : null}
              {running ? (
                <p role="status" className="self-start text-xs text-muted-foreground">
                  JARVIS is working
                </p>
              ) : null}
              {conversationTask ? (
                <TaskCard
                  task={conversationTask}
                  running={running}
                  onStop={() => void stop()}
                  onTakeOver={() => void takeOverNow()}
                  onResume={() => void resume()}
                />
              ) : null}
              {confirmAsk ? (
                <ConfirmBanner
                  summary={confirmAsk.summary}
                  onDecide={(ok) => {
                    confirmAsk.resolve(ok);
                    setConfirmAsk(null);
                  }}
                />
              ) : null}
              {takeover ? (
                <TakeOverBanner
                  reason={takeover.reason}
                  onResume={() => void resume()}
                  onStop={() => void stop()}
                />
              ) : null}
            </div>
          </section>

          {conversationTask && !FINISHED.includes(conversationTask.status) ? (
            <BrowserPanel
              task={conversationTask}
              open={browserOpen}
              onToggle={() => setBrowserOpen((value) => !value)}
              onStop={() => void stop()}
              onTakeOver={() => void takeOverNow()}
              onResume={() => void resume()}
            />
          ) : null}
        </div>

        <div className="relative z-10 px-3 pb-3">
          <div className="mx-auto max-w-2xl">
            {showMicAsk ? (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm">
                <span className="flex-1">
                  JARVIS can listen when you turn voice on. Allow the microphone?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updatePrefs({ micAsked: true });
                    void navigator.mediaDevices
                      .getUserMedia({ audio: true })
                      .then((media) => media.getTracks().forEach((t) => t.stop()))
                      .catch(() => toast.message("Voice stays off. You can still type."));
                  }}
                  className="rounded-md bg-primary px-3 py-1 text-primary-foreground"
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => updatePrefs({ micAsked: true })}
                  className="rounded-md px-3 py-1 text-muted-foreground hover:bg-accent"
                >
                  Not now
                </button>
              </div>
            ) : null}
            {voice.state !== "off" ? (
              <VoiceBar voice={voice} wake={prefs.wake} onWake={(wake) => updatePrefs({ wake })} />
            ) : null}
            {voice.error ? (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {voice.error}
              </p>
            ) : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft, false);
              }}
              className="glass-strong flex items-end gap-2 rounded-2xl p-2"
            >
              <label htmlFor="jarvis-composer" className="sr-only">
                Message JARVIS
              </label>
              <textarea
                id="jarvis-composer"
                value={draft}
                rows={1}
                maxLength={8000}
                placeholder={
                  !signedIn
                    ? "Sign in to message JARVIS"
                    : jarvisOn
                      ? "Ask JARVIS, or tell it what to do"
                      : "JARVIS is turned off in Permissions"
                }
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft, false);
                  }
                }}
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {voice.supported ? (
                <button
                  type="button"
                  aria-label={voice.state === "off" ? "Start voice" : "End voice"}
                  aria-pressed={voice.state !== "off"}
                  onClick={() => {
                    if (!signedIn) {
                      void navigate({ to: "/auth", search: { next: "/ocade-jarvis" } });
                    } else if (voice.state === "off") void voice.start();
                    else voice.end();
                  }}
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full",
                    voice.state !== "off"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Mic className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
              {running ? (
                <button
                  type="button"
                  aria-label="Stop"
                  onClick={() => void stop()}
                  className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background"
                >
                  <Square className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label={signedIn ? "Send" : "Sign in to send"}
                  disabled={signedIn && !draft.trim()}
                  className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              )}
            </form>
          </div>
        </div>

        {selected ? (
          <NodePanel
            node={selected}
            state={state.data}
            onOpen={() => openNode(selected)}
            onClose={() => setSelected(null)}
            onChanged={refresh}
          />
        ) : null}
      </main>

      {permissionsOpen ? (
        <PermissionsDrawer
          state={state.data}
          signedIn={signedIn}
          accent={prefs.accent}
          onAccent={(accent) => updatePrefs({ accent })}
          onClose={() => setPermissionsOpen(false)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  expanded,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  expanded: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? undefined : label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {expanded ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

function RailLink({
  to,
  icon: Icon,
  label,
  expanded,
}: {
  to: "/";
  icon: LucideIcon;
  label: string;
  expanded: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={expanded ? undefined : label}
      title={label}
      className="flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {expanded ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}
