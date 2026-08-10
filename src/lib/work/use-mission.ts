import { useCallback, useEffect, useRef, useState } from "react";
import { runAgentTask, Revision, type AgentMessage, type ToolCall } from "@/lib/agent/loop";
import { findTool, toolsFor, type ToolDefinition } from "@/lib/agent/tool-registry";
import type { Domain } from "@/lib/agent/domains";
import type { ToolOutcome } from "@/lib/agent/outcomes";
import {
  ACT_NOW_NUDGE,
  announcesAnotherStep,
  parseModelReply,
  toolInstructions,
} from "./tool-protocol";
import {
  runControlActionFn,
  startMissionFn,
  stopMissionFn,
  type MissionStart,
} from "@/lib/control-work.functions";
import type { BrainMessage } from "@/lib/brain/adapter";
import type { ControlState } from "./control-solar";

/**
 * A Control + Work mission, driven from the browser.
 *
 * WHY THE LOOP RUNS HERE AND NOT ON THE SERVER
 * ---------------------------------------------
 * Because permission has to happen BETWEEN two actions, and the person who
 * grants it is in this tab. A server-side loop can only ask before it starts or
 * report after it finishes; neither is "OCADE is about to open this file — is
 * that alright?". Running the loop next to the user is what makes that sentence
 * possible at all.
 *
 * The pieces stay exactly where they already were. `runAgentTask` is the same
 * loop the server used, unchanged. The tool registry is the same registry. The
 * adapters are the same adapters — reached one action at a time through
 * `runControlActionFn`, with the sidecars held open server-side for the life of
 * the mission so a browser session survives between clicks.
 *
 * THREE BANDS, AND THE MIDDLE ONE IS THE INTERESTING ONE
 * -------------------------------------------------------
 *   read   — runs. Asking permission to look is how people learn to click
 *            through prompts, and then they click through the one that mattered.
 *   low    — runs, and is reported. Scrolling a page, writing a note into
 *            OCADE's own temporary folder.
 *   medium — asks, once, concisely, and remembers the answer for that exact
 *            action within this task. Typing into a window. Opening an app.
 *   high   — always asks, always explicitly, and never remembers. Discarding a
 *            file. The server refuses these unconfirmed regardless of what this
 *            code does.
 *
 * PROTECTED CONTENT IS NOT A BAND. Passwords, one-time codes, CAPTCHAs,
 * biometrics and payment confirmations are refused by the sidecar and by the
 * browser host, before any of this is consulted. There is no prompt for them
 * because there is no answer that would make OCADE do it.
 */

export type MissionPhase = ControlState;

export interface TimelineEntry {
  id: string;
  kind: "said" | "acting" | "done" | "problem" | "refused" | "asked";
  label: string;
  detail: string;
  verified?: boolean;
}

export interface PendingApproval {
  call: ToolCall;
  tool: ToolDefinition;
  /** One sentence a person can answer without reading a schema. */
  question: string;
  risk: "medium" | "high";
  resolve: (allowed: boolean) => void;
}

export interface MissionTurn {
  id: string;
  role: "you" | "ocade";
  text: string;
  entries?: TimelineEntry[];
  verified?: boolean;
}

/** Streams one reply out of whatever engine the screen is using. */
export type MissionBrain = (
  messages: BrainMessage[],
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
) => Promise<{ ok: boolean; text: string; reason?: string }>;

const SPOKEN: Record<string, string> = {
  screen_observe: "Looking at the screen",
  window_list: "Reading the open windows",
  window_focus: "Bringing a window forward",
  window_arrange: "Moving a window",
  display_list: "Checking the screens",
  app_open: "Opening an application",
  app_focus: "Switching to an application",
  app_list_installed: "Checking what is installed",
  control_find: "Looking for a control",
  control_activate: "Pressing a control",
  control_set_text: "Filling in a field",
  type_text: "Typing",
  press_key: "Pressing a key",
  system_status: "Reading this computer's state",
  workspace_list: "Looking in OCADE's folder",
  workspace_read: "Reading a file",
  workspace_write: "Writing a file",
  workspace_open: "Opening a file",
  workspace_discard: "Discarding a file",
  // The approved-folder tools. Missing from this table until a test walked the
  // registry and found them rendering as the fallback "Working" — which tells
  // the user nothing at the exact moment OCADE is touching their own files.
  file_search: "Looking for files",
  file_read: "Reading a file",
  file_copy: "Copying a file",
  file_move: "Moving a file",
  file_trash: "Moving a file to the trash",
  file_restore: "Restoring a file",
  browser_open: "Opening a browser",
  browser_navigate: "Opening a page",
  browser_read: "Reading the page",
  browser_click: "Clicking on the page",
  browser_type: "Typing on the page",
  browser_scroll: "Scrolling the page",
  browser_key: "Pressing a key on the page",
  browser_media: "Controlling the media",
  browser_tabs: "Reading the open tabs",
  web_search: "Searching the web",
};

