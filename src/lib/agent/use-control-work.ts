/**
 * The Control + Work session: one conversation that operates the computer.
 *
 * WHY THIS IS SEPARATE FROM CHAT
 * ------------------------------
 * OCADE Chat answers questions. Control + Work touches the machine. Sharing a
 * single surface for both means a person asking "how do I close these tabs?"
 * cannot tell whether they are about to receive an explanation or have their
 * tabs closed — and neither can the router. The runtime intent is therefore
 * explicit and structural: Chat never constructs a live-world runtime, and this
 * hook always does. They share the brain, the history and the design language;
 * they do not share the question of whether anything is about to happen.
 *
 * WHAT THIS OWNS
 * --------------
 * The mission lifecycle, and only that. Perception, tool routing, verification
 * and recovery already live in `live-world-loop` and `live-world-fabric`; this
 * neither reimplements nor wraps them in policy of its own. It creates the
 * runtime, starts a mission, surfaces progress in the words a user reads, and
 * exposes the three controls a person actually needs while a machine is acting
 * on their behalf: pause, stop, and take over.
 *
 * TAKE OVER IS NOT A BUTTON THAT DOES NOTHING
 * -------------------------------------------
 * When the user touches the mouse or keyboard mid-mission, OCADE must stop
 * competing for the pointer. Automation that fights its owner for control of
 * their own machine is worse than automation that stops, because the user
 * cannot tell which movements are theirs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveWorldAgent, type LiveWorldTraceEvent } from "./live-world-loop";
import { createDesktopLiveWorldRuntime } from "./live-world-fabric";
import { DEFAULT_LOCAL_BRIDGE_URL } from "../ocade-local";

/** What the surface is doing right now, in the user's terms. */
export type WorkState =
  "idle" | "listening" | "thinking" | "executing" | "speaking" | "paused" | "stopped" | "error";

export interface WorkTurn {
  id: string;
  role: "user" | "ocade";
  text: string;
  /** Short progress lines shown under an OCADE turn while it works. */
  progress?: string[];
  /** Set once the mission finished, so the UI can mark it honestly. */
  outcome?: "verified" | "blocked" | "cancelled" | "failed";
  at: string;
}

export interface ControlWorkSession {
  state: WorkState;
  turns: WorkTurn[];
  /** Null until checked. False with a reason when the computer is unreachable. */
  ready: { ready: boolean; reason?: string } | null;
  busy: boolean;
  /** True while the user is driving; OCADE holds off rather than competing. */
  userHasControl: boolean;
  send: (goal: string) => Promise<void>;
  pause: () => void;
  stop: () => void;
  takeOver: () => void;
  resume: () => void;
}

/**
 * Turn a trace event into one plain sentence, or nothing.
 *
 * Deliberately lossy. The trace carries tool names, routes and typed statuses
 * because the loop needs them; a person watching their own computer being
 * operated needs to know what is happening to it, not which module is speaking.
 * Anything with no human meaning returns null and is never rendered.
 */
export function describeProgress(event: LiveWorldTraceEvent): string | null {
  const record = event as unknown as Record<string, unknown>;
  const kind = String(record.type ?? record.kind ?? "");
  const detail = typeof record.evidence === "string" ? record.evidence : undefined;

  if (kind.includes("observ")) return "Looking at your screen…";
  if (kind.includes("plan") || kind.includes("think")) return "Working out the next step…";
  if (kind.includes("tool") || kind.includes("action")) {
    // The evidence sentence is already written for people by the fabric.
    return detail ?? "Carrying out the next step…";
  }
  if (kind.includes("verif")) return detail ?? "Checking that it actually worked…";
  if (kind.includes("retr") || kind.includes("fallback")) {
    return detail ?? "That route did not work — trying another way…";
  }
  return null;
}

const MAX_PROGRESS_LINES = 6;

