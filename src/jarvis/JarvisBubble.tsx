/**
 * THE FLOATING JARVIS BUBBLE, ON PHONES, EVERYWHERE BUT JARVIS ITSELF.
 *
 * docs/MOBILE_DEVICE_CONTROL.md: a movable, edge-snapping mini JARVIS with the
 * current task, Stop, a mini chat, voice and a way into full JARVIS; settings
 * stay on the website. This is the web/PWA bubble: it floats over OCADE's own
 * pages. A bubble over other apps needs the Android companion and its overlay
 * permission, which this is not and does not pretend to be.
 *
 * One authority for turns: the mini chat runs the same JARVIS turn as the full
 * page and saves to a real JARVIS conversation. When JARVIS wants to start
 * work, the saved question moves to the full page, where confirmations and
 * Take Over live; it is answered there, never saved twice.
 */
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Maximize2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { persistChatMessage } from "@/lib/ocade-chat-store";
import { cn } from "@/lib/utils";
import { runJarvisTurn, Stopped } from "./agent";
import { useActionChanges } from "./changes";
import { handOff, writePlacement, type Placement } from "./bubble-state";
import { createJarvisConversation, readJarvisState, updateJarvisTask } from "./jarvis.functions";
import { liveDeps, ModelRefused, Unavailable } from "./live-deps";
import { isAllowed } from "./permissions";
import { FINISHED } from "./protocol";
import { stopEverywhere } from "./stop-everywhere";
import { useJarvisVoice, voiceCommand } from "./use-voice";
import { statusReply, workIntent } from "./live-control";

const SIZE = 52;
const EDGE = 8;
const TAP_SLOP = 6;

/** JARVIS wants to start work: that belongs on the full page. */
class HandOff extends Error {}

interface Line {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function Bubble({ userId, placement }: { userId: string; placement: Placement }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({ w: innerWidth, h: innerHeight }));
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const conversation = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  /** While JARVIS is temporarily unavailable, as the full page waits: no resend storm. */
  const busyUntil = useRef(0);