export function describeTool(name: string): string {
  return SPOKEN[name] ?? "Working";
}

/**
 * The approval question, in words about the thing rather than about the tool.
 *
 * "Allow control_set_text?" is a question nobody can answer. "Type into
 * Notepad?" is one everybody can. The arguments carry the specifics, so they
 * are what the sentence is built from.
 */
export function approvalQuestion(call: ToolCall, tool: ToolDefinition): string {
  const args = call.arguments ?? {};
  const named = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : "");
  switch (call.name) {
    case "app_open":
      return `Open ${named("name") || "an application"}?`;
    case "app_focus":
      return `Switch to ${named("name") || "another application"}?`;
    case "type_text": {
      const value = named("text");
      const preview = value.length > 60 ? `${value.slice(0, 60)}…` : value;
      return `Type “${preview}”?`;
    }
    case "press_key":
      return `Press ${[named("modifiers"), named("key")].filter(Boolean).join("+")}?`;
    case "control_activate":
      return `Press “${named("name")}”?`;
    case "control_set_text":
      return `Fill in “${named("name")}”?`;
    case "window_arrange":
      return `Move the window ${named("layout") ? `to ${named("layout")}` : ""}?`.trim();
    case "workspace_open":
      return `Open ${named("name")} in an editor?`;
    case "workspace_discard":
      return `Move ${named("name")} to the recycle bin?`;
    case "browser_navigate":
      return `Go to ${named("url")}?`;
    case "browser_click":
      return `Click “${named("text")}” on the page?`;
    case "browser_type":
      return `Type into “${named("selector")}” on the page?`;
    case "file_move":
      return `Move ${named("from")} to ${named("to")}?`;
    case "file_trash":
      return `Move ${named("path")} to the trash?`;
    default:
      return `${describeTool(call.name)}?`;
  }
}

/*
 * The system prompt lives in `agent/loop.ts` and is deliberately not duplicated
 * here. A second copy in the client would drift from the one the server-side
 * path uses, and then Chat and Control + Work would be following different
 * instructions while claiming to be the same OCADE.
 */

