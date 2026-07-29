/**
 * User-owned Computer Use policy.
 *
 * This module stores preferences, not authority. Every actual browser, native,
 * mobile, and automation action still passes its own permission, risk,
 * protected-input, confirmation, and companion checks at execution time.
 */

export type ComputerUsePermission =
  | "blocked"
  | "read_only"
  | "ask_every_mutation"
  | "ask_risky"
  | "bounded_workflow"
  | "session_allowance"
  | "time_limited"
  | "always_selected_low_risk";

export type RecordingMode = "off" | "receipts_only" | "approved_replay";

export interface ComputerUseSettings {
  enabled: boolean;
  webControl: boolean;
  thisComputer: boolean;
  pairedDevices: boolean;
  backgroundTasks: boolean;
  remoteSessions: boolean;
  recordingMode: RecordingMode;
  replayEnabled: boolean;
  defaultPermission: ComputerUsePermission;
  allowanceMinutes: number;
  /**
   * Deliberately literal `true`: passwords, OTPs, CAPTCHAs, biometrics,
   * payments, recovery codes, and legal confirmations can never be delegated.
   */
  protectedInputs: true;
}

export const COMPUTER_USE_SETTINGS_KEY = "ocade:computer-use:v1";

export const DEFAULT_COMPUTER_USE_SETTINGS: ComputerUseSettings = {
  enabled: false,
  webControl: false,
  thisComputer: false,
  pairedDevices: false,
  backgroundTasks: false,
  remoteSessions: false,
  recordingMode: "off",
  replayEnabled: false,
  defaultPermission: "ask_every_mutation",
  allowanceMinutes: 30,
  protectedInputs: true,
};

const PERMISSIONS = new Set<ComputerUsePermission>([
  "blocked",
  "read_only",
  "ask_every_mutation",
  "ask_risky",
  "bounded_workflow",
  "session_allowance",
  "time_limited",
  "always_selected_low_risk",
]);

const RECORDING_MODES = new Set<RecordingMode>(["off", "receipts_only", "approved_replay"]);

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function normalizeComputerUseSettings(value: unknown): ComputerUseSettings {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const permission = candidate.defaultPermission;
  const recordingMode = candidate.recordingMode;
  const minutes =
    typeof candidate.allowanceMinutes === "number" &&
    Number.isInteger(candidate.allowanceMinutes) &&
    candidate.allowanceMinutes >= 5 &&
    candidate.allowanceMinutes <= 480
      ? candidate.allowanceMinutes
      : DEFAULT_COMPUTER_USE_SETTINGS.allowanceMinutes;

  return {
    enabled: isBoolean(candidate.enabled)
      ? candidate.enabled
      : DEFAULT_COMPUTER_USE_SETTINGS.enabled,
    webControl: isBoolean(candidate.webControl)
      ? candidate.webControl
      : DEFAULT_COMPUTER_USE_SETTINGS.webControl,
    thisComputer: isBoolean(candidate.thisComputer)
      ? candidate.thisComputer
      : DEFAULT_COMPUTER_USE_SETTINGS.thisComputer,
    pairedDevices: isBoolean(candidate.pairedDevices)
      ? candidate.pairedDevices
      : DEFAULT_COMPUTER_USE_SETTINGS.pairedDevices,
    backgroundTasks: isBoolean(candidate.backgroundTasks)
      ? candidate.backgroundTasks
      : DEFAULT_COMPUTER_USE_SETTINGS.backgroundTasks,
    remoteSessions: isBoolean(candidate.remoteSessions)
      ? candidate.remoteSessions
      : DEFAULT_COMPUTER_USE_SETTINGS.remoteSessions,
    recordingMode:
      typeof recordingMode === "string" && RECORDING_MODES.has(recordingMode as RecordingMode)
        ? (recordingMode as RecordingMode)
        : DEFAULT_COMPUTER_USE_SETTINGS.recordingMode,
    replayEnabled: isBoolean(candidate.replayEnabled)
      ? candidate.replayEnabled
      : DEFAULT_COMPUTER_USE_SETTINGS.replayEnabled,
    defaultPermission:
      typeof permission === "string" && PERMISSIONS.has(permission as ComputerUsePermission)
        ? (permission as ComputerUsePermission)
        : DEFAULT_COMPUTER_USE_SETTINGS.defaultPermission,
    allowanceMinutes: minutes,
    protectedInputs: true,
  };
}

export interface StorageReader {
  getItem(key: string): string | null;
}

export interface StorageWriter {
  setItem(key: string, value: string): void;
}

export function loadComputerUseSettings(
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
): ComputerUseSettings {
  if (!storage) return { ...DEFAULT_COMPUTER_USE_SETTINGS };
  try {
    const raw = storage.getItem(COMPUTER_USE_SETTINGS_KEY);
    return raw
      ? normalizeComputerUseSettings(JSON.parse(raw))
      : { ...DEFAULT_COMPUTER_USE_SETTINGS };
  } catch {
    return { ...DEFAULT_COMPUTER_USE_SETTINGS };
  }
}

export type PersistResult = { ok: true } | { ok: false; error: string };

export function persistComputerUseSettings(
  settings: ComputerUseSettings,
  storage: StorageWriter | null = typeof window === "undefined" ? null : window.localStorage,
): PersistResult {
  if (!storage) {
    return { ok: false, error: "Computer Use settings could not be saved in this runtime." };
  }
  try {
    storage.setItem(
      COMPUTER_USE_SETTINGS_KEY,
      JSON.stringify(normalizeComputerUseSettings(settings)),
    );
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Computer Use settings could not be saved on this device.",
    };
  }
}

export function effectiveComputerUseChannels(settings: ComputerUseSettings) {
  const active = settings.enabled;
  return {
    webControl: active && settings.webControl,
    thisComputer: active && settings.thisComputer,
    pairedDevices: active && settings.pairedDevices,
    backgroundTasks: active && settings.backgroundTasks,
    remoteSessions: active && settings.remoteSessions,
  };
}

export type ComputerUseChannel =
  "webControl" | "thisComputer" | "pairedDevices" | "backgroundTasks" | "remoteSessions";

/** Fail-closed user-facing gate for an applicable Computer Use channel. */
export function computerUseChannelDecision(
  channel: ComputerUseChannel,
  settings: ComputerUseSettings = loadComputerUseSettings(),
): string | null {
  if (!settings.enabled) {
    return "Computer Use is off. Enable it in Settings before OCADE can act.";
  }
  if (!effectiveComputerUseChannels(settings)[channel]) {
    const labels: Record<ComputerUseChannel, string> = {
      webControl: "Web Control",
      thisComputer: "This Computer",
      pairedDevices: "Paired Devices",
      backgroundTasks: "Background Tasks",
      remoteSessions: "Remote Sessions",
    };
    return `${labels[channel]} is off in Computer Use settings.`;
  }
  return null;
}

/**
 * Apply the two default modes that can refuse immediately. Other modes define
 * how approval is requested; they never grant execution by themselves.
 */
export function computerUsePermissionDecision(
  risk: "read_only" | "low" | "confirm" | "high" | "prohibited",
  settings: ComputerUseSettings = loadComputerUseSettings(),
): string | null {
  if (settings.defaultPermission === "blocked") {
    return "Computer Use permissions are set to Blocked.";
  }
  if (settings.defaultPermission === "read_only" && risk !== "read_only") {
    return "Computer Use permissions are Read-only, so this action cannot change anything.";
  }
  return null;
}
