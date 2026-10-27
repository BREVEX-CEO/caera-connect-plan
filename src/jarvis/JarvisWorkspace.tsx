import { QualityControl } from "@/lib/intelligence/QualityControl";
import { useIntelligenceQuality } from "@/lib/intelligence/use-intelligence-quality";
/**
 * The OCADE JARVIS workspace: a compact rail, the conversation, and the task,
 * browser and voice controls that appear only when they apply.
 */
import type { AskUserQuestionAnswer, AskUserQuestionItem } from "@deepseek-ai/dsh-user-questions";
import type { NormalizedMessage } from "@/lib/intelligence/contract";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Menu,
  MessageSquare,
  MessagesSquare,
  Mic,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Settings,
  Square,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { useFollowBottom } from "@/lib/use-follow-bottom";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useActionChanges } from "./changes";
import { Prose } from "@/components/chat/MessageList";
import { useSettingsPanel } from "@/components/settings/settings-panel";
import { loadChatMessages, persistChatMessage } from "@/lib/ocade-chat-store";
import { describeReset } from "@/lib/commercial/use-commercial-usage";
import { cn, typedBeforeHydration } from "@/lib/utils";
import { runJarvisTurn, Stopped } from "./agent";
import { LiveControl, statusReply, workIntent } from "./live-control";
import { liveDeps, ModelRefused, Unavailable } from "./live-deps";
import { isAllowed } from "./permissions";
import { useAppMention, type AppChoice } from "./mention";
import { FINISHED, mentionedApp } from "./protocol";
import {
  JARVIS_DEFAULTS,
  PREFERENCES_CHANGED,
  readPreferences,
  writePreferences,
  type JarvisPreferences,
} from "./preferences";
import { stopEverywhere } from "./stop-everywhere";
import { useJarvisVoice, voiceCommand } from "./use-voice";
import {
  createJarvisConversation,
  jarvisConversationExists,
  readJarvisState,
  readJarvisTaskHistory,
  updateJarvisTask,
  type JarvisTaskRow,
} from "./jarvis.functions";
import { ConnectDevice, ScopeToggle, SectionPanel, type Section } from "./JarvisPanels";
import {
  BrowserPanel,
  ConfirmBanner,
  QuestionCard,
  TaskCard,
  TakeOverBanner,
  VoiceBar,
} from "./JarvisTask";
import { takeHandOff } from "./bubble-state";

const JARVIS_STATE_KEY = ["jarvis", "state"] as const;
/** The longest provider wait a running task sits out by itself (B07); a longer one is the person's call. */
const SHORT_WAIT_MS = 300_000;

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "conversations", label: "Conversations", icon: MessagesSquare },
];

