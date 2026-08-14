import { useCallback, useEffect, useRef, useState } from "react";
import {
  runAgentTask,
  Revision,
  type AgentDeps,
  type AgentMessage,
  type ToolCall,
} from "@/lib/agent/loop";
import { looksMultiStep, runPlannedTask } from "@/lib/agent/planner";
import { findTool, schemasFor, toolsFor, type ToolDefinition } from "@/lib/agent/tool-registry";
import type { Domain } from "@/lib/agent/domains";
import type { ToolOutcome } from "@/lib/agent/outcomes";
import {
  ACT_NOW_NUDGE,
  announcesAnotherStep,
  parseModelReply,
  stripControlTokens,
  toolInstructions,
} from "./tool-protocol";
import {
  missionAudioInputsFn,
  missionMicFn,
  missionSpeakFn,
  refreshMemoryFn,
  runControlActionFn,
  startMissionFn,
  stopMissionFn,
  type MissionStart,
} from "@/lib/control-work.functions";
import type { BrainMessage } from "@/lib/brain/adapter";
import type { ControlState } from "./control-solar";
import { routeDirect } from "./fast-router";
import {
  checkContent,
  contentOf,
  correctionPrompt,
  parseConstraints,
  type ConstraintCheck,
} from "./content-constraints";
import { TaskLedger, checkCall } from "./tool-contract";

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
  /**
   * True when the question was also read aloud, so the card can say "or just
   * say yes" rather than implying the mouse is the only way to answer.
   */
  spoken?: boolean;
}

/**
 * How the user is driving this session.
 *
 * `prompt` — typing, watching the screen. `voice` — hands-free, possibly across
 * the room. The difference changes only which approvals are asked for; it never
 * changes what the tools are allowed to do.
 */
export type MissionMode = "prompt" | "voice";

/**
 * Whether an action of this risk needs a person, in this mode.
 *
 * A PURE RULE, EXPORTED, BECAUSE IT IS THE SAFETY BOUNDARY. Left inline in the
 * permission closure it could only be tested by driving a whole mission, which
 * in practice means it would not be tested at all — and this is the one
 * decision in Control + Work where being wrong means something irreversible
 * happens without anybody agreeing to it.
 *
 *   low     — never asked, in either mode. Focusing a window is not a decision.
 *   medium  — asked when the user is at the keyboard; announced aloud when they
 *             are not, because a card nobody can reach is a deadlock and
 *             training somebody to say "yes" to everything is worse than not
 *             asking at all.
 *   high    — ALWAYS asked. Deleting files, sending a message and changing the
 *             system are what "high" means, and being across the room is a
 *             reason to be more careful, not less. Voice mode speaks the
 *             question; it does not skip it.
 */
/**
 * AUTONOMOUS BY DEFAULT. The approval card was the last thing standing between
 * "in wordpad type about cars" and it actually happening: the text was written,
 * the window was found, and the run stopped on a Yes/No nobody wanted.
 *
 * Everything OCADE does on this machine is now done without asking, because
 * every one of those actions is one the user just requested in words and can
 * see happen: opening an application, typing into a window, writing a file.
 * Asking permission to do the thing you were told to do is friction, not
 * safety — and a prompt shown on every action is a prompt people learn to
 * dismiss without reading.
 *
 * WHAT IS STILL ASKED, AND WHY IT IS EXACTLY ONE THING.
 * `message_send` puts words in front of ANOTHER PERSON under the user's name,
 * and it cannot be undone. Every other action here affects only this computer
 * and can be looked at, corrected or reversed. That asymmetry is the whole
 * reason the exception exists; it is not a general timidity about automation.
 * Set OCADE_AUTONOMY_SENDS_MESSAGES to true to remove it as well.
 */
const ALWAYS_ASK = new Set<string>(["message_send"]);

export const OCADE_AUTONOMY_SENDS_MESSAGES = false;

export function approvalPolicy(
  risk: ToolDefinition["risk"],
  mode: MissionMode,
  toolName?: string,
): "auto" | "announce" | "ask" {
  if (toolName && ALWAYS_ASK.has(toolName) && !OCADE_AUTONOMY_SENDS_MESSAGES) return "ask";
  void risk;
  void mode;
  return "auto";
}

export interface AudioInput {
  id: number;
  name: string;
  isDefault: boolean;
  isSelected: boolean;
}

export interface MicStatus {
  enabled: boolean;
  deviceId: number | null;
  /** True while the barge-in listener holds the audio stream. */
  listening: boolean;
  devices: AudioInput[];
  detail: string;
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
  /**
   * The actions the model may call, in the runtime's own schema.
   *
   * When the engine underneath carries a function-call channel, the reply
   * comes back as a structured call and `calls` is populated. When it does
   * not, `calls` is empty and the caller falls back to reading JSON out of
   * the prose — which is what Control + Work did for everything until a 3B
   * model wrote `{"tool": "system_status", "arguments": {"}}` and the run
   * ended on unparseable output.
   */
  tools?: readonly unknown[],
) => Promise<{
  ok: boolean;
  text: string;
  reason?: string;
  calls?: { name: string; arguments: Record<string, unknown> }[];
}>;