export function useControlWork(options?: {
  /** Autonomy from the GUI. Manual and assisted still stop to confirm. */
  autonomous?: () => boolean;
  totalRamBytes?: number;
  modelId?: string | null;
}): ControlWorkSession {
  const [state, setState] = useState<WorkState>("idle");
  const [turns, setTurns] = useState<WorkTurn[]>([]);
  const [ready, setReady] = useState<{ ready: boolean; reason?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [userHasControl, setUserHasControl] = useState(false);

  const agentRef = useRef<LiveWorldAgent | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autonomous = options?.autonomous;

  const runtime = useMemo(
    () =>
      createDesktopLiveWorldRuntime({
        confirmed: () => autonomous?.() ?? false,
      }),
    [autonomous],
  );

  /*
   * BOOTSTRAP FIRST, THEN ASK.
   *
   * `runtime.ready()` reads `getCompanion().status()`, and `getCompanion()`
   * returns the honest UNAVAILABLE adapter until `bootstrapCompanion()` has
   * completed a signed handshake and installed the real one. Every other
   * surface that touches the companion calls it; this one did not, so readiness
   * would have reported false inside the desktop application itself — a
   * self-inflicted "OCADE cannot reach this computer" on a computer it could
   * reach perfectly well.
   *
   * Dynamically imported so the Tauri bridge never enters the browser bundle.
   */
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { bootstrapCompanion } = await import("../native/tauri-companion");
        const boot = await bootstrapCompanion();
        if (!live) return;
        if (!boot.installed) {
          setReady({ ready: false, reason: boot.reason });
          return;
        }
        const result = await runtime.ready();
        if (live) setReady(result);
      } catch (error) {
        if (!live) return;
        setReady({
          ready: false,
          reason: error instanceof Error ? error.message : "The computer could not be reached.",
        });
      }
    })();
    return () => {
      live = false;
    };
  }, [runtime]);

  /*
   * TAKE OVER IS EXPLICIT, NOT DETECTED — for now, and deliberately.
   *
   * The first version of this listened for `pointerdown` and `keydown` on the
   * window and treated them as "the user grabbed the mouse". That is exactly
   * backwards. A web page receives input events only for its OWN window, so
   * while a mission is typing into Notepad this surface sees nothing at all;
   * the only events it can ever receive are the user pressing OCADE's own Pause
   * button or typing in this composer. It would therefore have paused every
   * mission the moment someone touched the interface, and stayed silent in the
   * one case it was written for.
   *
   * Genuine detection has to come from the native host, which can see
   * system-wide input. Until that is wired, the button below is the honest
   * mechanism: the user says they are taking over, and OCADE stops competing.
   */

  const appendProgress = useCallback((turnId: string, line: string) => {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              progress: [...(turn.progress ?? []), line].slice(-MAX_PROGRESS_LINES),
            }
          : turn,
      ),
    );
  }, []);

  const send = useCallback(
    async (goal: string) => {
      const text = goal.trim();
      if (!text || busy) return;

      /*
       * A redirect, not a second mission.
       *
       * Sending while a mission runs means "actually, do this instead". The
       * loop keeps everything already completed and re-plans the rest, which is
       * the whole reason `redirect` exists — starting a fresh mission would
       * repeat finished work, including anything irreversible.
       */
      if (agentRef.current && busy) {
        agentRef.current.redirect(text);
        return;
      }

      const now = new Date().toISOString();
      const userTurn: WorkTurn = { id: `u${Date.now()}`, role: "user", text, at: now };
      const ocadeTurn: WorkTurn = {
        id: `o${Date.now()}`,
        role: "ocade",
        text: "",
        progress: [],
        at: now,
      };
      setTurns((current) => [...current, userTurn, ocadeTurn]);
      setBusy(true);
      setUserHasControl(false);
      setState("thinking");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const agent = new LiveWorldAgent({
          bridgeUrl: DEFAULT_LOCAL_BRIDGE_URL,
          modelId: options?.modelId ?? "",
          tools: runtime.tools,
          observe: runtime.observe,
          ...(options?.totalRamBytes ? { totalRamBytes: options.totalRamBytes } : {}),
          initialMessages: turns
            .filter((turn) => turn.text)
            .map((turn) => ({
              role: turn.role === "user" ? ("user" as const) : ("assistant" as const),
              content: turn.text,
            })),
          onProgress: (event) => {
            const line = describeProgress(event);
            if (line) {
              setState("executing");
              appendProgress(ocadeTurn.id, line);
            }
          },
        });
        agentRef.current = agent;

        const result = await agent.run(text, controller.signal);
        const outcome: WorkTurn["outcome"] =
          result.status === "completed"
            ? "verified"
            : result.status === "cancelled"
              ? "cancelled"
              : result.status === "blocked"
                ? "blocked"
                : "failed";
        setTurns((current) =>
          current.map((turn) =>
            turn.id === ocadeTurn.id ? { ...turn, text: result.message, outcome } : turn,
          ),
        );
        setState(outcome === "verified" ? "idle" : outcome === "cancelled" ? "stopped" : "error");
      } catch (error) {
        setTurns((current) =>
          current.map((turn) =>
            turn.id === ocadeTurn.id
              ? {
                  ...turn,
                  // The real reason, not a generic apology. A person whose
                  // computer just refused an instruction needs to know why.
                  text:
                    error instanceof Error
                      ? error.message
                      : "OCADE could not finish that on this computer.",
                  outcome: "failed",
                }
              : turn,
          ),
        );
        setState("error");
      } finally {
        agentRef.current = null;
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, runtime, turns, options?.modelId, options?.totalRamBytes, appendProgress],
  );

  const pause = useCallback(() => {
    agentRef.current?.pause();
    setState("paused");
  }, []);

  const stop = useCallback(() => {
    agentRef.current?.cancel();
    abortRef.current?.abort();
    setState("stopped");
  }, []);

  const takeOver = useCallback(() => {
    setUserHasControl(true);
    agentRef.current?.pause();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    // Handing control back does NOT resume blindly. The user may have moved,
    // closed or retyped anything while they held it, so the next mission step
    // re-observes before it acts — which is the loop's own contract.
    setUserHasControl(false);
    setState(busy ? "executing" : "idle");
  }, [busy]);

  return { state, turns, ready, busy, userHasControl, send, pause, stop, takeOver, resume };
}
