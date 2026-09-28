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
  ListChecks,
  Menu,
  MessageSquare,
  MessagesSquare,
  Mic,
  MonitorSmartphone,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Settings,
  ShieldCheck,
  Square,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { useAppearance } from "@/lib/appearance";
import { useSettingsPanel } from "@/components/settings/settings-panel";
import { loadChatMessages, persistChatMessage } from "@/lib/ocade-chat-store";
import { describeReset } from "@/lib/commercial/use-commercial-usage";
import { cn } from "@/lib/utils";
import { Orb } from "./Orb";
import { buildGraph, type GraphNode } from "./graph";
import { runJarvisTurn, Stopped } from "./agent";
import { liveDeps, ModelRefused, Unavailable } from "./live-deps";
import { isAllowed } from "./permissions";
import { FINISHED } from "./protocol";
import { readPreferences, writePreferences, type JarvisPreferences } from "./preferences";
import { useJarvisVoice, voiceCommand } from "./use-voice";
import {
  createJarvisConversation,
  jarvisConversationExists,
  readJarvisAction,
  readJarvisState,
  stopAllJarvis,
  updateJarvisTask,
  type JarvisTaskRow,
} from "./jarvis.functions";
import {
  ConnectDevice,
  NodePanel,
  PermissionsDrawer,
  SectionPanel,
  type Section,
} from "./JarvisPanels";
import { BrowserPanel, ConfirmBanner, TaskCard, TakeOverBanner, VoiceBar } from "./JarvisTask";

const JARVIS_STATE_KEY = ["jarvis", "state"] as const;

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "conversations", label: "Conversations", icon: MessagesSquare },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "apps", label: "Allowed Apps", icon: AppWindow },
  { id: "devices", label: "Devices", icon: MonitorSmartphone },
];

