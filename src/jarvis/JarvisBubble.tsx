/**
 * THE FLOATING JARVIS BUBBLE, ON PHONES, EVERYWHERE BUT JARVIS ITSELF.
 *
 * A movable, edge-snapping mini JARVIS with a way into full JARVIS. Words typed
 * here open JARVIS with them in its box; they are never sent from the bubble.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Maximize2, Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MAX_OBJECTIVE_LENGTH } from "@/lib/jarvis/objective";
import { handOff, writePlacement, type Placement } from "./bubble-state";

const SIZE = 52;
const EDGE = 8;
const TAP_SLOP = 6;

export function Bubble({ placement }: { placement: Placement }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({ w: innerWidth, h: innerHeight }));
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const status = "Ready";
  const [words, setWords] = useState("");

  useEffect(() => {
    const resize = () => setViewport({ w: innerWidth, h: innerHeight });
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []);

  // The panel takes focus when it opens and gives it back when it closes.
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("button")?.focus();
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

  const openJarvis = (ask?: string) => {
    setOpen(false);
    if (ask?.trim()) handOff({ text: ask });
    void navigate({ to: "/ocade-jarvis", search: {} });
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
            <Core size={20} />
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

          <form
            className="mt-3 flex items-center gap-1.5 rounded-full border border-border/70 pl-3 transition-colors focus-within:border-ring"
            onSubmit={(event) => {
              event.preventDefault();
              openJarvis(words);
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ask JARVIS</span>
              <input
                placeholder="What should JARVIS do?"
                value={words}
                maxLength={MAX_OBJECTIVE_LENGTH}
                onChange={(event) => setWords(event.target.value)}
                className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="button"
              disabled
              aria-label="Talk to JARVIS"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors disabled:opacity-40"
            >
              <Mic className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="submit"
              disabled={!words.trim()}
              aria-label="Open in JARVIS"
              className="mr-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </form>

          <p className="mt-2 px-1 text-xs text-muted-foreground" role="status">
            JARVIS works on a computer you paired. Your words wait in JARVIS until you send them.
          </p>

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
        <Core size={22} />
      </button>
    </>
  );
}

/** The orb's glass core in miniature. */
function Core({ size }: { size: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="h-full w-full rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--foreground),color-mix(in_oklab,var(--foreground)_25%,transparent)_60%,transparent_75%)] shadow-[0_0_12px_color-mix(in_oklab,var(--foreground)_35%,transparent)]"
        aria-hidden
      />
    </span>
  );
}