const SPOKEN: Record<string, string> = {
  screen_observe: "Looking at the screen",
  window_list: "Reading the open windows",
  window_focus: "Bringing a window forward",
  window_arrange: "Moving a window",
  display_list: "Checking the screens",
  app_open: "Opening an application",
  app_focus: "Switching to an application",
  youtube_play: "Playing it on YouTube",
  folder_open: "Opening a folder",
  folder_item_open: "Opening a folder inside it",
  app_list_installed: "Checking what is installed",
  control_find: "Looking for a control",
  control_activate: "Pressing a control",
  control_set_text: "Filling in a field",
  speak: "Speaking",
  listen: "Listening",
  office_read: "Reading a spreadsheet or document",
  office_write: "Saving a spreadsheet or document",
  message_draft: "Writing a message for you to check",
  message_send: "Sending a message",
  whatsapp_open: "Opening WhatsApp",
  whatsapp_find_contact: "Finding the chat",
  whatsapp_type: "Writing the message",
  whatsapp_send: "Sending the message",
  message_find_contact: "Opening a conversation",
  message_to: "Finding who you meant, then writing",
  file_list: "Looking through the folder",
  screen_map: "Numbering what is on screen",
  screen_do: "Acting on the screen",
  document_read: "Reading the document",
  setup_status: "Checking setup",
  clipboard_watch: "Checking what you copied",
  screen_watch: "Watching the screen",
  message_pending: "Listing drafts",
  message_discard: "Discarding the draft",
  screen_find: "Looking for something on screen",
  // Named for what the user will SEE happen — their pointer moving — rather
  // than for the mechanism. This is the one action that does that.
  screen_click: "Clicking with the mouse",
  parallel_search: "Asking every search engine at once",
  screen_type: "Typing, then checking the screen",
  screen_act: "Operating something on screen",
  screen_read: "Reading the screen",
  app_discover: "Checking what is installed",
  ui_tree: "Reading what is on screen",
  ui_act: "Operating a control",
  system_volume: "Changing the volume",
  system_brightness: "Changing the screen brightness",
  media_control: "Controlling playback",
  bluetooth_status: "Checking Bluetooth",
  audio_devices: "Checking the audio devices",
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
  youtube_search: "Searching YouTube",
  /*
   * The continuity layer and the rest of the machine. Missing from this table,
   * every one of them rendered as the fallback "Working" — which tells the user
   * nothing at the exact moment OCADE is writing something down about them, or
   * opening a port on their network. A test below walks the whole registry and
   * fails when a tool has no line here, so this cannot fall behind again.
   */
  memory_remember: "Remembering that",
  memory_recall: "Checking what I remember",
  memory_forget: "Forgetting that",
  memory_project: "Noting the project",
  memory_identity: "Updating who we are",
  memory_snapshot: "Reading my memory",
  session_summarise: "Writing down what we did",
  morning_briefing: "Putting your briefing together",
  proactive_check: "Seeing if anything is worth mentioning",
  topic_watch: "Following that topic",
  topic_check: "Checking your topics",
  language_note: "Noting the language",
  search_mode: "Searching the web",
  flight_search: "Looking up flights",
  weather: "Checking the weather",
  system_wifi: "Checking the network",
  system_power: "Changing the computer's power state",
  autostart: "Changing what starts at login",
  clipboard_read: "Reading the clipboard",
  clipboard_write: "Copying that",
  see: "Looking",
  camera_list: "Checking the cameras",
  reminder_set: "Setting a reminder",
  reminder_list: "Reading your reminders",
  reminder_cancel: "Cancelling a reminder",
  game_list: "Checking your games",
  game_update: "Asking the launcher to update",
  phone_dashboard: "Setting up your phone",
  code_review: "Reading the code",
  memory_preference: "Noting how you like things",
  clipboard_act: "Working on what you copied",
  engine_status: "Checking the engine",
  folder_create: "Making a folder",
  file_info: "Reading a file's details",
  disk_usage: "Checking your disk space",
  largest_files: "Finding your biggest files",
  desktop_organise: "Tidying your desktop",
};

export function describeTool(name: string): string {
  return SPOKEN[name] ?? "Working";
}

/**
 * The tools that change what OCADE knows, and therefore invalidate the prompt.
 *
 * Only the WRITES. `memory_recall` and `memory_snapshot` read the same store
 * and cannot change it, and refreshing after them would add a server round trip
 * to the two tools whose whole value is being cheap.
 *
 * `session_summarise` is here because a summary is consumed by the next
 * briefing, and `language_note` because the language changes how OCADE speaks
 * from the following sentence onwards.
 */
export const MEMORY_WRITES = new Set<string>([
  "memory_remember",
  "memory_forget",
  "memory_project",
  "memory_identity",
  "session_summarise",
  "language_note",
]);

/**
 * The brief handed to the model when a deterministic step did not work.
 *
 * WHY A FAILED FAST PATH MUST NOT BE THE END OF THE RUN.
 * ------------------------------------------------------
 * The router is a set of rules about words. It is right almost always and
 * wrong in exactly one way: it cannot see. Asked to open the chat called
 * "Meta ai", it typed the name in the search box, WhatsApp answered "No chats,
 * contacts or messages found", and OCADE reported that sentence back and
 * stopped -- with the answer visible on screen the whole time, and a vision
 * model, an accessibility tree, and an OCR search sitting unused in the
 * toolbox.
 *
 * A person who typed a name and saw no results would LOOK at the screen. That
 * is the entire content of this escalation: the rules did their turn and came
 * up short, so the model takes over with the tools that observe. It is told
 * what was attempted and what came back, because "it failed" is not something
 * you can act on and "the search box says no results" is.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * No instruction to retry the same call, and no suggestion of what the real
 * answer might be. Both are guesses this function is in no position to make --
 * the name may be misspelled, the chat may not exist, the window may not have
 * come to the front. Looking first is the only step that is right in all three
 * cases.
 */
export function recoveryBrief(request: string, attempted: string, failure: string): string {
  return (
    `The user asked: ${request}\n\n` +
    `A direct attempt at "${attempted}" did not work. What came back was: ${failure}\n\n` +
    "Do not repeat that attempt unchanged and do not ask the user what to do. " +
    "Look at the screen first -- screen_observe reads the controls and is fast, " +
    "screen_find locates text by OCR, and see describes a window that draws its " +
    "own graphics -- then decide from what is actually there and carry on with " +
    "the request. If the screen shows the step genuinely cannot be completed, " +
    "say what you saw and why, in one or two sentences."
  );
}

