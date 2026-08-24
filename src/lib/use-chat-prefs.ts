import { useCallback, useState } from "react";

/**
 * OCADE Chat preferences.
 *
 * Deliberately local to the browser rather than a server table. These are
 * per-device presentation and input choices — how a message is sent, how dense
 * the transcript is, which engine a new chat starts on — and a person using a
 * laptop and a desktop reasonably wants different answers on each. Nothing here
 * is private content, so nothing here needs to travel.
 *
 * Every field below is READ by the chat screen. A preference no surface
 * consults is a dead control with a switch on it, which is worse than an
 * absent feature because it looks like it works.
 *
 * Parsing is total: any stored value that is missing, corrupt, or out of range
 * falls back to the default rather than throwing, because a settings file
 * someone hand-edited must not be able to break the chat screen.
 */

/**
 * "cloud" is gone with the engine that served it.
 *
 * A value persisted by an earlier build may still say "cloud" in somebody's
 * localStorage, so the parser below maps it to "auto" rather than rejecting
 * the whole preferences object — losing every other setting because one
 * obsolete word survived would be a worse outcome than the obsolete word.
 */
export type EngineTierPreference = "auto" | "local";
export type SendKeyPreference = "enter" | "mod_enter";
export type MessageDensity = "comfortable" | "compact";

export interface ChatPrefs {
  /** Which engine a NEW conversation starts on. */
  defaultEngineTier: EngineTierPreference;
  /** Enter sends, or Enter newlines and Ctrl/Cmd+Enter sends. */
  sendKey: SendKeyPreference;
  showTimestamps: boolean;
  density: MessageDensity;
  /** Render markdown, or show the model's literal output. */
  renderMarkdown: boolean;
  /**
   * Keep the last unsent draft per conversation. Off means a closed tab
   * discards it, which some people prefer on a shared machine.
   */
  keepDrafts: boolean;
  /**
   * Show the verification machinery inside the transcript.
   *
   * OFF, AND OFF IS THE POINT. Answer receipts, engine provenance cards,
   * conversation-integrity chains, fingerprints and turn counts are real and
   * they are worth having — but under every single answer they turned a chat
   * into an audit log. Someone asking a question does not need a hash to read
   * the reply, and putting one there taught them to scroll past the whole
   * region, including on the day it would have mattered.
   *
   * The evidence is not deleted; it is moved behind this one switch, so the
   * people who need it can still see it and nobody else is charged for it.
   */
  showDiagnostics: boolean;
  /**
   * Let the model reason before it answers. ON, and on for a reason.
   *
   * With reasoning on, Qwen3 works through the question in a separate channel
   * and `content` comes back as the answer alone — better replies on anything
   * involving several steps, at roughly a third more time.
   *
   * It is a real switch rather than a fixed setting because the tradeoff is
   * genuinely the user's: someone asking short factual questions is paying for
   * deliberation they did not want, and they are the only one who knows that.
   *
   * Control + Work does NOT read this. There, reasoning is suppressed
   * unconditionally — this model narrates the tool call instead of emitting one
   * when it reasons, and a turn the loop cannot execute is not a slower
   * success. See `thinkingFor` in `local/fixed-model.ts` for the measurement.
   */
  thinking: boolean;
  /**
   * Whether Chat may look things up on the web for time-sensitive questions.
   *
   * ON BY DEFAULT, AND THAT IS A DELIBERATE CHOICE RATHER THAN AN OVERSIGHT.
   * The alternative to looking up "who won last night" is answering it from
   * training data in the same confident voice used for arithmetic, which is
   * the failure this setting exists to prevent — a person cannot tell a stale
   * answer from a current one by reading it.
   *
   * Turning it off is honoured completely: a time-sensitive question is then
   * answered from the device with a note saying the live part was not checked.
   * It never silently degrades into a confident guess.
   *
   * Only time-sensitive questions ever reach the network. A timeless one — and
   * anything the classifier cannot place — is answered on the device with no
   * request at all, whatever this is set to.
   */
  research: boolean;
}

export const DEFAULT_CHAT_PREFS: ChatPrefs = {
  defaultEngineTier: "auto",
  sendKey: "enter",
  showTimestamps: false,
  density: "comfortable",
  renderMarkdown: true,
  keepDrafts: true,
  showDiagnostics: false,
  thinking: true,
  research: true,
};

const KEY = "ocade.chat.prefs.v1";

const TIERS: EngineTierPreference[] = ["auto", "local"];
const SEND_KEYS: SendKeyPreference[] = ["enter", "mod_enter"];
const DENSITIES: MessageDensity[] = ["comfortable", "compact"];

export interface ChatPrefsStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** Total parse: unknown or corrupt input yields defaults, never an exception. */
export function parseChatPrefs(raw: string | null): ChatPrefs {
  if (!raw) return { ...DEFAULT_CHAT_PREFS };
  try {
    const p = JSON.parse(raw) as Partial<Record<keyof ChatPrefs, unknown>>;
    const bool = (key: keyof ChatPrefs) =>
      typeof p[key] === "boolean" ? (p[key] as boolean) : DEFAULT_CHAT_PREFS[key] === true;
    return {
      defaultEngineTier: TIERS.includes(p.defaultEngineTier as EngineTierPreference)
        ? (p.defaultEngineTier as EngineTierPreference)
        : DEFAULT_CHAT_PREFS.defaultEngineTier,
      sendKey: SEND_KEYS.includes(p.sendKey as SendKeyPreference)
        ? (p.sendKey as SendKeyPreference)
        : DEFAULT_CHAT_PREFS.sendKey,
      showTimestamps: bool("showTimestamps"),
      density: DENSITIES.includes(p.density as MessageDensity)
        ? (p.density as MessageDensity)
        : DEFAULT_CHAT_PREFS.density,
      renderMarkdown: bool("renderMarkdown"),
      keepDrafts: bool("keepDrafts"),
      research: bool("research"),
      showDiagnostics: bool("showDiagnostics"),
      thinking: bool("thinking"),
    };
  } catch {
    return { ...DEFAULT_CHAT_PREFS };
  }
}

/** Persist one exact snapshot, and report failure instead of implying success. */
export function saveChatPrefs(
  storage: ChatPrefsStorage,
  prefs: ChatPrefs,
): { ok: true } | { ok: false; reason: string } {
  try {
    storage.setItem(KEY, JSON.stringify(prefs));
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason:
        "OCADE couldn't save chat settings in this browser. Your previous settings are still active.",
    };
  }
}

export function readChatPrefs(): ChatPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_CHAT_PREFS };
  try {
    return parseChatPrefs(window.localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_CHAT_PREFS };
  }
}

export function useChatPrefs() {
  const [state, setState] = useState<{ prefs: ChatPrefs; storageError: string | null }>(() => ({
    prefs: readChatPrefs(),
    storageError: null,
  }));

  const update = useCallback((patch: Partial<ChatPrefs>) => {
    setState((current) => {
      const next = parseChatPrefs(JSON.stringify({ ...current.prefs, ...patch }));
      if (typeof window === "undefined") return { prefs: next, storageError: null };
      const saved = saveChatPrefs(window.localStorage, next);
      // On a failed write the IN-MEMORY state is not advanced either: showing a
      // toggle in its new position while the stored value stayed put would be
      // the interface lying about what it did.
      return saved.ok
        ? { prefs: next, storageError: null }
        : { prefs: current.prefs, storageError: saved.reason };
    });
  }, []);

  const reset = useCallback(() => update({ ...DEFAULT_CHAT_PREFS }), [update]);

  return { prefs: state.prefs, update, reset, storageError: state.storageError };
}
