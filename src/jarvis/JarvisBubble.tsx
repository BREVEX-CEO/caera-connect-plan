/**
 * THE FLOATING JARVIS BUBBLE, ON PHONES, EVERYWHERE BUT JARVIS ITSELF.
 *
 * docs/MOBILE_DEVICE_CONTROL.md: a movable, edge-snapping mini JARVIS with the
 * current task, Stop, a quick ask, voice and a way into full JARVIS; settings
 * stay on the website. This is the web/PWA bubble: it floats over OCADE's own
 * pages. A bubble over other apps needs the Android companion and its overlay
 * permission, which this is not and does not pretend to be.
 *
 * One authority for turns: a quick ask is handed to the full JARVIS page, which
 * sends it (confirmations and Take Over live there). The bubble only reads
 * state and can stop a task.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { handOff, useBubblePlacement, writePlacement, type Placement } from "./bubble-state";
import { ArrowUp, ChevronDown, Maximize2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { FINISHED } from "./protocol";
import { readJarvisState, updateJarvisTask } from "./jarvis.functions";

const SIZE = 52;
const EDGE = 8;
const TAP_SLOP = 6;

function usePhoneWidth(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia("(max-width: 767px)");
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

const HIDDEN_ON = /^\/(ocade-jarvis|auth|reset-password)/;

export function JarvisBubble() {
  const { user } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const phone = usePhoneWidth();
  const placement = useBubblePlacement();
  const shown = Boolean(user) && phone && !placement.hidden && !HIDDEN_ON.test(pathname);
  return shown ? <Bubble userId={user!.id} placement={placement} /> : null;
}

function Bubble({ userId, placement }: { userId: string; placement: Placement }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState("");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({ w: innerWidth, h: innerHeight }));
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const state = useQuery({
    queryKey: ["jarvis", "bubble", userId],
    queryFn: () => readJarvisState({ data: { maintain: false } }),
    refetchInterval: (query) =>
      query.state.data?.tasks.some((task) => !FINISHED.includes(task.status)) ? 4000 : 30_000,
  });
  const task = state.data?.tasks.find((t) => !FINISHED.includes(t.status)) ?? null;
  const working = task?.status === "running";
  const needsYou = task?.status === "waiting" || task?.status === "taken_over";
  const steps = task?.plan.length ?? 0;
  const status = working
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

  const stop = async () => {
    if (!task) return;
    try {
      await updateJarvisTask({ data: { id: task.id, status: "stopped" } });
      toast.success("JARVIS stopped.");
    } catch {
      toast.error("JARVIS could not be stopped from here. Open JARVIS and press Stop.");
    }
    await queryClient.invalidateQueries({ queryKey: ["jarvis"] });
  };

  const openJarvis = (extra: { voice?: number } = {}) => {
    setOpen(false);
    void navigate({
      to: "/ocade-jarvis",
      search: { ...(task ? { c: task.conversation_id } : {}), ...extra },
    });
  };

  const send = () => {
    const text = ask.trim();
    if (!text) return;
    handOff(text);
    setAsk("");
    openJarvis();
  };

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
            <Core working={working} size={20} />
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
                    onClick={() => openJarvis()}
                    className="h-9 rounded-full border border-border px-3 text-sm text-foreground hover:bg-accent"
                  >
                    Continue in JARVIS
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <form
            className="mt-3 flex items-center gap-1.5 rounded-full border border-border/70 pl-3"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ask JARVIS</span>
              <input
                value={ask}
                onChange={(event) => setAsk(event.target.value)}
                placeholder="Ask JARVIS…"
                maxLength={4000}
                className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="button"
              onClick={() => openJarvis({ voice: 1 })}
              aria-label="Talk to JARVIS"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <Mic className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="submit"
              disabled={!ask.trim()}
              aria-label="Send"
              className="mr-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </form>

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
        )}
      >
        <Core working={working} size={22} />
        {needsYou ? (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-info" />
        ) : null}
      </button>
    </>
  );
}

/** The orb's glass core in miniature; a thin ring turns while JARVIS works. */
function Core({ working, size }: { working: boolean; size: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
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