/**
 * Does composed text belong in a chat conversation rather than a document?
 *
 * ONE FLAG, TWO DECISIONS, AND THAT IS DELIBERATE.
 * ------------------------------------------------
 * The destination changes both halves of the compose path: how the words are
 * WRITTEN (a message, not an essay) and how they are DELIVERED (the app's own
 * composer, not a generic value-pattern write). Both follow from the same fact,
 * so they read it from the same place -- keeping them separate is how you get a
 * four-paragraph essay typed correctly into a chat box.
 *
 * Only WhatsApp is here because WhatsApp is the only chat app with a measured
 * skill behind it. The rest fall through to the document path, which is the
 * honest answer for an app whose composer has never been driven.
 */
export function isChatApp(app: string | undefined | null): boolean {
  return typeof app === "string" && /^whats\s?app$/i.test(app.trim());
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
    case "message_send": {
      /*
       * THE ONE APPROVAL THAT MUST SHOW ITS CONTENT.
       *
       * "Send the message?" is unanswerable — the user cannot check what they
       * are agreeing to, and a message cannot be unsent. The draft carries the
       * recipient and the exact wording precisely so this question can name
       * both, so the thing shown and the thing sent are the same thing.
       */
      const to = named("recipient");
      const body = named("message");
      if (to && body) {
        const preview = body.length > 200 ? `${body.slice(0, 200)}…` : body;
        return `Send this to ${to}?\n\n${preview}`;
      }
      return to ? `Send the drafted message to ${to}?` : "Send the drafted message?";
    }
    case "office_write": {
      const file = named("path");
      return file ? `Save ${file}?` : "Save that file?";
    }
    case "ui_act": {
      // The ref ("e12") means nothing to a person, so the question is built
      // from the action and, when there is one, the text being written.
      const action = named("action").toLowerCase();
      if (action === "set_text") {
        const value = named("text");
        return `Type “${value.length > 60 ? `${value.slice(0, 60)}…` : value}” into that field?`;
      }
      if (action === "focus") return "Put the cursor in that field?";
      return `${action === "toggle" ? "Toggle" : action === "select" ? "Select" : "Press"} that control?`;
    }
    case "system_volume": {
      const action = named("action").toLowerCase();
      if (action === "mute") return "Mute the sound?";
      if (action === "unmute") return "Unmute the sound?";
      const level = args.level;
      return typeof level === "number" ? `Set the volume to ${level}%?` : "Change the volume?";
    }
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
    case "browser_open": {
      /*
       * THE QUESTION HAS TO NAME THE CAPABILITY, NOT THE ACTION.
       *
       * "Open Chrome?" is a question about a window, and everybody says yes to
       * it. What is actually being granted is every session inside that
       * profile. The user cannot weigh that against a question that does not
       * mention it, so this one does.
       */
      const which = named("browser") === "edge" ? "Edge" : "Chrome";
      return `Use your own ${which}, signed in? OCADE will be able to reach the accounts you are logged into.`;
    }
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

/**
 * Is the second attempt closer to what was asked for than the first?
 *
 * Total absolute distance across every constraint. A rewrite that fixes the
 * word count by blowing the line count is not an improvement, and a model
 * asked to add twenty-five words will sometimes add ninety.
 */
function betterOf(before: ConstraintCheck, after: ConstraintCheck): boolean {
  const distance = (check: ConstraintCheck) =>
    check.results.reduce(
      (total, result) => total + Math.abs(result.actual - result.constraint.count),
      0,
    );
  return distance(after) < distance(before);
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

  /*
   * THE TWO MODES, AND THE ONE THING THEY DO NOT DIFFER ON.
   *
   * Prompt mode is read-and-decide: the user is looking at the screen, so a
   * medium-risk action is worth a card they can weigh up before it runs.
   *
   * Voice mode is hands-free. The same card is now a dead end — the user is
   * across the room, cannot click, and a stream of "may I?" turns a
   * conversation into a form. So medium-risk auto-approves.
   *
   * HIGH RISK ASKS IN BOTH MODES, ALWAYS. Deleting files, sending a message and
   * changing the system are the actions a person cannot take back, and "I was
   * not at the keyboard" is not a reason to do them unasked — it is a reason to
   * be more careful, not less. In voice mode the question is spoken, so it is
   * still answerable hands-free; it is the asking that never goes away.
   */
  /*
   * WHAT OCADE REMEMBERS, HELD FOR THE WHOLE MISSION AND REFRESHED WHEN IT
   * CHANGES.
   *
   * A ref rather than state, deliberately: it is read inside the agent loop's
   * closure, and putting it in state would either give the loop a stale copy
   * (captured at the start of the run) or force the whole panel to re-render
   * every time the user tells OCADE to remember something.
   *
   * Refreshed after any tool that writes to memory — see `refreshMemory` — so
   * "my name is Haans" reaches the very next turn's prompt rather than only the
   * next mission.
   */
  const memoryRef = useRef<string | null>(null);

  /**
   * Re-read the memory context after something wrote to it.
   *
   * ITS OWN SERVER FUNCTION RATHER THAN A TOOL CALL, and the first attempt got
   * this wrong: it went through `runControlActionFn` with the name
   * `memory_context_refresh`, which is not in the registry — and the server
   * refuses any tool it cannot look up, correctly. Registering one to get
   * around that would have advertised it to the model, which must never call
   * it: this is the mission preparing its own prompt, not an action the model
   * chooses.
   *
   * So it is a separate, minimal function that re-uses the same mission and the
   * same authorisation, and reaches nothing except the memory file.
   */
  const refreshMemory = useCallback(async (missionId: string) => {
    try {
      const result = await refreshMemoryFn({ data: { missionId } });
      if (result.ok && typeof result.context === "string") memoryRef.current = result.context;
    } catch {
      // Stale context is strictly better than none, so a failed refresh is
      // silently ignored and the previous value stands.
    }
  }, []);

  const [mode, setMode] = useState<MissionMode>("prompt");
  const modeRef = useRef<MissionMode>("prompt");
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const [mic, setMic] = useState<MicStatus>({
    enabled: false,
    deviceId: null,
    listening: false,
    devices: [],
    detail: "The microphone is off.",
  });

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
  // What this task has already done, so an exact repeat can be refused.
  const ledgerRef = useRef(new TaskLedger());
  // Where the time went on the last step, so 'is the router actually faster?'
  // is a measurement rather than a belief.
  const latencyRef = useRef<{ routerMs: number; modelMs: number; toolMs: number; rule?: string }>({
    routerMs: 0,
    modelMs: 0,
    toolMs: 0,
  });
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
      memoryRef.current = result.memory?.context ?? null;
      setStart(result);
      if (!result.ok) setError(result.detail);
    } catch (cause) {
      setStart(null);
      memoryRef.current = null;
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

  /**
   * Say something, without waiting for it to finish.
   *
   * FIRE-AND-FORGET IS THE POINT. The engine's `Speak` is asynchronous, so the
   * sentence plays on the audio thread while the mouse and keyboard carry on —
   * which is what makes hands-free mode feel like one continuous action rather
   * than a narrator taking turns with a robot. Awaiting it here would serialise
   * speech and execution and add the length of every sentence to the task.
   *
   * Failures are swallowed deliberately: a machine with no speech is a machine
   * that should still do the work.
   */
  const speak = useCallback((text: string) => {
    const missionId = missionRef.current;
    if (!missionId || !text.trim()) return;
    void missionSpeakFn({ data: { missionId, text: text.slice(0, 1_200) } }).catch(() => {});
  }, []);

  /** Read the microphone list and current state from the engine. */
  const refreshAudio = useCallback(async () => {
    const missionId = missionRef.current;
    if (!missionId) return;
    try {
      const result = await missionAudioInputsFn({ data: { missionId } });
      if (!result.ok) return;
      setMic((current) => ({
        ...current,
        devices: result.devices,
        deviceId: result.selected,
        enabled: result.micEnabled,
      }));
    } catch {
      /* an engine that cannot list microphones simply offers none */
    }
  }, []);

  /**
   * Turn the microphone on or off, or switch device.
   *
   * The state is set from what the ENGINE reports back, never from what was
   * asked for. A toggle that flips to "off" while the audio stream is still
   * open is the exact failure this control exists to prevent, so the UI is not
   * allowed to assume it succeeded.
   */
  const setMicEnabled = useCallback(async (enabled: boolean) => {
    const missionId = missionRef.current;
    if (!missionId) return;
    const result = await missionMicFn({ data: { missionId, enabled } });
    setMic((current) => ({
      ...current,
      enabled: result.micEnabled,
      listening: result.listening,
      detail: result.detail,
    }));
    if (!result.ok) setError(result.detail);
  }, []);

  const selectMicDevice = useCallback(async (deviceId: number | null) => {
    const missionId = missionRef.current;
    if (!missionId) return;
    const result = await missionMicFn({ data: { missionId, deviceId } });
    setMic((current) => ({
      ...current,
      deviceId: result.deviceId,
      enabled: result.micEnabled,
      listening: result.listening,
      detail: result.detail,
      devices: current.devices.map((d) => ({ ...d, isSelected: d.id === result.deviceId })),
    }));
  }, []);

  /*
   * Leaving voice mode turns the microphone off.
   *
   * Not a convenience: a microphone that stays open after the user switches
   * back to typing is one nobody is thinking about any more, and the whole
   * reason "off" releases the stream is so that state cannot exist unnoticed.
   */
  useEffect(() => {
    if (mode === "prompt" && mic.enabled) void setMicEnabled(false);
  }, [mode, mic.enabled, setMicEnabled]);

  /**
   * Run one already-decided tool call, with permission and verification.
   *
   * Shared by the fast path and the model path so BOTH go through the same
   * contract check, the same approval bands and the same server. The fast
   * router decides what to do; it does not get a private route to the machine.
   */
  const runOneCall = useCallback(
    async (
      call: ToolCall,
      missionId: string,
      askPermission: (call: ToolCall, risk: string) => Promise<boolean>,
    ): Promise<{ ok: boolean; detail: string; verified?: boolean }> => {
      const checked = checkCall(call, ledgerRef.current);
      if (!checked.ok) return { ok: false, detail: checked.reason };

      const tool = findTool(checked.call.name);
      if (tool?.mutating) {
        const allowed = await askPermission(checked.call, tool.risk);
        if (!allowed) return { ok: false, detail: "You did not approve that, so it was not done." };
      }
      ledgerRef.current.note(checked.call);
      setPhase(tool?.mutating ? "controlling" : "observing");
      const outcome = await runControlActionFn({
        data: {
          missionId,
          tool: checked.call.name,
          args: (checked.call.arguments ?? {}) as Record<string, unknown>,
          confirmed: tool?.risk === "high",
        },
      });
      return { ok: outcome.kind === "success", detail: outcome.detail, verified: outcome.verified };
    },
    [],
  );

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
      // The previous failure is history the moment a new instruction arrives.
      // Without this the red banner from one dead engine call would sit above
      // every later run, including the ones that work.
      setError(null);
      // Consent never carries from one instruction to the next, and neither
      // does a stop: asking for something new is what clears both.
      grantedRef.current = new Set();
      stoppedRef.current = false;
      ledgerRef.current.reset();
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

      const askPermission = async (call: ToolCall, risk: string): Promise<boolean> => {
        await waitWhilePaused();
        if (controller.signal.aborted) return false;
        const tool = findTool(call.name);
        if (!tool) return false;
        if (risk === "low") return true;

        const signatureKey = `${call.name}:${JSON.stringify(call.arguments ?? {})}`;
        if (risk === "medium" && grantedRef.current.has(signatureKey)) return true;

        const question = approvalQuestion(call, tool);

        /*
         * VOICE MODE: medium risk proceeds, high risk still stops.
         *
         * The user is hands-free. A card with two buttons is unanswerable from
         * across the room, so asking for every medium action would either
         * deadlock the task or train them to say yes to everything — and the
         * second is worse than not asking.
         *
         * What happened is still SAID and still written to the timeline, so the
         * action is visible and interruptible ("stop" cuts it mid-flight). That
         * is the trade: medium-risk work is announced rather than gated.
         */
        const policy = approvalPolicy(tool.risk, modeRef.current, call.name);
        if (policy === "auto") {
          // Announced in the timeline so it is visible, never blocking.
          grantedRef.current.add(signatureKey);
          return true;
        }
        if (policy === "announce") {
          push({
            id: `v${Date.now()}${entries.length}`,
            kind: "acting",
            label: question.replace(/\?$/, ""),
            detail: "Hands-free — say “stop” to interrupt.",
          });
          void speak(question.replace(/\?$/, "."));
          grantedRef.current.add(signatureKey);
          return true;
        }

        setPhase("paused");
        /*
         * A HIGH-RISK QUESTION IN VOICE MODE IS SPOKEN AS WELL AS SHOWN.
         *
         * The card still appears and still blocks — this is the one thing voice
         * mode does not skip — but a user who cannot see the screen has to be
         * able to hear what they are being asked before they answer it.
         */
        const spoken = modeRef.current === "voice";
        if (spoken) void speak(question);

        const allowed = await new Promise<boolean>((resolve) => {
          approvalRefResolve.current = resolve;
          setApproval({
            call,
            tool,
            question,
            risk: risk === "high" ? "high" : "medium",
            resolve,
            spoken,
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
        if (allowed && risk === "medium") grantedRef.current.add(signatureKey);
        return allowed;
      };

      /* ------------------------------------------------------- fast path --
       * A request the router understands completely never reaches the model.
       *
       * "Stop", "open Notepad", "what's on my screen" are not questions that
       * need a 7B model's opinion — they are one regular expression and one
       * tool call. Sending them to the engine cost eight to twenty seconds each
       * and occasionally produced a different answer than the last time.
       *
       * Everything below the router is IDENTICAL to the model path: the same
       * contract check, the same approval bands, the same server, the same
       * verification. Only the decision is cheaper.
       */
      const routerStarted = performance.now();
      const direct = routeDirect(request);
      const routerMs = Math.round(performance.now() - routerStarted);

      /*
       * Countable properties the user stated about the OUTPUT — "a 200-word
       * essay", "no more than five bullets". Read once from the original
       * request rather than per call, because the request is what stated them
       * and the remainder handed to the model may not repeat the number.
       */
      const constraints = parseConstraints(request);

      /*
       * The half of the instruction the router could not serve.
       *
       * "Open Notepad and write an essay" is one fast action plus real work.
       * The router now returns the leftover instead of swallowing it, and the
       * model picks it up below rather than the run ending after the open.
       */
      let remainingWork: string | null = direct?.remainder ?? null;

      /*
       * True when `remainingWork` is a recovery this code wrote rather than
       * words the user typed. It decides one thing further down: whether the
       * model path is allowed to classify the request or is handed its domains
       * outright.
       */
      let recovering = false;

      /*
       * A writing brief the router could not serve alone. Held here so the
       * fast path does not tidy up and return before the words are written.
       */
      const pendingCompose = direct?.compose ?? null;

      if (direct && direct.calls.length > 0) {
        push({ id: `d${Date.now()}`, kind: "acting", label: direct.say, detail: "" });
        const lines: string[] = [];
        let allOk = true;
        let failed: { call: string; detail: string } | null = null;
        try {
          for (const call of direct.calls) {
            if (controller.signal.aborted) break;
            await waitWhilePaused();
            const started = performance.now();
            const outcome = await runOneCall(call, missionId, askPermission);
            const elapsed = Math.round(performance.now() - started);
            push({
              id: `dr${Date.now()}${lines.length}`,
              kind: outcome.ok ? "done" : "problem",
              label: describeTool(call.name),
              detail: outcome.detail,
              verified: outcome.verified,
            });
            lines.push(outcome.detail);
            if (!outcome.ok) {
              allOk = false;
              // The FIRST failure is the one worth explaining. Later calls in
              // the same batch usually fail because this one did.
              if (!failed) failed = { call: describeTool(call.name), detail: outcome.detail };
            }
            latencyRef.current = { routerMs, modelMs: 0, toolMs: elapsed, rule: direct.rule };
          }
          /*
           * A DEAD END BECOMES A HANDOVER.
           *
           * Only when nothing else was already queued: a run that has a
           * remainder or a writing brief has somewhere to go, and replacing
           * that with a recovery would drop the work the user actually asked
           * for.
           */
          const escalating = Boolean(failed) && !remainingWork && !pendingCompose;
          recovering = escalating;
          if (escalating && failed) {
            remainingWork = recoveryBrief(request, failed.call, failed.detail);
            push({
              id: `esc${Date.now()}`,
              kind: "acting",
              label: "Looking at the screen",
              detail: failed.detail,
            });
          }
          setTurns((current) => [
            ...current,
            {
              id: `${id}-r`,
              role: "ocade",
              text: escalating
                ? `${lines.join(" ")} Taking a look at the screen.`
                : lines.join(" ") || direct.say,
              entries: [...entries],
              verified: allOk,
            },
          ]);
        } finally {
          if (!remainingWork && !pendingCompose) {
            abortRef.current = null;
            revisionRef.current = null;
            setLive([]);
            setPhase((current) => (current === "stopped" ? "stopped" : "idle"));
          }
        }
        // Fall through when work remains; the open or focus already ran.
        if ((!remainingWork && !pendingCompose) || controller.signal.aborted) return;
      }

      /* --------------------------------------------------- compose-and-type --
       *
       * WRITE THE WORDS, THEN PUT THEM IN THE WINDOW. TWO STEPS, NO TOOL CALL.
       *
       * "in wordpad type about cars in 100 words" hung twice, and the reason
       * was never the typing — it was asking a 3B model to express "write this
       * and then type it there" as a function call. It answered the way the
       * sentence reads, with an essay in the chat, and WordPad stayed empty.
       *
       * The same model writes that essay perfectly in OCADE Chat. So this asks
       * it for exactly that — a plain completion, no tools, the thing it is
       * reliably good at — and then does the mechanical half here, where it is
       * deterministic: focus the window, write through the value pattern, read
       * it back. Nothing depends on the model choosing a tool.
       */
      if (pendingCompose) {
        try {
          push({
            id: `w${Date.now()}`,
            kind: "acting",
            label: "Writing the text",
            detail: pendingCompose.brief,
          });
          /*
           * A CHAT MESSAGE IS NOT AN ESSAY, AND THE PROMPT HAS TO SAY SO.
           *
           * The same brief -- "ask a question about anything computer related"
           * -- produces four paragraphs when the instruction is only "write
           * this". That is correct for WordPad and wrong for a chat box, where
           * it arrives as a wall of text nobody reads. Where the words are
           * going is known right here, so it becomes part of the instruction.
           */
          const chatBox = isChatApp(pendingCompose.app);
          const written = await brain(
            [
              {
                role: "user",
                content: chatBox
                  ? "You are writing a chat message that will be sent as-is.\n\n" +
                    `The message should: ${pendingCompose.brief}.\n\n` +
                    "Write it the way a person types in a chat: one or two short " +
                    "sentences, plain words, no greeting block, no signature. " +
                    "Output ONLY the message itself - no preamble, no quotation " +
                    "marks around it, no markdown."
                  : `Write ${pendingCompose.brief}.\n\n` +
                    "Output ONLY the finished text. No preamble, no explanation, no " +
                    "quotation marks around it, no markdown.",
              },
            ],
            () => {},
            controller.signal,
          );
          if (!written.ok || !written.text.trim()) {
            throw new Error(written.reason ?? "The engine did not return any text to type.");
          }

          // The same length check the model path uses, so "100 words" means
          // 100 words here too rather than only when a tool call produced it.
          let body = stripControlTokens(written.text).trim();
          const wanted = parseConstraints(`${request} ${pendingCompose.brief}`);
          if (wanted.length > 0) {
            const check = checkContent(body, wanted);
            if (!check.ok) {
              const fixed = await brain(
                [{ role: "user", content: correctionPrompt(request, body, check) }],
                () => {},
                controller.signal,
              );
              if (fixed.ok && fixed.text.trim()) {
                const retry = checkContent(fixed.text, wanted);
                if (retry.ok || betterOf(check, retry)) body = fixed.text.trim();
              }
            }
          }

          /*
           * NAME THE WINDOW. DO NOT TRUST THE FOREGROUND.
           *
           * This sent `{text}` alone at first, which targets whatever the
           * engine considers the active window. Measured immediately: the
           * focus call ahead of it had been REFUSED by Windows, so the
           * foreground was still the browser and a hundred words of essay went
           * somewhere that was not WordPad. The document read back empty and
           * the receipt still said the text had landed.
           *
           * The user named the application in the instruction. That name is
           * the target, and passing it means a failed focus produces a failed
           * write against the right window rather than a successful write
           * against the wrong one.
           */
          /*
           * WHATSAPP'S COMPOSER DOES NOT ACCEPT A GENERIC WRITE.
           *
           * Measured on the live app: the message box is a contenteditable that
           * silently ignores a ValuePattern set -- the write "succeeds", the box
           * stays empty, and the read-back has nothing to compare against. The
           * WhatsApp skill already knows to fall back to real keystrokes, and to
           * locate the composer by position rather than by taking the first
           * editable it finds (the page root also claims to be a text box).
           *
           * So the tool is chosen by destination. Nothing else on this path
           * changes: same words, same read-back, same receipt.
           */
          const typeCall: ToolCall = chatBox
            ? { name: "whatsapp_type", arguments: { message: body } }
            : {
                name: "type_text",
                arguments: {
                  text: body,
                  ...(pendingCompose.app ? { windowTitle: pendingCompose.app } : {}),
                },
              };
          const outcome = await runOneCall(typeCall, missionId, askPermission);
          push({
            id: `wt${Date.now()}`,
            kind: outcome.ok ? "done" : "problem",
            label: describeTool(typeCall.name),
            detail: outcome.detail,
            verified: outcome.verified,
          });
          setTurns((current) => [
            ...current,
            {
              id: `${id}-w`,
              role: "ocade",
              text: outcome.ok
                ? chatBox
                  ? `${outcome.detail} Say send when you want it to go.`
                  : `Wrote it into ${pendingCompose.app ?? "the window in front"}. ${outcome.detail}`
                : outcome.detail,
              entries: [...entries],
              verified: outcome.verified,
            },
          ]);
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : "OCADE could not write that.";
          setTurns((current) => [
            ...current,
            { id: `${id}-we`, role: "ocade", text: message, entries: [...entries], verified: false },
          ]);
          setError(message);
          setPhase("error");
        } finally {
          abortRef.current = null;
          revisionRef.current = null;
          setLive([]);
          setPhase((current) =>
            current === "stopped" || current === "error" ? current : "idle",
          );
        }
        return;
      }

      try {
        const agentDeps: AgentDeps = {
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
              /*
               * THE SCHEMA IS THE CONTRACT; THE PROSE IS THE FALLBACK.
               *
               * This used to append the whole tool vocabulary to the system
               * message and hunt for JSON in the reply, because the engine was
               * believed to have no function-calling channel. It has one — and
               * the difference is not cosmetic. Measured on the shipped model:
               * every attempt through the schema produced a well-formed call,
               * at about a tenth of the latency of the prose route.
               *
               * The prose route failed in the way that costs most. Observed
               * live, mid-task: `{"tool": "system_status", "arguments": {"}}` —
               * an unterminated object. Unparseable, so the loop saw "no tool
               * call", read that as "the model has finished", and ended a task
               * that was one step from done. Nothing errored and nothing said
               * anything was wrong.
               *
               * Both are sent: the schema for runtimes that honour it, the
               * written instructions for adapters that carry no tools at all
               * (the browser WebGPU and WASM engines). Whichever answers, the
               * call goes through the same contract validation afterwards.
               */
              const names = definitions.map((tool) => tool.name);
              const wire = schemasFor([...new Set(definitions.map((tool) => tool.domain))]);

              if (local[0]?.role === "system") {
                local[0] = {
                  ...local[0],
                  content: `${local[0].content}\n${toolInstructions(definitions)}`,
                };
              }

              const reply = await brain(
                local,
                handlers.onToken ?? (() => {}),
                handlers.signal,
                wire,
              );
              if (!reply.ok) throw new Error(reply.reason ?? "The engine did not answer.");

              /*
               * A structured call is preferred over anything found in the text.
               * The runtime shaped it, so it cannot be half-written; and an
               * invented name is still refused, because every call is checked
               * against the registry before it reaches the machine.
               */
              const native = (reply.calls ?? []).filter((call) => names.includes(call.name));
              const parsed = native.length
                ? { text: stripControlTokens(reply.text).trim(), toolCalls: native }
                : parseModelReply(reply.text, names);

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
            // One approval implementation, shared with the fast path above, so
            // the two routes cannot drift into different consent rules.
            permit: askPermission,
            execute: async (call, signal): Promise<ToolOutcome> => {
              await waitWhilePaused();
              if (signal?.aborted || controller.signal.aborted) {
                return { kind: "cancelled", detail: "The task was stopped." };
              }
              /*
               * THE CONTRACT, BEFORE THE MACHINE.
               *
               * Empty required arguments and exact repeats are refused here and
               * the reason goes back to the model as a tool result, so it can
               * correct itself on the next turn. A blank YouTube query and a
               * third `browser_open` both died at this line.
               */
              const checked = checkCall(call, ledgerRef.current);
              if (!checked.ok) {
                /*
                 * A CORRECTABLE MISTAKE IS NOT AN IMPOSSIBLE ONE.
                 *
                 * Every contract rejection used to come back as `unsupported`,
                 * which `isTerminal` treats as "this device cannot do this" and
                 * ends the run on. But bad arguments are the one failure the
                 * model is genuinely able to fix, and the reason is written for
                 * it to act on.
                 *
                 * FOUND LIVE: asked to read the memory figure and save it, the
                 * model called workspace_write with `$(memoryFree)` in the
                 * content. The placeholder guard caught it and said "substitute
                 * the actual value, then call workspace_write again" — and the
                 * loop stopped before the model could. A perfect refusal
                 * followed by a halt is still a task not done.
                 *
                 * `state_changed` is the right kind for all of them: not
                 * retried blindly with the same arguments, not terminal, so the
                 * next turn is the model reading the reason and correcting.
                 * `unknown_tool` stays terminal — an invented name is not
                 * something a retry improves.
                 */
                return {
                  kind: checked.code === "unknown_tool" ? "unsupported" : "state_changed",
                  detail: checked.reason,
                };
              }
              ledgerRef.current.note(checked.call);

              /*
               * DOES THE TEXT MEET THE LENGTH THE USER ASKED FOR?
               *
               * Checked HERE, before the write, because after the write it is
               * too late to be a check — it is a complaint about a file that
               * already exists. Asked for a 200-word essay, OCADE produced 175
               * words and reported success, and every mechanical receipt in
               * that run was correct: a window appeared, 1,216 characters
               * landed, the read-back matched. No step owned the property the
               * user actually stated, so nothing caught it.
               *
               * ONE retry, not a loop. A model that misses twice is not going
               * to converge on the third attempt, and each round costs the user
               * about twelve seconds. When the second attempt still misses, the
               * better text is used anyway and the receipt SAYS it is short —
               * refusing to write anything would be a worse outcome than
               * writing something slightly off with an honest note attached.
               */
              const authored = contentOf(
                checked.call.name,
                checked.call.arguments as Record<string, unknown> | undefined,
              );
              if (authored && constraints.length > 0) {
                const check = checkContent(authored.value, constraints);
                if (!check.ok) {
                  push({
                    id: `c${Date.now()}${entries.length}`,
                    kind: "acting",
                    label: "Checking the length",
                    detail: `${check.shortfall} — rewriting.`,
                  });
                  const corrected = await brain(
                    [
                      {
                        role: "user",
                        content: correctionPrompt(request, authored.value, check),
                      },
                    ],
                    () => {},
                    controller.signal,
                  );
                  if (corrected.ok && corrected.text.trim()) {
                    const retry = checkContent(corrected.text, constraints);
                    // Keep the rewrite only when it is genuinely closer. A
                    // "correction" that overshoots by more than the original
                    // undershot is not an improvement.
                    if (retry.ok || betterOf(check, retry)) {
                      checked.call.arguments = {
                        ...(checked.call.arguments ?? {}),
                        [authored.field]: corrected.text.trim(),
                      };
                    }
                    push({
                      id: `c2${Date.now()}${entries.length}`,
                      kind: retry.ok ? "done" : "problem",
                      label: "Length",
                      detail: retry.ok
                        ? `Now ${retry.results[0]?.actual} ${retry.results[0]?.constraint.unit}s.`
                        : `Still ${retry.shortfall}. Writing it anyway.`,
                      verified: retry.ok,
                    });
                  }
                }
              }

              const tool = findTool(checked.call.name);
              setPhase(tool?.mutating ? "controlling" : "observing");
              try {
                const outcome = await runControlActionFn({
                  data: {
                    missionId,
                    tool: checked.call.name,
                    args: (checked.call.arguments ?? {}) as Record<string, unknown>,
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
                /*
                 * A TOOL THAT CHANGED WHAT OCADE KNOWS INVALIDATES THE PROMPT
                 * IT IS ABOUT TO BUILD, so the context is re-read here.
                 *
                 * Only for the writes, and only on success — re-reading after
                 * every `memory_recall` would add a round trip to the one tool
                 * whose whole job is being cheap. Fire-and-forget on purpose:
                 * the loop must not wait on a refresh, and a failed one leaves
                 * the previous context in place, which is stale rather than
                 * wrong.
                 */
                if (
                  event.outcome.kind === "success" &&
                  MEMORY_WRITES.has(event.call.name) &&
                  missionRef.current
                ) {
                  void refreshMemory(missionRef.current);
                }
              } else if (event.kind === "refused") {
                push({
                  id: `x${Date.now()}${entries.length}`,
                  kind: "refused",
                  label: describeTool(event.call.name),
                  detail: event.reason,
                });
              }
            },
        };

        const taskInput = {
            request: remainingWork ?? request,
            signal: controller.signal,
            revision,
            /*
             * A RECOVERY IS NOT A REQUEST TO BE CLASSIFIED.
             *
             * The brief was written here, three lines up, for one purpose: look
             * at the screen and carry on. Sending it to the classifier asks a
             * 3B model a question this code already knows the answer to, and a
             * classifier that fails falls back to `conversation` — no tools at
             * all — which turns the recovery into OCADE describing what it
             * would have done. `files` and `web` ride along because the step
             * that failed can be in any of the three, and the recovery has to
             * be able to finish the original request rather than only look.
             */
            ...(recovering ? { domains: ["os_app", "files", "web"] as Domain[] } : {}),
            /*
             * WHAT OCADE ALREADY KNOWS ABOUT THIS PERSON, INTO THE PROMPT.
             *
             * Read from the ref rather than captured in state so a `remember`
             * earlier in this same conversation is present on this turn — the
             * `tool_end` handler refreshes it the moment a memory tool writes.
             * Without that, "my name is Haans" followed immediately by "what
             * should you call me" answered from an empty context.
             */
            memoryContext: memoryRef.current,
        };

        /*
         * A GOAL WITH SEVERAL PHASES IS PLANNED; EVERYTHING ELSE IS NOT.
         *
         * `runPlannedTask` decomposes once and runs each part in its own
         * sub-agent, so the bounding-box traffic from a click never reaches the
         * step that has to write a message. That isolation is the whole point
         * and it is also its only cost, so it is spent only where it buys
         * something: a single-clause request goes down the identical path it
         * always did, at the identical speed.
         *
         * A REVISION AND A RECOVERY ARE BOTH EXCLUDED. Each is already a
         * narrow, fully-specified instruction — planning one would decompose a
         * correction into steps nobody asked for.
         */
        const shouldPlan = !recovering && !revision && looksMultiStep(taskInput.request);

        const result = shouldPlan
          ? await (async () => {
              const plan = await runPlannedTask(agentDeps, {
                goal: taskInput.request,
                signal: taskInput.signal,
                memoryContext: taskInput.memoryContext,
              });
              // Mapped onto the shape the rest of this function already reads,
              // so the planner is a different way of running the work rather
              // than a second set of endings to handle.
              return {
                reason: plan.ok ? ("answered" as const) : ("step_limit" as const),
                text: plan.text,
                steps: [],
                classification: { domains: [], basis: "caller" as const },
                allVerified: plan.steps.every((step) => step.verified),
              };
            })()
          : await runAgentTask(agentDeps, taskInput);

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
        /*
         * A FAILURE MID-RUN HAS TO LOOK LIKE A FAILURE.
         *
         * The transcript entry below was the only thing this did, and a
         * transcript entry renders as ordinary grey text — the same as a
         * successful reply. `setError` was called ONLY when the mission could
         * not connect, so an engine that died half way through a task produced
         * a paragraph that read like an answer and a panel that looked idle.
         * Combined with a model call that had no timeout, that is the reported
         * hang: nothing failed loudly, so nothing looked broken.
         *
         * Both now happen. The banner turns red because `error` is set, and the
         * phase holds at "error" so the panel does not quietly return to idle.
         */
        const message =
          cause instanceof Error
            ? cause.message
            : "OCADE could not complete that on this computer.";
        setTurns((current) => [
          ...current,
          {
            id: `${id}-e`,
            role: "ocade",
            text: message,
            entries: [...entries],
            verified: false,
          },
        ]);
        setError(message);
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
    // `speak` and `refreshMemory` are stable `useCallback([])`s, so listing
    // them changes nothing at runtime — but suppressing the rule here would
    // hide the next dependency that is not stable.
    [brain, runOneCall, speak, refreshMemory],
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
    /** Prompt (typing) or voice (hands-free). Changes approvals, not powers. */
    mode,
    setMode,
    /** Microphone state, device list, and the controls for both. */
    mic,
    setMicEnabled,
    selectMicDevice,
    refreshAudio,
    /** Speak a line without blocking execution. */
    speak,
    /** Where the time went on the last step. */
    lastLatency: latencyRef.current,
    /** Which tools this device actually offers, for the capability line. */
    toolCount: toolsFor(["os_app", "files", "web"] as Domain[]).length,
  };
}
