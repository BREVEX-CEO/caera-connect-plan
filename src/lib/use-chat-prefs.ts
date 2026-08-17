import { useCallback, useState } from "react";

/** OCADE per-device chat presentation/input preferences. AI routing is local-only. */
export type EngineTierPreference = "auto" | "local";
export type SendKeyPreference = "enter" | "mod_enter";
export type MessageDensity = "comfortable" | "compact";

export interface ChatPrefs {
  /** Both values stay local; auto only chooses among local device adapters. */
  defaultEngineTier: EngineTierPreference;
  sendKey: SendKeyPreference;
  showTimestamps: boolean;
  density: MessageDensity;
  renderMarkdown: boolean;
  keepDrafts: boolean;
  showDiagnostics: boolean;
  thinking: boolean;
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
};

const KEY = "ocade.chat.prefs.v1";
const TIERS: EngineTierPreference[] = ["auto", "local"];
const SEND_KEYS: SendKeyPreference[] = ["enter", "mod_enter"];
const DENSITIES: MessageDensity[] = ["comfortable", "compact"];

export interface ChatPrefsStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/**
 * Total parse. A historical stored `cloud` choice is intentionally migrated to
 * `local` so an old browser preference cannot resurrect removed remote routing.
 */
export function parseChatPrefs(raw: string | null): ChatPrefs {
  if (!raw) return { ...DEFAULT_CHAT_PREFS };
  try {
    const p = JSON.parse(raw) as Partial<Record<keyof ChatPrefs, unknown>> & {
      defaultEngineTier?: unknown;
    };
    const bool = (key: keyof ChatPrefs) =>
      typeof p[key] === "boolean" ? (p[key] as boolean) : DEFAULT_CHAT_PREFS[key] === true;
    const storedTier = p.defaultEngineTier;
    const defaultEngineTier: EngineTierPreference =
      storedTier === "cloud"
        ? "local"
        : TIERS.includes(storedTier as EngineTierPreference)
          ? (storedTier as EngineTierPreference)
          : DEFAULT_CHAT_PREFS.defaultEngineTier;
    return {
      defaultEngineTier,
      sendKey: SEND_KEYS.includes(p.sendKey as SendKeyPreference)
        ? (p.sendKey as SendKeyPreference)
        : DEFAULT_CHAT_PREFS.sendKey,
      showTimestamps: bool("showTimestamps"),
      density: DENSITIES.includes(p.density as MessageDensity)
        ? (p.density as MessageDensity)
        : DEFAULT_CHAT_PREFS.density,
      renderMarkdown: bool("renderMarkdown"),
      keepDrafts: bool("keepDrafts"),
      showDiagnostics: bool("showDiagnostics"),
      thinking: bool("thinking"),
    };
  } catch {
    return { ...DEFAULT_CHAT_PREFS };
  }
}

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
      reason: "OCADE couldn't save chat settings in this browser. Your previous settings are still active.",
    };
  }
}

export function readChatPrefs(): ChatPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_CHAT_PREFS };
  try {
    const parsed = parseChatPrefs(window.localStorage.getItem(KEY));
    // Opportunistically rewrite old `cloud` preferences to the local schema.
    saveChatPrefs(window.localStorage, parsed);
    return parsed;
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
      return saved.ok
        ? { prefs: next, storageError: null }
        : { prefs: current.prefs, storageError: saved.reason };
    });
  }, []);

  const reset = useCallback(() => update({ ...DEFAULT_CHAT_PREFS }), [update]);
  return { prefs: state.prefs, update, reset, storageError: state.storageError };
}