export function JarvisWorkspace({
  conversationId,
  connectId,
  startVoice = false,
  ask,
  from,
}: {
  conversationId: string | null;
  connectId: string | null;
  /** The person said "Hey OCADE" to their computer: voice starts at once. */
  startVoice?: boolean;
  /** Words a Shortcut opened JARVIS with: they wait in the box for Send. */
  ask?: string;
  /** The phone the OCADE app opened this page from: work runs there unless a PC is named. */
  from?: string;
}) {
  const { user, loading } = useSession();
  const signedIn = Boolean(user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useSettingsPanel();
  const [prefs, setPrefs] = useState<JarvisPreferences>(JARVIS_DEFAULTS);
  useEffect(() => {
    const follow = () => setPrefs(readPreferences());
    follow();
    window.addEventListener(PREFERENCES_CHANGED, follow);
    return () => window.removeEventListener(PREFERENCES_CHANGED, follow);
  }, []);
  const updatePrefs = (patch: Partial<JarvisPreferences>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writePreferences(next);
      return next;
    });

  const [activeTask, setActiveTask] = useState<JarvisTaskRow | null>(null);
  const taskLive = Boolean(activeTask && !FINISHED.includes(activeTask.status));
  const opened = useRef(false);
  const refresh = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: JARVIS_STATE_KEY }),
    [queryClient],
  );
  // A step's change refreshes at once; the interval below is the fail-safe (PLAN.md section E).
  const evented = useActionChanges(refresh, signedIn);
  // Account-owned: keyed by the account, and never read once signed out.
  const state = useQuery({
    queryKey: [...JARVIS_STATE_KEY, user?.id ?? ""],
    // The first read opens JARVIS (and runs retention housekeeping); live
    // refreshes only read.
    queryFn: () =>
      readJarvisState({ data: { maintain: !opened.current } }).finally(() => {
        opened.current = true;
      }),
    enabled: signedIn,
    // Quick while any task is unfinished (not only one this tab runs: a phone
    // watching Remote PC work sees its steps as they happen) or a computer that
    // just connected has not yet said what it can do; otherwise a quiet refresh.
    refetchInterval: (query) =>
      taskLive ||
      (query.state.data?.tasks ?? []).some((task) => !FINISHED.includes(task.status)) ||
      (query.state.data?.devices ?? []).some(
        (d) => d.online && Object.keys(d.capabilities).length === 0,
      )
        ? evented
          ? 15_000
          : 4000
        : 30_000,
  });
  const jarvis = signedIn ? state.data : undefined;
  const permissions = jarvis?.permissions ?? [];
  const jarvisOn = isAllowed(permissions, "master");
  const signInPrompt = useRef<HTMLElement>(null);
  useModalFocus(signInPrompt, Boolean(connectId && !signedIn && !loading));

  const [turns, setTurns] = useState<Turn[]>([]);
  const [liveAnswer, setLiveAnswer] = useState<string | null>(null);
  const { quality, selectQuality } = useIntelligenceQuality(
    `${user?.id ?? ""}:${conversationId ?? ""}`,
  );
  const [draft, setDraft] = useState("");
  // Words typed while the page was still loading become the draft.
  useEffect(() => {
    const typed = typedBeforeHydration("jarvis-composer");
    if (typed) setDraft((current) => current || typed);
  }, []);
  // Taken once and dropped from the address, so a reload or Back does not type it again.
  const asked = useRef(false);
  useEffect(() => {
    if (!ask?.trim() || asked.current) return;
    asked.current = true;
    // One line, as a person would read it in the box: nothing hidden below the fold.
    setDraft((current) => current || ask.replace(/\s+/g, " ").trim().slice(0, 1000));
    void navigate({
      to: "/ocade-jarvis",
      search: (previous) => ({ ...previous, ask: undefined }),
      replace: true,
    });
  }, [ask, navigate]);
  const [running, setRunning] = useState(false);
  // Work was asked for but no computer could take it: a way forward, not just prose.
  const [noDevice, setNoDevice] = useState<string | null>(null);
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
  /** A paused task's own work, given back to the model when it continues. */
  const carried = useRef<{ taskId: string; work: NormalizedMessage[] } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const admitting = useRef(false);
  // The running turn's mailbox and pause switch: the person talks while JARVIS works.
  const live = useRef<LiveControl | null>(null);
  const [paused, setPaused] = useState(false);
  const [confirmAsk, setConfirmAsk] = useState<{
    summary: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const [question, setQuestion] = useState<{
    questions: AskUserQuestionItem[];
    resolve: (answer: AskUserQuestionAnswer) => void;
  } | null>(null);
  const [takeover, setTakeover] = useState<{
    reason: string;
    resolve: (choice: "resume" | "stop") => void;
  } | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [browserOpen, setBrowserOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The computer the person chose for new tasks (Remote PC), when several are online.
  const chosenTarget = prefs.target;
  // A chosen computer that was removed, or belongs to the account signed in
  // before, is no choice at all: every task would start against it and fail.
  const target =
    chosenTarget && jarvis?.devices.some((device) => device.id === chosenTarget)
      ? chosenTarget
      : null;
  // Typing @ lists the apps each computer found; a Never app is not offered.
  const composer = useRef<HTMLTextAreaElement>(null);
  const keptApps = useRef(new Map<string, AppChoice[]>());
  const mention = useAppMention({
    draft,
    setDraft,
    textarea: composer,
    apps: (jarvis?.apps ?? []).flatMap((group) =>
      group.apps
        .filter((app) => app.rule !== "never")
        .map((app) => ({ deviceId: group.deviceId, deviceName: group.deviceName, name: app.name })),
    ),
    multipleDevices: (jarvis?.apps.length ?? 0) > 1,
  });
  // The phone this tab is on, as the OCADE app said when it opened it. A link carrying it
  // opened on a computer is not the phone, so it is believed only on an Android phone.
  const [here, setHere] = useState<string | null>(null);
  useEffect(() => {
    setHere(from && /Android/i.test(navigator.userAgent) ? from : null);
  }, [from]);

  // The conversation's task: the one this tab is running, else the newest unfinished one, else
  // its latest, so a stopped or finished task still shows how it ended and what it made.
  const ofConversation = (jarvis?.tasks ?? []).filter((t) => t.conversation_id === conversationId);
  const conversationTask =
    activeTask && activeTask.conversation_id === conversationId
      ? activeTask
      : (ofConversation.find((t) => !FINISHED.includes(t.status)) ?? ofConversation[0] ?? null);
  useEffect(() => {
    if (!activeTask) return;
    const fresh = jarvis?.tasks.find((t) => t.id === activeTask.id);
    // Only a newer row replaces the one on screen: a slow refresh never undoes a change.
    if (fresh && Date.parse(fresh.updated_at) > Date.parse(activeTask.updated_at))
      setActiveTask(fresh);
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
    setQuestion(null);
    setTakeover(null);
    setRunning(false);
    setTurns([]);
    setLiveAnswer(null);
    setActiveTask(null);
    // A draft belongs to the account and conversation it was typed in. The
    // first screen, and the session arriving, keep what was already typed.
    if (shownFor.current && !shownFor.current.startsWith(":")) setDraft("");
    setNoDevice(null);
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

  const sendRef = useRef<(text: string, fromVoice: boolean, retryOf?: string) => Promise<void>>(
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

  // Leaving JARVIS lets go of the turn: nothing keeps driving or waiting on a decision unseen.
  useEffect(() => () => abort.current?.abort(), []);

  // Signing out ends voice and anything running.
  const endVoice = voice.end;
  useEffect(() => {
    if (!loading && !signedIn) {
      endVoice();
      abort.current?.abort();
    }
  }, [loading, signedIn, endVoice]);

  // `task` is passed when the caller has just changed it (Resume, Try again):
  // this render's copy is still the old one.
  const send = async (
    raw: string,
    fromVoice: boolean,
    retryOf?: string,
    task: JarvisTaskRow | null = conversationTask,
  ) => {
    if (!signedIn) {
      void navigate({ to: "/auth", search: { next: "/ocade-jarvis" } });
      return;
    }
    if (state.isPending || state.isError) {
      toast.error("Your JARVIS account is not ready.", {
        description: state.isError
          ? "Reload account data and try again."
          : "Account data is loading.",
      });
      return;
    }
    const text = raw.trim();
    if (!text) return;
    if (running && live.current && !retryOf) {
      setDraft("");
      void interject(text, fromVoice);
      return;
    }
    // The open task is being driven somewhere else (the computer itself with
    // Background Mode, or another tab). A question about it is answered from its
    // real state, Stop stops it and Wait hands it to the person: asking never
    // takes the work over. Anything else is a new instruction, and does.
    // (`task === conversationTask`: not when the caller just resumed it here.)
    if (!running && !retryOf && conversationId && task === conversationTask) {
      const elsewhere = task?.status === "running" ? task : null;
      const intent = elsewhere ? workIntent(text) : "tell";
      if (elsewhere && intent !== "tell") {
        setDraft("");
        if (intent === "stop") return void stop();
        if (intent === "pause") void takeOverNow();
        return void record(
          conversationId,
          text,
          intent === "pause"
            ? `Pausing “${elsewhere.title}”: only the step in progress finishes. Resume when you're ready.`
            : statusReply(elsewhere, false, lastActivityOf(elsewhere)),
          fromVoice,
        );
      }
    }
    if (running || busyRef.current || transcript !== "ready" || spent) {
      // Said while JARVIS cannot answer yet: kept in the composer, never lost.
      if (fromVoice && !running) setDraft(text);
      return;
    }
    if (!jarvisOn) {
      toast.error("OCADE JARVIS is turned off.", {
        description: "Turn it on in Settings, under Devices & Access.",
      });
      return;
    }
    // The apps named with @ decide which computer this message's work is for (audit F07). A
    // choice from the picker is kept with the saved message, so Retry still aims at it; a name
    // that could mean two computers is asked about, never sent to the default one.
    const aimed = mention.target(text, retryOf ? (keptApps.current.get(retryOf) ?? []) : []);
    if (aimed && "ambiguous" in aimed) {
      toast.error(aimed.ambiguous);
      if (fromVoice) setDraft(text);
      return;
    }
    // One turn at a time, decided before the first await: a second Send or Enter while the
    // first message is still being saved waits in the composer instead of starting a second loop.
    if (admitting.current) {
      if (fromVoice) setDraft(text);
      return;
    }
    admitting.current = true;
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
    const workOn = aimed?.deviceId ?? target;
    const picked = mention.chosenIn(text);
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
        // Saved: the choices go with the message; a save that failed keeps them in the composer.
        keptApps.current.set(saved.record.id, picked);
        mention.reset();
        if (mine()) {
          setTurns((list) => [...list, { id: saved.record.id, role: "user", content: text }]);
        }
      } else if (mine()) {
        // Retry answers the same saved question again; it is never saved twice.
        setTurns((list) => list.slice(0, list.findIndex((t) => t.id === retryOf) + 1));
      }
    } catch {
      admitting.current = false;
      toast.error("JARVIS could not save your message.", { description: "Nothing was sent." });
      if (mine() && !retryOf) setDraft(text);
      return;
    }
    if (!mine()) {
      admitting.current = false;
      return;
    }

    const controller = new AbortController();
    abort.current = controller;
    const liveControl = new LiveControl();
    live.current = liveControl;
    setPaused(false);
    setNoDevice(null);
    setRunning(true);
    setLiveAnswer(null);
    /*
     * A TASK PAUSED BY A BUSY MODEL CONTINUES FROM ITS OWN WORK. Its calls and results were
     * dropped at the pause, so each automatic continue read every page again and spent the
     * person's online capacity on what it had already seen (live Gemini, 13 Oct 2026).
     */
    // Not carried in this tab (a reload, another device, a turn that ended waiting for the
    // person): the task's own history from its record, as the computer would read it (B03).
    const prior =
      task && carried.current?.taskId === task.id
        ? carried.current.work
        : task && !FINISHED.includes(task.status)
          ? await readJarvisTaskHistory({ data: { taskId: task.id } })
              .then((text) => JSON.parse(text) as NormalizedMessage[])
              .catch((): NormalizedMessage[] => [])
          : [];
    const history = [
      ...before.slice(-20).map((t) => ({ role: t.role, content: t.content })),
      ...prior,
    ];
    try {
      const out = await runJarvisTurn(
        {
          conversationId: id,
          quality,
          history,
          text,
          memories: (jarvis?.memories ?? []).map((m) => m.content),
          memoryEnabled: isAllowed(permissions, "memory"),
          task,
          deviceId: workOn,
          hereDeviceId: here,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          devices: jarvis?.devices,
        },
        {
          signal: controller.signal,
          onText: (answer) => mine() && setLiveAnswer(answer),
          onTask: (task) => {
            if (mine()) setActiveTask(task);
            // A finished task is when its one use is charged (on the server): show it now.
            if (task && FINISHED.includes(task.status)) refresh();
          },
          onActivity: refresh,
          onProgress: (work) => {
            const open = activeTaskRef.current;
            // The newest 60 messages: older observations are already only their digest. A result
            // whose call was cut off is dropped when the history is read (pairToolHistory).
            const kept = [...prior, ...work].slice(-60);
            if (open) carried.current = { taskId: open.id, work: kept };
          },
          onNoDevice: (message) => mine() && setNoDevice(message),
          live: liveControl,
          // A question from a conversation no longer on screen is declined.
          confirm: (summary) =>
            mine()
              ? new Promise((resolve) => setConfirmAsk({ summary, resolve }))
              : Promise.resolve(false),
          takeOver: (reason) =>
            mine()
              ? new Promise((resolve) => setTakeover({ reason, resolve }))
              : Promise.resolve("stop" as const),
          // A question from a conversation no longer on screen is answered as unanswered.
          ask: (questions) =>
            mine()
              ? new Promise((resolve) => setQuestion({ questions, resolve }))
              : Promise.resolve({
                  answers: questions.map((q) => ({
                    id: q.id,
                    selected: [],
                    custom: "The person is not here to answer.",
                  })),
                }),
        },
        liveDeps(id, user?.id ?? ""),
      );
      busyStrikes.current = 0;
      carried.current = null; // the turn ended on its own: nothing is left to carry
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
        // A known long wait (the day's online capacity) is waited for whole, once.
        const wait = Math.max(
          error.retryAfterMs ?? 0,
          Math.min(300_000, 30_000 * 2 ** (busyStrikes.current - 1)),
        );
        setBusyUntil(Date.now() + wait);
        const open = activeTaskRef.current;
        if (open && !FINISHED.includes(open.status)) {
          // A short wait is part of the run the person started; a long one (the day's capacity)
          // is not, so the task waits for their Resume instead of continuing unattended (B07).
          resumeAfterBusy.current = wait <= SHORT_WAIT_MS ? open.id : null;
          setActiveTask(
            await updateJarvisTask({
              data: {
                id: open.id,
                status: "waiting",
                blocker:
                  wait > SHORT_WAIT_MS
                    ? `OCADE JARVIS has reached its online capacity for now. It can continue at ${new Date(Date.now() + wait).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}: press Resume then.`
                    : "Waiting for OCADE JARVIS to be available again.",
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
      admitting.current = false;
      if (mine()) {
        setLiveAnswer(null);
        setRunning(false);
        setConfirmAsk(null);
        setQuestion(null);
        setTakeover(null);
      }
      if (abort.current === controller) abort.current = null;
      // Said in the last moment of the turn: answered as the next turn, not lost.
      const unheard = liveControl.drain();
      if (live.current === liveControl) {
        live.current = null;
        setPaused(false);
      }
      refresh();
      if (unheard.length && mine() && !controller.signal.aborted) {
        window.setTimeout(() => void sendRef.current(unheard.join("\n"), fromVoice), 0);
      }
    }
  };

  /** Something said while JARVIS works: answered now, acted on at the next safe point. */
  const interject = async (text: string, fromVoice: boolean) => {
    const control = live.current;
    const id = conversationId;
    if (!control || !id) return;
    const intent = workIntent(text);
    if (intent === "stop") {
      void stop();
      return;
    }
    const task = activeTaskRef.current;
    let reply: string;
    if (intent === "pause") {
      control.pause();
      setPaused(true);
      reply =
        "Paused. I'll finish only the step in progress and wait. Say continue when you're ready.";
    } else if (intent === "continue") {
      if (control.paused) {
        control.resume();
        setPaused(false);
        reply = "Continuing.";
      } else if (takeover) {
        void resume();
        reply = "Taking it back from here.";
      } else {
        reply = statusReply(task, false, lastActivityOf(task));
      }
    } else if (intent === "status") {
      reply = statusReply(task, control.paused, lastActivityOf(task));
    } else {
      control.tell(text);
      reply = control.paused
        ? "Noted. I'll use that when you say continue."
        : "Got it. I'll adjust at the next step.";
    }
    await record(id, text, reply, fromVoice);
  };

  /** What the person said and OCADE's own answer to it (no model): shown, kept and spoken. */
  const record = async (id: string, text: string, reply: string, fromVoice: boolean) => {
    // Answered at once, then kept: two saves in a row once held the answer back past 5 s
    // under load (JOURNEY-27-01), though nothing waits on a model.
    setTurns((list) => [
      ...list,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: crypto.randomUUID(), role: "assistant", content: reply },
    ]);
    if (prefs.speak && (fromVoice || voice.state !== "off")) voice.speak(reply);
    try {
      await persistChatMessage({ conversationId: id, role: "user", content: text });
      await persistChatMessage({ conversationId: id, role: "assistant", content: reply });
    } catch {
      // The reply already reached the person; only the record failed.
    }
  };

  const lastActivityOf = (task: JarvisTaskRow | null) =>
    task ? (jarvis?.activity.find((a) => a.task_id === task.id)?.summary ?? null) : null;
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
        // Only the task this wait put on hold, still waiting for it: not one the person
        // stopped meanwhile, one driven elsewhere, or one that ended.
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
    resumeAfterBusy.current = null; // a stopped task is never picked up again by the wait timer
    live.current?.resume();
    setPaused(false);
    confirmAsk?.resolve(false);
    takeover?.resolve("stop");
    setConfirmAsk(null);
    setTakeover(null);
    const task = conversationTask;
    if (task && !FINISHED.includes(task.status)) {
      try {
        setActiveTask(await updateJarvisTask({ data: { id: task.id, status: "stopped" } }));
      } catch {
        // Never "Stopped." while the computer may still be working: say so, keep STOP in reach.
        toast.error("JARVIS could not stop that task on your computer.", {
          description: "Check your connection and press STOP again.",
        });
      }
    }
    refresh();
  };

  // Resumed somewhere else (the computer's tray, another tab): the waiting turn continues.
  const sawTakenOver = useRef(false);
  useEffect(() => {
    if (!takeover) {
      sawTakenOver.current = false;
      return;
    }
    const status = conversationTask?.status;
    if (status === "taken_over") sawTakenOver.current = true;
    else if (status === "running" && sawTakenOver.current) {
      sawTakenOver.current = false;
      takeover.resolve("resume");
      setTakeover(null);
    }
  }, [takeover, conversationTask?.status]);

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
    if (busyRef.current) {
      // Marked Working now, nobody would drive it: it continues by itself when the wait ends.
      resumeAfterBusy.current = task.id;
      toast("JARVIS will continue this task as soon as it is available again.");
      return;
    }
    const resumed = await updateJarvisTask({
      data: { id: task.id, status: "running", blocker: null },
    });
    setActiveTask(resumed);
    void send("Continue the task from where it stopped.", false, undefined, resumed);
  };

  // Spoken Stop, Pause, Continue and Cancel act at once and are never sent as messages.
  commandRef.current = (text) => {
    const command = voiceCommand(text);
    if (command === "stop") void stop();
    else if (command === "pause") {
      // While JARVIS works, "pause" pauses the work; otherwise it pauses listening.
      if (live.current) void interject(text, true);
      else voice.pause();
    } else if (command === "end") voice.end();
    else if (command === "continue") {
      if (live.current?.paused) void interject(text, true);
      else if (takeover || conversationTask?.status === "taken_over") void resume();
      else return false;
    }
    return command !== null;
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
  // An app named with @ is the one JARVIS uses; the person sees which, as it starts.
  const appNames = (jarvis?.apps ?? []).flatMap((group) => group.apps.map((app) => app.name));
  const lastAsk = [...turns].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const workingWith = mentionedApp(lastAsk, appNames);
  const draftApp = mentionedApp(draft, appNames);
  // The newest turn, answer and task stay in view while the person is at the end; scrolled up
  // to read, they stay put. Their own new message, or a decision waiting, always comes into view.
  const bottom = useRef<HTMLDivElement>(null);
  const newest = `${turns.length}:${liveAnswer?.length ?? 0}:${conversationTask?.id}:${conversationTask?.status}`;
  const followScroll = useFollowBottom(
    bottom,
    newest,
    `${conversationId}:${turns.filter((t) => t.role === "user").length}:${Boolean(confirmAsk)}:${Boolean(takeover)}`,
  );
  // No JARVIS uses left: the composer locks with the reset time, nothing else.
  const spent = Boolean(jarvis?.usage && jarvis.usage.remaining <= 0);

  // A question typed into the phone bubble is asked here, once, when ready.
  useEffect(() => {
    if (!signedIn || !jarvis || transcript !== "ready" || running) return;
    const handed = takeHandOff();
    if (!handed) return;
    // Out of uses, turned off, or carried from Chat: the words wait in the composer, not lost.
    if (spent || !jarvisOn || handed.draftOnly) setDraft(handed.text);
    else {
      // Already saved by the bubble: answered again, never saved twice.
      const saved = handed.savedId && turns.some((t) => t.id === handed.savedId);
      void sendRef.current(handed.text, false, saved ? handed.savedId : undefined);
    }
  }, [signedIn, jarvis, transcript, running, spent, jarvisOn, turns]);
  // The last question that has no answer (or was stopped) can be asked again.
  const last = turns.at(-1);
  const retryTurn =
    !running && !busyUntil && !spent && last
      ? last.role === "user"
        ? last
        : last.content === "Stopped."
          ? [...turns].reverse().find((t) => t.role === "user")
          : undefined
      : undefined;
  const usage = jarvis?.usage;
  const sendBlockedReason = !signedIn
    ? null
    : state.isError
      ? "Your JARVIS account could not be loaded. Reload account data to try again."
      : loading || state.isPending
        ? "Loading your JARVIS account…"
        : spent
          ? "No JARVIS uses left right now. Check Billing & Usage for your reset."
          : transcript !== "ready"
            ? "Open a conversation or start a new one before sending."
            : !jarvisOn
              ? "JARVIS is turned off. Turn it on in Settings, under Devices & Access."
              : !running && busyUntil
                ? "JARVIS is busy. Your draft is kept until it is available."
                : !draft.trim()
                  ? "Write a message to enable Send."
                  : null;

  const rail = (mobile: boolean, expanded = mobile || prefs.railExpanded) => (
    <nav
      aria-label="JARVIS"
      className={cn(
        "flex h-full flex-col gap-1 border-r border-border/60 bg-background/80 p-2",
        expanded ? "w-56" : "w-14",
      )}
    >
      <Link
        to="/"
        aria-label={expanded ? undefined : "Chat"}
        title="Chat"
        className="flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <MessageSquare className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {expanded ? <span className="truncate">Chat</span> : null}
      </Link>
      <RailButton
        icon={PenSquare}
        label="New conversation"
        expanded={expanded}
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
          expanded={expanded}
          active={section === id}
          onClick={() => setSection((current) => (current === id ? null : id))}
        />
      ))}
      <Link
        to="/library"
        aria-label={expanded ? undefined : "Files"}
        title="Files"
        className="flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <LibraryBig className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {expanded ? <span className="truncate">Files</span> : null}
      </Link>
      <div className="flex-1" />
      <RailButton
        icon={Settings}
        label="Settings"
        expanded={expanded}
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
      onTarget={(next) => updatePrefs({ target: next })}
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
        <header className="flex h-12 items-center gap-2 px-3">
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
            <p
              className="text-xs text-muted-foreground"
              title="A JARVIS use is one completed task or one answer. A task that fails or is stopped uses nothing."
            >
              <span className="sm:hidden">{usage.remaining} left</span>
              <span className="hidden sm:inline">
                {usage.remaining} of {usage.allowance} JARVIS uses left
                {usage.resetsInMs === null ? "" : ` · resets ${describeReset(usage.resetsInMs)}`}
              </span>
            </p>
          ) : jarvis?.unlimited ? (
            <p className="text-xs text-muted-foreground">Unlimited JARVIS use</p>
          ) : null}
          {signedIn && (jarvis?.tasks ?? []).some((t) => !FINISHED.includes(t.status)) ? (
            // STOP for every task on every device, in reach whatever panel is closed (the task's
            // own STOP is on its card).
            <button
              type="button"
              aria-label="STOP JARVIS on every device"
              onClick={() => {
                abort.current?.abort();
                resumeAfterBusy.current = null;
                void stopEverywhere(() => {
                  setActiveTask(null);
                  refresh();
                });
              }}
              className="h-8 rounded-full bg-foreground px-3 text-xs font-semibold uppercase tracking-wide text-background"
            >
              Stop all
            </button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section
            aria-label="Conversation"
            onScroll={followScroll}
            className="ocade-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4"
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
              ) : null}
              {transcript === "ready" && !hasText && !conversationTask ? (
                <div className="mt-[22vh] text-center">
                  <h2 className="text-2xl font-semibold tracking-tight">What should JARVIS do?</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ask for something to be done in your browser or on your computer.
                  </p>
                </div>
              ) : null}
              {/* A question is a compact bubble; an answer is prose to read, as in Chat. */}
              {turns.map((turn) =>
                turn.role === "user" ? (
                  <p
                    key={turn.id}
                    className="max-w-[85%] self-end whitespace-pre-wrap rounded-3xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed text-secondary-foreground"
                  >
                    {turn.content}
                  </p>
                ) : (
                  <div key={turn.id} className="self-stretch text-[15px] leading-relaxed">
                    <Prose text={turn.content} />
                  </div>
                ),
              )}
              {liveAnswer ? (
                <div aria-live="polite" className="self-stretch text-[15px] leading-relaxed">
                  <Prose text={liveAnswer} />
                </div>
              ) : null}
              {running && paused ? (
                <div role="status" className="flex items-center gap-2 self-start text-xs">
                  <span className="text-muted-foreground">Paused</span>
                  <button
                    type="button"
                    onClick={() => void interject("continue", false)}
                    className="rounded-full bg-foreground px-3 py-1 text-background"
                  >
                    Continue
                  </button>
                </div>
              ) : running ? (
                <p role="status" className="self-start text-xs text-muted-foreground">
                  {workingWith
                    ? `Continuing with ${workingWith}…`
                    : "JARVIS is working. You can keep talking."}
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
              {noDevice && !running ? (
                <div
                  role="status"
                  className="self-start rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm"
                >
                  <p>{noDevice}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => settings.open("devices")}
                      className="rounded-full bg-foreground px-3 py-1 text-xs text-background"
                    >
                      Connect a computer
                    </button>
                    {retryTurn ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          const ask = [...turns].reverse().find((t) => t.role === "user");
                          if (ask) void send(ask.content, false, ask.id);
                        }}
                        className="rounded-full border border-border px-3 py-1 text-xs"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
              {conversationTask ? (
                <TaskCard
                  task={conversationTask}
                  running={running}
                  using={
                    [
                      jarvis?.devices.find((d) => d.id === conversationTask.device_id)?.name,
                      workingWith,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null
                  }
                  onStop={() => void stop()}
                  onTakeOver={() => void takeOverNow()}
                  onResume={() => void resume()}
                  // The same task again, from its checkpoint: its history stays one record.
                  onRetry={() =>
                    void resume().catch(() =>
                      toast.error("That task cannot restart now. Is its computer busy or offline?"),
                    )
                  }
                  checks={(jarvis?.activity ?? [])
                    .filter((entry) => entry.task_id === conversationTask.id && entry.check)
                    .slice(0, 5)
                    .map((entry) => entry.summary)}
                  latest={jarvis?.activity.find((entry) => entry.task_id === conversationTask.id)}
                  steps={(jarvis?.activity ?? [])
                    .filter(
                      (entry) => entry.task_id === conversationTask.id && entry.status !== "note",
                    )
                    .slice(0, 12)
                    .map((entry) => entry.summary)
                    .reverse()}
                  // A new task through the same planner, checks and receipts: only the inputs change.
                  onRepeat={() => {
                    setDraft(`Do "${conversationTask.title}" again, with these new inputs: `);
                    document.getElementById("jarvis-composer")?.focus();
                  }}
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
              {question ? (
                <QuestionCard
                  questions={question.questions}
                  onAnswer={(answer) => {
                    question.resolve(answer);
                    setQuestion(null);
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
              <div ref={bottom} />
            </div>
          </section>

          {conversationTask && !FINISHED.includes(conversationTask.status) ? (
            <BrowserPanel
              task={conversationTask}
              open={browserOpen}
              onToggle={() => setBrowserOpen((value) => !value)}
            />
          ) : null}
        </div>

        <div className="px-3 pb-3">
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
                  ? ", and your task is saved: it continues by itself at "
                  : conversationTask?.status === "waiting"
                    ? ", and your task is saved. It can continue at "
                    : ". It is available again at "}
                {new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(
                  new Date(busyUntil),
                )}
                {!resumeAfterBusy.current && conversationTask?.status === "waiting"
                  ? ": press Resume then."
                  : "."}
              </p>
            ) : null}
            {voice.error ? (
              <p role="alert" className="mb-2 text-xs text-destructive">
                {voice.error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-x-3">
              <QualityControl
                key={`${user?.id}:${conversationId}`}
                value={
                  conversationTask && !FINISHED.includes(conversationTask.status)
                    ? (conversationTask.checkpoint?.intelligenceQuality ?? "standard")
                    : quality
                }
                onChange={selectQuality}
                disabled={
                  running ||
                  Boolean(conversationTask && !FINISHED.includes(conversationTask.status))
                }
              />
              {signedIn ? (
                <div className="my-2">
                  <ScopeToggle state={jarvis} onChanged={refresh} />
                </div>
              ) : null}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft, false);
              }}
              className="glass-strong relative flex items-end gap-2 rounded-[28px] p-2 pl-3 shadow-sm transition-shadow focus-within:shadow-md"
            >
              {mention.menu}
              <label htmlFor="jarvis-composer" className="sr-only">
                Message JARVIS
              </label>
              <textarea
                id="jarvis-composer"
                ref={composer}
                {...mention.comboboxProps}
                value={draft}
                disabled={signedIn && spent}
                rows={1}
                maxLength={8000}
                placeholder={
                  !signedIn
                    ? "Sign in to talk to JARVIS"
                    : spent
                      ? jarvis?.usage?.resetsInMs
                        ? `JARVIS uses reset ${describeReset(jarvis.usage.resetsInMs)}`
                        : "No JARVIS uses left right now"
                      : running
                        ? "Talk to JARVIS while it works"
                        : busyUntil
                          ? "OCADE JARVIS is busy. It will be back shortly."
                          : jarvisOn
                            ? "Ask or tell JARVIS anything"
                            : "JARVIS is turned off in Settings"
                }
                onChange={(event) => setDraft(event.target.value)}
                onSelect={mention.look}
                onBlur={mention.close}
                onKeyDown={(event) => {
                  // Enter that confirms an input method's composition (Hindi, Japanese, …)
                  // chooses the word; it never sends half a sentence (PLAN Phase 16 V13).
                  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                  if (mention.onKeyDown(event)) return;
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
              {running && !draft.trim() ? (
                <button
                  type="button"
                  aria-label="Stop"
                  onClick={() => void stop()}
                  className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background"
                >
                  <Square className="h-4 w-4" aria-hidden />
                </button>
              ) : running ? (
                <button
                  type="submit"
                  aria-label="Send to JARVIS while it works"
                  className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label={signedIn ? "Send" : "Sign in to send"}
                  disabled={Boolean(sendBlockedReason)}
                  aria-describedby={sendBlockedReason ? "jarvis-send-status" : undefined}
                  title={sendBlockedReason ?? undefined}
                  className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              )}
            </form>
            {sendBlockedReason
              ? null
              : (mention.chosenLine ??
                (draftApp ? (
                  <p className="mt-2 text-xs text-muted-foreground">JARVIS will use {draftApp}.</p>
                ) : null))}
            {sendBlockedReason ? (
              <p
                id="jarvis-send-status"
                role="status"
                className="mt-2 text-xs text-muted-foreground"
              >
                {sendBlockedReason}{" "}
                {state.isError ? (
                  <button type="button" onClick={refresh} className="underline">
                    Reload account data
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      </main>

      {connectId && !signedIn && !loading ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <section
            ref={signInPrompt}
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