  const refreshBubble = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: ["jarvis", "bubble", userId] }),
    [queryClient, userId],
  );
  // Changes arrive as events; the interval is only the fail-safe (PLAN.md section E).
  const evented = useActionChanges(refreshBubble, Boolean(userId));
  const state = useQuery({
    queryKey: ["jarvis", "bubble", userId],
    queryFn: () => readJarvisState({ data: { maintain: false } }),
    refetchInterval: (query) =>
      query.state.data?.tasks.some((task) => !FINISHED.includes(task.status))
        ? evented
          ? 15_000
          : 4000
        : 30_000,
  });
  const task = state.data?.tasks.find((t) => !FINISHED.includes(t.status)) ?? null;
  const working = task?.status === "running";
  const needsYou = task?.status === "waiting" || task?.status === "taken_over";
  const steps = task?.plan.length ?? 0;
  const permissions = state.data?.permissions ?? [];
  const jarvisOn = !state.data || isAllowed(permissions, "master");
  const spent = Boolean(state.data?.usage && state.data.usage.remaining <= 0);
  const voice = useJarvisVoice((heard) => {
    // Voice-only words, as in full JARVIS: "cancel" ends listening, "pause" with nothing running pauses it.
    const command = voiceCommand(heard);
    if (command === "end") voice.end();
    else if (command === "pause" && task?.status !== "running") voice.pause();
    else void ask(heard, true);
  }, false);
  const listening = voice.state === "listening" || voice.state === "starting";
  const status = listening
    ? "Listening…"
    : voice.state === "speaking"
      ? "Speaking…"
      : thinking
        ? "Thinking…"
        : working
          ? steps > 0
            ? `Working · step ${Math.min(task!.current_step + 1, steps)} of ${steps}`
            : "Working"
          : needsYou
            ? "Needs you"
            : state.data
              ? "Ready"
              : "Checking…";

  useEffect(() => {
    const resize = () => setViewport({ w: innerWidth, h: innerHeight });
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []);

  // The panel takes focus when it opens and gives it back when it closes.
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("input")?.focus();
  }, [open]);

  // The newest line stays in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [lines, live, open]);

  // Leaving (sign-out, another account, a wide screen) stops what runs here.
  const endVoice = voice.end;
  useEffect(
    () => () => {
      abort.current?.abort();
      endVoice();
    },
    [endVoice],
  );

  const maxY = viewport.h - SIZE - 88;
  const restX = placement.side === "left" ? EDGE : viewport.w - SIZE - EDGE;
  const restY = Math.min(Math.max(placement.y * viewport.h, EDGE + 48), maxY);
  const x = drag?.x ?? restX;
  const y = drag?.y ?? restY;

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { px: event.clientX, py: event.clientY, x, y, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const origin = start.current;
    if (!origin) return;
    const dx = event.clientX - origin.px;
    const dy = event.clientY - origin.py;
    if (!origin.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    origin.moved = true;
    setOpen(false);
    setDrag({
      x: Math.min(Math.max(origin.x + dx, 0), viewport.w - SIZE),
      y: Math.min(Math.max(origin.y + dy, EDGE), maxY),
    });
  };
  const onPointerUp = () => {
    const origin = start.current;
    start.current = null;
    if (!origin?.moved) {
      setOpen((value) => !value);
      return;
    }
    // Snap to the nearer edge; the transition carries it there.
    if (drag) {
      writePlacement({
        side: drag.x + SIZE / 2 < viewport.w / 2 ? "left" : "right",
        y: drag.y / viewport.h,
      });
    }
    setDrag(null);
  };

  // The phone's Stop is STOP JARVIS: every task, every computer, "Stopped" only once confirmed.
  const stop = () =>
    stopEverywhere(() => void queryClient.invalidateQueries({ queryKey: ["jarvis"] }));

  const setTaskStatus = async (status: "running" | "taken_over", blocker: string | null) => {
    if (!task) return;
    try {
      await updateJarvisTask({ data: { id: task.id, status, blocker } });
    } catch {
      toast.error("JARVIS could not do that from here. Open JARVIS and try again.");
    }
    await queryClient.invalidateQueries({ queryKey: ["jarvis"] });
  };

  /**
   * STOP, wait, continue and "what are you doing?" act at once while something
   * runs — never sent as a new question the model would merely talk about.
   * Pausing from here is Take Over: the tab driving the task waits at its
   * checkpoint and carries on when this says continue.
   */
  const control = (text: string, fromVoice: boolean): boolean => {
    const intent = workIntent(text);
    if (intent === "stop" && (task || abort.current)) {
      abort.current?.abort();
      void stop();
      return true;
    }
    if (!task) return false;
    if (intent === "status") {
      const reply = statusReply(task, false);
      say({ id: crypto.randomUUID(), role: "user", content: text });
      say({ id: crypto.randomUUID(), role: "assistant", content: reply });
      if (fromVoice) voice.speak(reply);
      return true;
    }
    if (intent === "pause" && task.status === "running") {
      void setTaskStatus("taken_over", "Paused from the JARVIS bubble.");
      return true;
    }
    if (intent === "continue" && task.status === "taken_over") {
      void setTaskStatus("running", null);
      return true;
    }
    return false;
  };

  const openJarvis = (c = conversation.current ?? task?.conversation_id) => {
    setOpen(false);
    void navigate({ to: "/ocade-jarvis", search: c ? { c } : {} });
  };

  const say = (line: Line) => setLines((current) => [...current, line]);

  async function ask(raw: string, fromVoice = false) {
    const text = raw.trim();
    if (!text) return;
    if (control(text, fromVoice)) {
      setDraft("");
      return;
    }
    if (abort.current || spent) return;
    if (Date.now() < busyUntil.current) {
      toast.error("OCADE JARVIS is temporarily unavailable.", {
        description: "Your message is kept. Try again in a moment.",
      });
      return;
    }
    if (!jarvisOn) {
      toast.error("OCADE JARVIS is turned off.", { description: "Turn it on in JARVIS." });
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setDraft("");
    let id = conversation.current;
    let savedId: string;
    try {
      if (!id) {
        id = crypto.randomUUID();
        await createJarvisConversation({ data: { id } });
        conversation.current = id;
      }
      savedId = (await persistChatMessage({ conversationId: id, role: "user", content: text }))
        .record.id;
    } catch {
      abort.current = null;
      toast.error("JARVIS could not save your message.", { description: "Nothing was sent." });
      setDraft(text);
      return;
    }
    const history = lines.slice(-10).map(({ role, content }) => ({ role, content }));
    say({ id: savedId, role: "user", content: text });
    setThinking(true);
    setLive(null);
    try {
      const out = await runJarvisTurn(
        {
          conversationId: id,
          history,
          text,
          memories: (state.data?.memories ?? []).map((memory) => memory.content),
          memoryEnabled: isAllowed(permissions, "memory"),
          task: null,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          devices: state.data?.devices,
        },
        {
          signal: controller.signal,
          onText: setLive,
          onTask: () => undefined,
          onActivity: () => undefined,
          // Unreachable here: work always moves to the full page first.
          confirm: async () => false,
          takeOver: async () => "stop" as const,
        },
        {
          ...liveDeps(id),
          startTask: async () => {
            throw new HandOff();
          },
        },
      );
      if (!out.answer) {
        say({ id: crypto.randomUUID(), role: "assistant", content: "No JARVIS uses left now." });
      } else {
        const saved = await persistChatMessage({
          conversationId: id,
          role: "assistant",
          content: out.answer,
        });
        say({ id: saved.record.id, role: "assistant", content: out.answer });
        if (fromVoice) voice.speak(out.answer);
      }
    } catch (error) {
      if (error instanceof HandOff) {
        voice.end();
        handOff({ text, savedId });
        openJarvis(id);
      } else if (error instanceof Stopped || controller.signal.aborted) {
        // Kept, so the conversation never ends on an unanswered question.
        const saved = await persistChatMessage({
          conversationId: id,
          role: "assistant",
          content: "Stopped.",
        }).catch(() => null);
        say({
          id: saved?.record.id ?? crypto.randomUUID(),
          role: "assistant",
          content: "Stopped.",
        });
      } else if (error instanceof Unavailable || error instanceof ModelRefused) {
        if (error instanceof Unavailable) busyUntil.current = Date.now() + 30_000;
        toast.error(error.message);
      } else {
        toast.error("JARVIS could not finish that. Try again.");
      }
    } finally {
      abort.current = null;
      setThinking(false);
      setLive(null);
      void queryClient.invalidateQueries({ queryKey: ["jarvis", "bubble"] });
    }
  }

  const panelBelow = y < viewport.h / 2;

  return (
    <>
      {open ? (
        <div
          ref={panel}
          role="dialog"
          aria-label="JARVIS"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              button.current?.focus();
            }
          }}
          style={{
            top: panelBelow ? y + SIZE + 8 : undefined,
            bottom: panelBelow ? undefined : viewport.h - y + 8,
          }}
          className={cn(
            "fixed z-50 w-[min(22rem,calc(100vw-1rem))] rounded-2xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur-xl",
            "ocade-pop",
            placement.side === "left" ? "left-2 origin-top-left" : "right-2 origin-top-right",
          )}
        >
          <div className="flex items-center gap-2">
            <Core working={working || thinking || listening} level={voice.level} size={20} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">JARVIS</p>
              <p className="truncate text-xs text-muted-foreground" aria-live="polite">
                {status}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openJarvis()}
              aria-label="Open full JARVIS"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
              aria-label="Collapse"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {task ? (
            <div className="mt-3 rounded-xl border border-border/60 p-3">
              <p className="line-clamp-2 text-sm text-foreground">{task.title}</p>
              {steps > 0 ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-info transition-[width] duration-500"
                    style={{ width: `${(Math.min(task.current_step, steps) / steps) * 100}%` }}
                  />
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void stop()}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-destructive/50 px-3 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
                  Stop
                </button>
                {needsYou ? (
                  <button
                    type="button"
                    onClick={() => openJarvis(task.conversation_id)}
                    className="h-9 rounded-full border border-border px-3 text-sm text-foreground hover:bg-accent"
                  >
                    Continue in JARVIS
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {lines.length > 0 || thinking ? (
            <div
              ref={list}
              aria-label="Mini chat"
              className="mt-3 flex max-h-[min(40vh,18rem)] flex-col gap-2 overflow-y-auto overscroll-contain pr-1"
            >
              {lines.map((line) => (
                <p
                  key={line.id}
                  className={cn(
                    "ocade-pop whitespace-pre-wrap text-sm leading-relaxed text-foreground",
                    line.role === "user"
                      ? "ml-10 self-end rounded-2xl rounded-br-md bg-muted px-3 py-2"
                      : "mr-4",
                  )}
                >
                  {line.content}
                </p>
              ))}
              {thinking ? (
                <p
                  className="mr-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                  aria-live="polite"
                >
                  {live ?? <Dots />}
                </p>
              ) : null}
            </div>
          ) : null}

          <form
            className="mt-3 flex items-center gap-1.5 rounded-full border border-border/70 pl-3 transition-colors focus-within:border-ring"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ask JARVIS</span>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={spent ? "No JARVIS uses left now" : "Ask JARVIS…"}
                disabled={spent}
                maxLength={4000}
                className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            {voice.supported ? (
              <button
                type="button"
                onClick={() => (voice.state === "off" ? void voice.start() : voice.end())}
                aria-label={voice.state === "off" ? "Talk to JARVIS" : "End voice"}
                aria-pressed={voice.state !== "off"}
                disabled={spent}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-40",
                  voice.state === "off"
                    ? "text-muted-foreground hover:bg-accent"
                    : "bg-info/15 text-info",
                )}
              >
                <Mic className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            {thinking ? (
              <button
                type="button"
                onClick={() => abort.current?.abort()}
                aria-label="Stop answer"
                className="mr-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() || spent}
                aria-label="Send"
                className="mr-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
            )}
          </form>

          {voice.error ? (
            <p className="mt-2 px-1 text-xs text-muted-foreground" role="status">
              {voice.error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              writePlacement({ hidden: true });
              toast("JARVIS bubble hidden.", {
                description: "Settings › Appearance brings it back.",
              });
            }}
            className="mt-2 w-full py-1 text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Hide bubble
          </button>
        </div>
      ) : null}

      <button
        ref={button}
        type="button"
        aria-label={`JARVIS, ${status}`}
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        style={{ transform: `translate3d(${x}px, ${y}px, 0)`, width: SIZE, height: SIZE }}
        className={cn(
          "fixed left-0 top-0 z-50 flex touch-none select-none items-center justify-center rounded-full border border-border/70 bg-background/80 shadow-lg backdrop-blur-xl",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !drag && "transition-transform duration-300 ease-[var(--ease-premium)]",
          drag && "scale-105 shadow-xl",
        )}
      >
        <Core working={working || thinking || listening} level={voice.level} size={22} />
        {needsYou ? (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-info" />
        ) : null}
      </button>
    </>
  );
}

/** Three soft dots while the first words are on their way. */
function Dots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="JARVIS is thinking">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
          style={{ animationDelay: `${dot * 160}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * The orb's glass core in miniature: a thin ring turns while JARVIS works or
 * listens, and the core breathes with the voice level.
 */
function Core({ working, level = 0, size }: { working: boolean; level?: number; size: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 transition-transform duration-150"
      style={{ width: size, height: size, transform: `scale(${1 + Math.min(level, 1) * 0.25})` }}
    >
      {working ? (
        <span
          className="absolute -inset-1.5 animate-spin rounded-full border-2 border-info/20 border-t-info [animation-duration:1.4s] motion-reduce:animate-none"
          aria-hidden
        />
      ) : null}
      <span
        className="h-full w-full rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--foreground),color-mix(in_oklab,var(--foreground)_25%,transparent)_60%,transparent_75%)] shadow-[0_0_12px_color-mix(in_oklab,var(--foreground)_35%,transparent)]"
        aria-hidden
      />
    </span>
  );
}