export function useMission(brain: MissionBrain) {
  const [start, setStart] = useState<MissionStart | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [phase, setPhase] = useState<MissionPhase>("idle");
  const [turns, setTurns] = useState<MissionTurn[]>([]);
  const [live, setLive] = useState<TimelineEntry[]>([]);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const revisionRef = useRef<Revision | null>(null);
  const pausedRef = useRef(false);
  // Approvals granted for one exact action within one task. Reset per task, so
  // consent never survives into the next instruction.
  const grantedRef = useRef<Set<string>>(new Set());
  // Sticky until the next instruction, so a Stop stays visible on the scene
  // through the reconnect that follows it.
  const stoppedRef = useRef(false);
  pausedRef.current = paused;

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    // A reconnect after a Stop must not repaint the scene as though nothing
    // happened — see the note on `stoppedRef`.
    if (!stoppedRef.current) setPhase("observing");
    try {
      const result = await startMissionFn();
      missionRef.current = result.missionId;
      setStart(result);
      if (!result.ok) setError(result.detail);
    } catch (cause) {
      setStart(null);
      setError(cause instanceof Error ? cause.message : "OCADE could not reach this computer.");
    } finally {
      setConnecting(false);
      setPhase(stoppedRef.current ? "stopped" : "idle");
    }
  }, []);

  /** End the mission on the server: release input, drop the sidecars. */
  const release = useCallback(async () => {
    const id = missionRef.current;
    missionRef.current = null;
    if (!id) return;
    try {
      await stopMissionFn({ data: { missionId: id } });
    } catch {
      /* the server sweeps idle missions anyway */
    }
  }, []);

  // A closed tab, a route change, or the demo clock running out are the same
  // event as far as the machine is concerned: nothing of OCADE's should still
  // be held.
  useEffect(() => () => void release(), [release]);

  /**
   * Stop, and stay visibly stopped.
   *
   * The reconnect that follows is necessary — releasing the machine disposes
   * the sidecars, so the next instruction needs a fresh mission — but it USED
   * TO REPAINT THE SCENE AS "READY" about two seconds after the user pressed
   * Stop. Pressing stop and watching the system carry on turning is the exact
   * moment the interface must not be ambiguous, so the stopped state is sticky
   * until the user actually asks for something else.
   */
  const stop = useCallback(() => {
    stoppedRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    approvalRefResolve.current?.(false);
    approvalRefResolve.current = null;
    setApproval(null);
    setPaused(false);
    setPhase("stopped");
    void release().then(() => void connect());
  }, [release, connect]);

  const approvalRefResolve = useRef<((allowed: boolean) => void) | null>(null);

  const answer = useCallback((allowed: boolean) => {
    approvalRefResolve.current?.(allowed);
    approvalRefResolve.current = null;
    setApproval(null);
  }, []);

  const revise = useCallback((instruction: string) => {
    revisionRef.current?.submit(instruction);
    setLive((current) => [
      ...current,
      {
        id: `r${Date.now()}`,
        kind: "said",
        label: "New instruction",
        detail: instruction,
      },
    ]);
  }, []);

  const send = useCallback(
    async (request: string) => {
      const missionId = missionRef.current;
      if (!missionId) {
        setError("OCADE is not connected to this computer.");
        return;
      }
      const id = `${Date.now()}`;
      setTurns((current) => [...current, { id, role: "you", text: request }]);
      setLive([]);
      setPaused(false);
      // Consent never carries from one instruction to the next, and neither
      // does a stop: asking for something new is what clears both.
      grantedRef.current = new Set();
      stoppedRef.current = false;
      setPhase("thinking");

      const controller = new AbortController();
      abortRef.current = controller;
      const revision = new Revision();
      revisionRef.current = revision;
      const entries: TimelineEntry[] = [];
      const push = (entry: TimelineEntry) => {
        entries.push(entry);
        setLive([...entries]);
      };

      /** Hold here while the user has pressed Pause. */
      const waitWhilePaused = async () => {
        while (pausedRef.current && !controller.signal.aborted) {
          setPhase("paused");
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      };

      try {
        const result = await runAgentTask(
          {
            complete: async (prompt, signal) => {
              const reply = await brain([{ role: "user", content: prompt }], () => {}, signal);
              return reply.ok ? reply.text : null;
            },
            turn: async (messages, tools, handlers) => {
              await waitWhilePaused();
              setPhase("thinking");
              const definitions = tools
                .map((tool) => findTool(tool.function.name))
                .filter((tool): tool is ToolDefinition => tool !== null);
              const local: BrainMessage[] = messages.map((message: AgentMessage) => ({
                role:
                  message.role === "tool"
                    ? "user"
                    : (message.role as "system" | "user" | "assistant"),
                content:
                  message.role === "tool"
                    ? `Result of ${message.toolName}:\n${message.content}`
                    : message.content,
              }));
              // The tool vocabulary is appended to the system turn rather than
              // sent as a schema: this engine has no function-calling channel.
              if (local[0]?.role === "system") {
                local[0] = {
                  ...local[0],
                  content: `${local[0].content}\n${toolInstructions(definitions)}`,
                };
              }
              const names = definitions.map((tool) => tool.name);
              const reply = await brain(local, handlers.onToken ?? (() => {}), handlers.signal);
              if (!reply.ok) throw new Error(reply.reason ?? "The engine did not answer.");
              const parsed = parseModelReply(reply.text, names);

              /*
               * ONE CORRECTION WHEN THE MODEL NARRATED INSTEAD OF ACTING.
               *
               * A small model will happily reply "I have opened Notepad. Now I
               * will type ..." with no JSON, and the loop reads no-tool-call as
               * finished — ending the task one step early while sounding like it
               * is about to continue. Asking once for the action alone repairs
               * the formatting without touching the decision.
               *
               * Bounded to a single retry, and only when there is an intention
               * to repair. A loop that keeps nudging is a loop that never ends,
               * and a model that has genuinely finished must be allowed to.
               */
              if (
                parsed.toolCalls.length === 0 &&
                names.length > 0 &&
                announcesAnotherStep(parsed.text) &&
                !controller.signal.aborted
              ) {
                const second = await brain(
                  [
                    ...local,
                    { role: "assistant", content: reply.text },
                    { role: "user", content: ACT_NOW_NUDGE },
                  ],
                  () => {},
                  handlers.signal,
                );
                if (second.ok) {
                  const retried = parseModelReply(second.text, names);
                  if (retried.toolCalls.length > 0) {
                    // The sentence the model already streamed is kept: the user
                    // saw it, and dropping it would make the transcript jump.
                    return { text: parsed.text, toolCalls: retried.toolCalls };
                  }
                }
              }

              return parsed;
            },
            permit: async (call, risk) => {
              await waitWhilePaused();
              if (controller.signal.aborted) return false;
              const tool = findTool(call.name);
              if (!tool) return false;
              if (risk === "low") return true;

              const signature = `${call.name}:${JSON.stringify(call.arguments ?? {})}`;
              // Medium risk is asked once per exact action per task. High risk
              // is asked every single time and never remembered.
              if (risk === "medium" && grantedRef.current.has(signature)) return true;

              const question = approvalQuestion(call, tool);
              /*
               * The question goes in the timeline only AFTER it is answered.
               * Pushing it when asked put the same sentence on screen twice —
               * once in the list and once in the card right below it — which
               * reads as a glitch at the exact moment the user is being asked
               * to decide something. The permanent record is worth keeping; the
               * duplicate is not.
               */
              setPhase("paused");
              const allowed = await new Promise<boolean>((resolve) => {
                approvalRefResolve.current = resolve;
                setApproval({
                  call,
                  tool,
                  question,
                  risk: risk === "high" ? "high" : "medium",
                  resolve,
                });
              });
              approvalRefResolve.current = null;
              setApproval(null);
              push({
                id: `a${Date.now()}${entries.length}`,
                kind: allowed ? "asked" : "refused",
                label: question,
                detail: allowed ? "You allowed it." : "You said no.",
              });
              if (allowed && risk === "medium") grantedRef.current.add(signature);
              return allowed;
            },
            execute: async (call, signal): Promise<ToolOutcome> => {
              await waitWhilePaused();
              if (signal?.aborted || controller.signal.aborted) {
                return { kind: "cancelled", detail: "The task was stopped." };
              }
              const tool = findTool(call.name);
              setPhase(tool?.mutating ? "controlling" : "observing");
              try {
                const outcome = await runControlActionFn({
                  data: {
                    missionId,
                    tool: call.name,
                    args: (call.arguments ?? {}) as Record<string, unknown>,
                    // A `high` action only reaches here after `permit` returned
                    // true, and the server checks that claim against the tool's
                    // own band rather than trusting this flag on its own.
                    confirmed: tool?.risk === "high",
                  },
                });
                return {
                  kind: outcome.kind as ToolOutcome["kind"],
                  detail: outcome.detail,
                  verified: outcome.verified,
                  observation: outcome.observation,
                  elapsedMs: outcome.elapsedMs,
                };
              } catch (cause) {
                return {
                  kind: "retryable_failure",
                  detail:
                    cause instanceof Error
                      ? cause.message
                      : "That action could not be carried out.",
                };
              }
            },
            onEvent: (event) => {
              if (event.kind === "tool_start") {
                push({
                  id: `s${Date.now()}${entries.length}`,
                  kind: "acting",
                  label: describeTool(event.call.name),
                  detail: "",
                });
              } else if (event.kind === "tool_end") {
                push({
                  id: `e${Date.now()}${entries.length}`,
                  kind: event.outcome.kind === "success" ? "done" : "problem",
                  label: describeTool(event.call.name),
                  detail: event.outcome.detail,
                  verified: event.outcome.verified,
                });
              } else if (event.kind === "refused") {
                push({
                  id: `x${Date.now()}${entries.length}`,
                  kind: "refused",
                  label: describeTool(event.call.name),
                  detail: event.reason,
                });
              }
            },
          },
          { request, signal: controller.signal, revision },
        );

        /*
         * THE ENDING IS NAMED, NOT SUMMARISED.
         *
         * A cancelled task used to close with "OCADE finished without anything
         * to report", which is both untrue and the wrong shape: the user
         * pressed Stop and the transcript told them the work had concluded. The
         * stop reason is known here, so it is said.
         */
        const ending =
          result.text ||
          (result.reason === "cancelled"
            ? "You stopped this. OCADE let go of the keyboard and mouse and left everything as it was."
            : result.reason === "blocked"
              ? "OCADE stopped because it was not allowed to take the next step."
              : "OCADE finished without anything to report.");

        setTurns((current) => [
          ...current,
          {
            id: `${id}-r`,
            role: "ocade",
            text: ending,
            entries: [...entries],
            verified: result.allVerified,
          },
        ]);
        if (result.reason === "repeating" || result.reason === "step_limit") {
          setPhase("error");
        }
      } catch (cause) {
        setTurns((current) => [
          ...current,
          {
            id: `${id}-e`,
            role: "ocade",
            text:
              cause instanceof Error
                ? cause.message
                : "OCADE could not complete that on this computer.",
            entries: [...entries],
          },
        ]);
        setPhase("error");
      } finally {
        abortRef.current = null;
        revisionRef.current = null;
        setLive([]);
        // A held state — stopped, or a failure the user has not seen yet —
        // survives the cleanup. Only a normal finish returns to idle.
        setPhase((current) => (current === "stopped" || current === "error" ? current : "idle"));
      }
    },
    [brain],
  );

  const busy = phase === "thinking" || phase === "observing" || phase === "controlling";

  return {
    /** What the machine said when the mission opened. */
    start,
    connecting,
    connect,
    /** Ends the mission and lets go of the computer. */
    release,
    phase,
    busy,
    paused,
    setPaused,
    turns,
    live,
    approval,
    answer,
    revise,
    send,
    stop,
    error,
    /** Which tools this device actually offers, for the capability line. */
    toolCount: toolsFor(["os_app", "files", "web"] as Domain[]).length,
  };
}