export function JarvisWorkspace({
  conversationId,
  connectId,
  startVoice = false,
}: {
  conversationId: string | null;
  connectId: string | null;
  /** The person said "Hey OCADE" to their computer: voice starts at once. */
  startVoice?: boolean;
}) {
  const { user, loading } = useSession();
  const signedIn = Boolean(user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { motionReduced } = useAppearance();
  const settings = useSettingsPanel();
  const [prefs, setPrefs] = useState<JarvisPreferences>({
    accent: null,
    railExpanded: false,
    wake: false,
    speak: true,
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
  // Account-owned: keyed by the account, and never read once signed out.
  const state = useQuery({
    queryKey: [...JARVIS_STATE_KEY, user?.id ?? ""],
    queryFn: () => readJarvisState(),
    enabled: signedIn,
    refetchInterval: taskLive ? 2500 : 30_000,
  });
  const jarvis = signedIn ? state.data : undefined;
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: JARVIS_STATE_KEY }),
    [queryClient],
  );
  const permissions = jarvis?.permissions ?? [];
  const jarvisOn = isAllowed(permissions, "master");
  const graph = useMemo(() => buildGraph(jarvis), [jarvis]);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [liveAnswer, setLiveAnswer] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  // OCADE's Online capacity is unavailable: no new turns until this time, then
  // JARVIS continues the saved task by itself. The wait grows while it lasts.
  const [busyUntil, setBusyState] = useState<number | null>(null);
  // Read synchronously by send(), so a resume right after the wait is not refused.
  const busyRef = useRef<number | null>(null);
  const setBusyUntil = (until: number | null) => {
    busyRef.current = until;
    setBusyState(until);
  };
  const busyStrikes = useRef(0);
  const resumeAfterBusy = useRef<string | null>(null);
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
  const [controlsHidden, setControlsHidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The computer the person chose for new tasks (Remote PC), when several are online.
  const [target, setTarget] = useState<string | null>(null);

  // The conversation's open task: the one this tab is running, else the newest unfinished one.
  const conversationTask =
    activeTask && activeTask.conversation_id === conversationId
      ? activeTask
      : (jarvis?.tasks.find(
          (t) => t.conversation_id === conversationId && !FINISHED.includes(t.status),
        ) ?? null);
  useEffect(() => {
    if (!activeTask) return;
    const fresh = jarvis?.tasks.find((t) => t.id === activeTask.id);
    if (fresh && fresh.updated_at !== activeTask.updated_at) setActiveTask(fresh);
  }, [jarvis, activeTask]);

  // ONE OWNER for everything on screen: this account and this conversation.
  // When either changes, the run in progress is abandoned (it still saves its
  // answer to its own conversation), and nothing of the old owner stays
  // visible or sendable: transcript, draft, confirmation, task.
  const owner = `${user?.id ?? ""}:${conversationId ?? ""}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  // The owner whose transcript is on screen; a conversation this tab just
  // created is already on screen and is not reloaded mid-turn.
  const shownFor = useRef<string | null>(null);
  const [transcript, setTranscript] = useState<"ready" | "loading" | "missing" | "failed">("ready");
  const [reloads, setReloads] = useState(0);
  useEffect(() => {
    if (shownFor.current === owner) return;
    abort.current?.abort();
    abort.current = null;
    confirmAsk?.resolve(false);
    takeover?.resolve("stop");
    setConfirmAsk(null);
    setTakeover(null);
    setRunning(false);
    setTurns([]);
    setLiveAnswer(null);
    setActiveTask(null);
    setDraft("");
    if (!conversationId || !user) {
      shownFor.current = owner;
      setTranscript("ready");
      return;
    }
    setTranscript("loading");
    let current = true;
    Promise.all([
      jarvisConversationExists({ data: { id: conversationId } }),
      loadChatMessages({ conversationId }),
    ])
      .then(([{ exists }, rows]) => {
        if (!current) return;
        shownFor.current = owner;
        if (!exists) return setTranscript("missing");
        setTurns(
          rows
            .filter((r) => r.role === "user" || r.role === "assistant")
            .map((r) => ({ id: r.id, role: r.role as Turn["role"], content: r.content })),
        );
        setTranscript("ready");
      })
      .catch(() => current && setTranscript("failed"));
    return () => {
      current = false;
    };
    // The owner string is the whole identity; the rest are setters and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, reloads]);

  const sendRef = useRef<(text: string, fromVoice: boolean) => Promise<void>>(
    async () => undefined,
  );
  const commandRef = useRef<(text: string) => boolean>(() => false);
  const voice = useJarvisVoice((text) => {
    if (!commandRef.current(text)) void sendRef.current(text, true);
  }, prefs.wake);

  const voiceStarted = useRef(false);
  useEffect(() => {
    if (!startVoice || !signedIn || !voice.supported || voiceStarted.current) return;
    voiceStarted.current = true;
    void voice.start();
    void navigate({
      to: "/ocade-jarvis",
      search: conversationId ? { c: conversationId } : {},
      replace: true,
    });
  }, [startVoice, signedIn, voice, conversationId, navigate]);

  // Signing out ends voice and anything running.
  const endVoice = voice.end;
  useEffect(() => {
    if (!loading && !signedIn) {
      endVoice();
      abort.current?.abort();
    }
  }, [loading, signedIn, endVoice]);

  const send = async (raw: string, fromVoice: boolean, retryOf?: string) => {
    const text = raw.trim();
    if (!text || running || busyRef.current || transcript !== "ready") return;
    if (!signedIn) {
      void navigate({ to: "/auth", search: { next: "/ocade-jarvis" } });
      return;
    }
    if (!jarvisOn) {
      toast.error("OCADE JARVIS is turned off.", { description: "Turn it on in Permissions." });
      return;
    }
    // This run belongs to the owner on screen now; every later screen update
    // checks it still does.
    let runOwner = ownerRef.current;
    const mine = () => ownerRef.current === runOwner;
    const before = retryOf
      ? turns.slice(
          0,
          turns.findIndex((t) => t.id === retryOf),
        )
      : turns;
    if (!retryOf) setDraft("");
    let id = conversationId;
    try {
      if (!id) {
        id = crypto.randomUUID();
        await createJarvisConversation({ data: { id } });
        runOwner = `${user?.id ?? ""}:${id}`;
        shownFor.current = runOwner;
        void navigate({ to: "/ocade-jarvis", search: { c: id }, replace: true });
      }
      if (!retryOf) {
        const saved = await persistChatMessage({ conversationId: id, role: "user", content: text });
        if (mine()) {
          setTurns((list) => [...list, { id: saved.record.id, role: "user", content: text }]);
        }
      } else if (mine()) {
        // Retry answers the same saved question again; it is never saved twice.
        setTurns((list) => list.slice(0, list.findIndex((t) => t.id === retryOf) + 1));
      }
    } catch {
      toast.error("JARVIS could not save your message.", { description: "Nothing was sent." });
      if (mine() && !retryOf) setDraft(text);
      return;
    }
    if (!mine()) return;

    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setLiveAnswer(null);
    const history = before.slice(-20).map((t) => ({ role: t.role, content: t.content }));
    try {
      const out = await runJarvisTurn(
        {
          conversationId: id,
          history,
          text,
          memories: (jarvis?.memories ?? []).map((m) => m.content),
          memoryEnabled: isAllowed(permissions, "memory"),
          task: conversationTask,
          deviceId: target,
        },
        {
          signal: controller.signal,
          onText: (answer) => mine() && setLiveAnswer(answer),
          onTask: (task) => mine() && setActiveTask(task),
          onActivity: refresh,
          // A question from a conversation no longer on screen is declined.
          confirm: (summary) =>
            mine()
              ? new Promise((resolve) => setConfirmAsk({ summary, resolve }))
              : Promise.resolve(false),
          takeOver: (reason) =>
            mine()
              ? new Promise((resolve) => setTakeover({ reason, resolve }))
              : Promise.resolve("stop" as const),
        },
        liveDeps(id),
      );
      busyStrikes.current = 0;
      if (out.answer) {
        // Saved to the conversation it belongs to, shown only if still on screen.
        const saved = await persistChatMessage({
          conversationId: id,
          role: "assistant",
          content: out.answer,
        });
        if (mine()) {
          setTurns((list) => [
            ...list,
            { id: saved.record.id, role: "assistant", content: out.answer },
          ]);
          if (prefs.speak && (fromVoice || voice.state !== "off")) voice.speak(out.answer);
        }
      }
    } catch (error) {
      if (!mine()) {
        // Left behind by navigation or sign-out: nothing to show here.
      } else if (error instanceof Stopped || controller.signal.aborted) {
        const content = error instanceof Stopped && error.handedOff ? error.message : "Stopped.";
        // Kept, so the conversation never ends on an unanswered question.
        const saved = await persistChatMessage({ conversationId: id, role: "assistant", content })
          .then((r) => r.record.id)
          .catch(() => crypto.randomUUID());
        if (mine()) setTurns((list) => [...list, { id: saved, role: "assistant", content }]);
      } else if (error instanceof Unavailable) {
        busyStrikes.current += 1;
        const wait = Math.min(300_000, 30_000 * 2 ** (busyStrikes.current - 1));
        setBusyUntil(Date.now() + wait);
        const open = activeTaskRef.current;
        if (open && !FINISHED.includes(open.status)) {
          resumeAfterBusy.current = open.id;
          setActiveTask(
            await updateJarvisTask({
              data: {
                id: open.id,
                status: "waiting",
                blocker: "Waiting for OCADE JARVIS to be available again.",
              },
            }),
          );
        }
      } else if (error instanceof ModelRefused) {
        toast.error(error.message);
      } else {
        // Plain words only; the question stays and Retry answers it again.
        toast.error("JARVIS could not finish that. Try again.");
      }
    } finally {
      if (mine()) {
        setLiveAnswer(null);
        setRunning(false);
        setConfirmAsk(null);
        setTakeover(null);
      }
      if (abort.current === controller) abort.current = null;
      refresh();
    }
  };
  sendRef.current = send;
  const activeTaskRef = useRef<JarvisTaskRow | null>(null);
  activeTaskRef.current = activeTask;

  // When the wait is over, JARVIS is available again: a saved task continues by
  // itself from its checkpoint; anything else simply becomes possible again.
  useEffect(() => {
    if (!busyUntil) return;
    const timer = window.setTimeout(
      () => {
        setBusyUntil(null);
        const id = resumeAfterBusy.current;
        resumeAfterBusy.current = null;
        if (id && conversationTask?.id === id && conversationTask.status === "waiting") {
          void resume();
        }
      },
      Math.max(0, busyUntil - Date.now()),
    );
    return () => window.clearTimeout(timer);
  });

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

  // Spoken Stop, Pause, Continue and Cancel act at once and are never sent as messages.
  commandRef.current = (text) => {
    const command = voiceCommand(text);
    if (command === "stop") void stop();
    else if (command === "pause") voice.pause();
    else if (command === "end") voice.end();
    else if (command === "continue") {
      if (takeover || conversationTask?.status === "taken_over") void resume();
      else return false;
    }
    return command !== null;
  };

  const openNode = (node: GraphNode) => {
    if (node.kind === "conversation" && node.recordId) {
      void navigate({ to: "/ocade-jarvis", search: { c: node.recordId } });
      setSelected(null);
    } else if (node.kind === "task") {
      const task = jarvis?.tasks.find((t) => t.id === node.recordId);
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

  // The phone drawer closes with Escape, whatever section is open inside it.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const hasText = turns.length > 0 || liveAnswer !== null;
  // The last question that has no answer (or was stopped) can be asked again.
  const last = turns.at(-1);
  const retryTurn =
    !running && !busyUntil && last
      ? last.role === "user"
        ? last
        : last.content === "Stopped."
          ? [...turns].reverse().find((t) => t.role === "user")
          : undefined
      : undefined;
  const usage = jarvis?.usage;

  // Orb Focus stays until the person leaves it; the controls around it fade after
  // eight quiet seconds and come back on any movement or key. Stop never fades.
  useEffect(() => {
    if (!focusOrb) {
      setControlsHidden(false);
      return;
    }
    let timer = window.setTimeout(() => setControlsHidden(true), 8000);
    const wake = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setFocusOrb(false);
      setControlsHidden(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setControlsHidden(true), 8000);
    };
    const events = ["pointermove", "pointerdown", "keydown"] as const;
    events.forEach((name) => window.addEventListener(name, wake));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
    };
  }, [focusOrb]);
  const fade = cn(
    "transition-opacity duration-500",
    controlsHidden && "pointer-events-none opacity-0",
  );

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
        icon={Settings}
        label="Settings"
        expanded={mobile || prefs.railExpanded}
        onClick={() => {
          setDrawerOpen(false);
          settings.open();
        }}
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
      state={jarvis}
      signedIn={signedIn}
      activeConversation={conversationId}
      target={target}
      onTarget={setTarget}
      onClose={() => setSection(null)}
      onOpenConversation={(id) => {
        setDrawerOpen(false);
        void navigate({ to: "/ocade-jarvis", search: id ? { c: id } : {} });
      }}
      onChanged={refresh}
    />
  ) : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a href="#jarvis-composer" className="skip-link">
        Skip to the message box
      </a>
      <div className={cn("hidden h-full md:flex", fade)}>
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
          onFocus={() => setFocusOrb((value) => !value)}
          controlsHidden={controlsHidden}
        />

        <header className={cn("relative z-10 flex h-12 items-center gap-2 px-3", fade)}>
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
          <button
            type="button"
            aria-pressed={focusOrb}
            onClick={() => setFocusOrb((value) => !value)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {focusOrb ? "Leave focus" : "Focus orb"}
          </button>
        </header>

        {/* The orb lies behind this layer; only what is on it takes the pointer. */}
        <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
          <section
            aria-label="Conversation"
            className={cn(
              "ocade-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 transition-opacity",
              focusOrb ? "opacity-0" : "opacity-100",
              !focusOrb && (hasText || conversationTask) && "pointer-events-auto",
            )}
            // Empty space around the conversation belongs to the orb behind it.
            onDoubleClick={(event) => {
              if (
                event.target === event.currentTarget ||
                event.target === event.currentTarget.firstChild
              )
                setFocusOrb(true);
            }}
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-4 pt-4">
              {transcript === "loading" ? (
                <div role="status" aria-label="Opening the conversation" className="space-y-3">
                  <div className="ocade-skeleton ml-auto h-9 w-2/5 rounded-2xl" />
                  <div className="ocade-skeleton h-16 w-3/4 rounded-2xl" />
                  <div className="ocade-skeleton ml-auto h-9 w-1/3 rounded-2xl" />
                </div>
              ) : transcript === "missing" || transcript === "failed" ? (
                <div className="mt-[24vh] flex flex-col items-center gap-3 text-center text-sm">
                  <p className="text-muted-foreground">
                    {transcript === "missing"
                      ? "This conversation is not available."
                      : "This conversation could not be opened."}
                  </p>
                  <div className="flex gap-2">
                    {transcript === "failed" ? (
                      <button
                        type="button"
                        onClick={() => {
                          shownFor.current = null;
                          setReloads((n) => n + 1);
                        }}
                        className="rounded-full border border-border px-4 py-1.5 hover:bg-accent"
                      >
                        Try again
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void navigate({ to: "/ocade-jarvis", search: {} })}
                      className="rounded-full bg-foreground px-4 py-1.5 text-background"
                    >
                      New conversation
                    </button>
                  </div>
                </div>
              ) : !hasText && !loading ? (
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
              ) : retryTurn ? (
                <button
                  type="button"
                  onClick={() => void send(retryTurn.content, false, retryTurn.id)}
                  className="self-end rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Retry
                </button>
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

        <div className={cn("relative z-10 px-3 pb-3", !running && !taskLive && fade)}>
          <div className="mx-auto max-w-2xl">
            {voice.state !== "off" ? (
              <VoiceBar
                voice={voice}
                wake={prefs.wake}
                onWake={(wake) => updatePrefs({ wake })}
                speak={prefs.speak}
                onSpeak={(speak) => updatePrefs({ speak })}
              />
            ) : null}
            {busyUntil ? (
              <p
                role="status"
                className="mb-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm"
              >
                OCADE JARVIS is busy right now. Nothing was charged
                {resumeAfterBusy.current
                  ? ", and your task is saved: it continues by itself"
                  : ""}{" "}
                at{" "}
                {new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(
                  new Date(busyUntil),
                )}
                .
              </p>
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
                    : busyUntil
                      ? "OCADE JARVIS is busy. It will be back shortly."
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
                  disabled={signedIn && (!draft.trim() || transcript !== "ready")}
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
            state={jarvis}
            onOpen={() => openNode(selected)}
            onClose={() => setSelected(null)}
            onChanged={refresh}
          />
        ) : null}
      </main>

      {signedIn && (jarvis?.tasks ?? []).some((t) => !FINISHED.includes(t.status)) ? (
        // The one global STOP JARVIS: round, always within reach, on every device.
        <button
          type="button"
          onClick={() => {
            abort.current?.abort();
            void stopAllJarvis()
              .then(async ({ stopped, running }) => {
                setActiveTask(null);
                refresh();
                if (!running.length) {
                  toast.success(stopped ? "JARVIS stopped." : "Nothing was running.");
                  return;
                }
                // A step already running on a computer ends there; say so only
                // once that computer confirms it.
                const id = toast.loading("Stopping…");
                const deadline = Date.now() + 8000;
                while (Date.now() < deadline) {
                  await new Promise((r) => setTimeout(r, 1000));
                  const acks = await Promise.all(
                    running.map((a) => readJarvisAction({ data: { id: a } }).catch(() => null)),
                  );
                  if (
                    acks.every(
                      (a) => (a?.result as { status?: string } | null)?.status === "stopped",
                    )
                  ) {
                    toast.success("JARVIS stopped.", { id });
                    return;
                  }
                }
                toast.warning(
                  "Your computer has not confirmed the stop yet. Check that it is online.",
                  { id },
                );
              })
              .catch(() => toast.error("JARVIS could not be stopped. Try again."));
          }}
          className="fixed bottom-24 left-1/2 z-40 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-foreground text-[10px] font-semibold tracking-wide text-background shadow-lg ring-4 ring-foreground/20 md:bottom-6 md:left-auto md:right-16 md:translate-x-0"
        >
          STOP
          <span className="sr-only"> JARVIS on every device</span>
        </button>
      ) : null}
      {connectId && !signedIn && !loading ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Connect a device"
            className="w-full max-w-sm rounded-xl bg-background p-4 text-sm"
          >
            <p>Sign in to connect this device to your OCADE account.</p>
            <Link
              to="/auth"
              search={{ next: `/ocade-jarvis?connect=${connectId}` }}
              className="mt-3 inline-flex rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
            >
              Sign in
            </Link>
          </section>
        </div>
      ) : null}
      {connectId && signedIn ? (
        <ConnectDevice
          id={connectId}
          onDone={(connected) => {
            if (connected) toast.success("Device connected.");
            refresh();
            void navigate({
              to: "/ocade-jarvis",
              search: conversationId ? { c: conversationId } : {},
              replace: true,
            });
          }}
        />
      ) : null}
      {permissionsOpen ? (
        <PermissionsDrawer
          state={jarvis}
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
